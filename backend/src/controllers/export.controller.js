const prisma = require('../config/database');
const { sendError } = require('../utils/response');
const { getExportData } = require('../services/export/laporan-export.service');
const { renderExcel } = require('../services/export/excel.renderer');
const { renderPdf } = require('../services/export/pdf.renderer');
const {
  ExportConcurrencyError,
  exportSemaphore,
} = require('../services/export/export-concurrency');

const MIME_TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const buildFilename = (format, model) => {
  const filters = model.meta.filters || {};
  const period = filters.bulan
    || (filters.tanggal_mulai && filters.tanggal_akhir
      ? `${filters.tanggal_mulai}_${filters.tanggal_akhir}`
      : filters.tanggal_mulai || filters.tanggal_akhir || 'semua-tanggal');
  const unit = filters.id_unit ? `unit-${filters.id_unit}` : 'semua-unit';
  const status = filters.status ? filters.status.toLowerCase() : 'semua-status';
  return `KAI_Laporan_${period}_${unit}_${status}.${format}`;
};

const writeAuditLog = async ({ req, format, model, filename }) => {
  try {
    await prisma.logAudit.create({
      data: {
        aksi: 'EXPORT_LAPORAN',
        tabel_terkait: 'laporan',
        detail: JSON.stringify({
          format,
          filename,
          filters: model.meta.filters,
          record_count: model.meta.record_count,
          schema_version: model.schema_version,
          template_version: model.template_version,
        }),
        id_pengguna: req.pengguna.id_pengguna,
      },
    });
  } catch (error) {
    console.error('[EXPORT AUDIT ERROR]', error.message);
  }
};

const exportLaporan = async (req, res) => {
  const format = String(req.params.format || '').toLowerCase();
  if (!MIME_TYPES[format]) {
    return sendError(res, 'Format ekspor harus pdf atau xlsx', 422);
  }

  const abortController = new AbortController();
  const abortPendingExport = () => abortController.abort();
  const detachAbortListeners = () => {
    req.off('aborted', abortPendingExport);
    res.off('close', abortPendingExport);
  };
  req.once('aborted', abortPendingExport);
  res.once('close', abortPendingExport);

  const throwIfAborted = () => {
    if (abortController.signal.aborted) {
      throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);
    }
  };

  let release;
  try {
    release = await exportSemaphore.acquire({ signal: abortController.signal });
    throwIfAborted();

    const model = await getExportData(
      req.body.filters || {},
      req.pengguna,
      prisma,
      { signal: abortController.signal }
    );
    throwIfAborted();
    const renderOptions = { signal: abortController.signal };
    const buffer = format === 'pdf'
      ? await renderPdf(model, renderOptions)
      : await renderExcel(model, renderOptions);
    throwIfAborted();
    const filename = buildFilename(format, model);

    await writeAuditLog({ req, format, model, filename });
    throwIfAborted();

    const encodedFilename = encodeURIComponent(filename);
    res.status(200);
    res.setHeader('Content-Type', MIME_TYPES[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Export-Record-Count', String(model.meta.record_count));
    return res.send(buffer);
  } catch (error) {
    if (error.code === 'EXPORT_REQUEST_ABORTED') return undefined;
    if (error.expose && error.statusCode && !res.headersSent) {
      return sendError(res, error.message, error.statusCode);
    }
    throw error;
  } finally {
    detachAbortListeners();
    release?.();
  }
};

module.exports = {
  MIME_TYPES,
  buildFilename,
  exportLaporan,
};
