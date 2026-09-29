const prisma = require('../../config/database');
const { ExportConcurrencyError } = require('./export-concurrency');
const {
  REPORT_TIMEZONE,
  ExportDecimal,
  toDecimal,
  dateOnly,
  parseJsonArray,
} = require('./report-formatters');

const EXPORT_SCHEMA_VERSION = 'laporan-export.v1';
const EXPORT_TEMPLATE_VERSION = '1.0.0';
const TOTAL_COMMODITY_ID = 99;

const throwIfExportAborted = (signal) => {
  if (signal?.aborted) throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);
};

const createExportDataError = (message, statusCode, code) => {
  const error = new Error(message);
  error.name = 'ExportDataError';
  error.statusCode = statusCode;
  error.code = code;
  error.expose = true;
  return error;
};

const startOfUtcDate = (value) => new Date(`${value}T00:00:00.000Z`);

const addUtcDays = (value, amount) => {
  const date = startOfUtcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date;
};

const monthBounds = (monthValue) => {
  const [year, month] = monthValue.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
};

const resolveDateFilter = (filters = {}) => {
  if (filters.bulan) return monthBounds(filters.bulan);

  const dateFilter = {};
  if (filters.tanggal_mulai) dateFilter.gte = startOfUtcDate(filters.tanggal_mulai);
  if (filters.tanggal_akhir) dateFilter.lt = addUtcDays(filters.tanggal_akhir, 1);
  return Object.keys(dateFilter).length > 0 ? dateFilter : undefined;
};

const buildEffectiveFilters = (filters = {}, pengguna = {}) => {
  if (pengguna.peran === 'USER_UNIT' && (!Number.isInteger(pengguna.id_unit) || pengguna.id_unit <= 0)) {
    throw createExportDataError('Unit pengguna tidak valid untuk ekspor', 403, 'EXPORT_UNIT_SCOPE_INVALID');
  }

  return {
    ...filters,
    id_unit: pengguna.peran === 'USER_UNIT' ? pengguna.id_unit : filters.id_unit,
  };
};

const buildWhere = (filters = {}, pengguna = {}) => {
  const effectiveFilters = buildEffectiveFilters(filters, pengguna);
  const tanggal = resolveDateFilter(effectiveFilters);

  return {
    effectiveFilters,
    where: {
      ...(effectiveFilters.id_unit && { id_unit: effectiveFilters.id_unit }),
      ...(effectiveFilters.status && { status: effectiveFilters.status }),
      ...(tanggal && { tanggal }),
    },
  };
};

const createCumulativeSeries = (rows, valueSelector) => {
  const sorted = rows
    .map((row) => ({
      timestamp: new Date(row.tanggal).getTime(),
      value: toDecimal(valueSelector(row)),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  let total = toDecimal(0);
  return sorted.map((entry) => {
    total = total.plus(entry.value);
    return { timestamp: entry.timestamp, total };
  });
};

const cumulativeAt = (series, timestamp) => {
  let low = 0;
  let high = series.length - 1;
  let result = toDecimal(0);

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (series[middle].timestamp <= timestamp) {
      result = toDecimal(series[middle].total);
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
};

const loadAutomaticRealization = async (reports, prismaClient = prisma, signal) => {
  throwIfExportAborted(signal);
  const combinations = new Map();

  reports.forEach((report) => {
    if (!report.laporan_kna && !report.laporan_keuangan) return;
    const year = Number(dateOnly(report.tanggal)?.slice(0, 4));
    if (!year) return;
    combinations.set(`${report.id_unit}-${year}`, { id_unit: report.id_unit, year });
  });

  const seriesByCombination = new Map();
  if (combinations.size === 0) return new Map();

  const scopes = [...combinations.values()].map(({ id_unit, year }) => ({
    id_unit,
    tanggal: {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    },
  }));
  const baseWhere = {
    OR: scopes,
    status: { not: 'DITOLAK' },
  };

  throwIfExportAborted(signal);
  const [knaRows, financeRows] = await Promise.all([
    prismaClient.laporan.findMany({
      where: { ...baseWhere, laporan_kna: { isNot: null } },
      select: {
        id_unit: true,
        tanggal: true,
        laporan_kna: { select: { nilai_row: true, nilai_non_row: true } },
      },
    }),
    prismaClient.laporan.findMany({
      where: { ...baseWhere, laporan_keuangan: { isNot: null } },
      select: {
        id_unit: true,
        tanggal: true,
        laporan_keuangan: { select: { pendapatan: true } },
      },
    }),
  ]);
  throwIfExportAborted(signal);

  const groupRows = (rows) => rows.reduce((grouped, row) => {
    const year = Number(dateOnly(row.tanggal)?.slice(0, 4));
    const key = `${row.id_unit}-${year}`;
    const current = grouped.get(key) || [];
    current.push(row);
    grouped.set(key, current);
    return grouped;
  }, new Map());
  const knaRowsByCombination = groupRows(knaRows);
  const financeRowsByCombination = groupRows(financeRows);

  combinations.forEach((_, key) => {
    seriesByCombination.set(key, {
      kna: createCumulativeSeries(
        knaRowsByCombination.get(key) || [],
        (row) => toDecimal(row.laporan_kna?.nilai_row).plus(row.laporan_kna?.nilai_non_row || 0)
      ),
      keuangan: createCumulativeSeries(
        financeRowsByCombination.get(key) || [],
        (row) => row.laporan_keuangan?.pendapatan
      ),
    });
  });

  const realizationByReport = new Map();
  reports.forEach((report) => {
    const year = Number(dateOnly(report.tanggal)?.slice(0, 4));
    const series = seriesByCombination.get(`${report.id_unit}-${year}`);
    const timestamp = new Date(report.tanggal).getTime();

    realizationByReport.set(report.id_laporan, {
      kna: series ? cumulativeAt(series.kna, timestamp) : toDecimal(report.laporan_kna?.realisasi_rkad),
      keuangan: series ? cumulativeAt(series.keuangan, timestamp) : toDecimal(report.laporan_keuangan?.realisasi_rkad),
    });
  });

  return realizationByReport;
};

const normalizePerson = (person) => person ? {
  id: person.id_pengguna,
  nama: person.nama,
} : null;

const normalizeUnit = (unit) => unit ? {
  id: unit.id_unit,
  nama: unit.nama_unit,
  jenis: unit.jenis_unit,
} : null;

const normalizeKna = (kna, realization) => {
  if (!kna) return null;
  return {
    id: kna.id_laporan_kna,
    row: {
      jumlah_kontrak: kna.jml_kontrak_row ?? 0,
      luas_tanah: toDecimal(kna.luas_t_row),
      luas_bangunan: toDecimal(kna.luas_b_row),
      nilai: toDecimal(kna.nilai_row),
    },
    non_row: {
      jumlah_kontrak: kna.jml_kontrak_non_row ?? 0,
      luas_tanah: toDecimal(kna.luas_t_non_row),
      luas_bangunan: toDecimal(kna.luas_b_non_row),
      nilai: toDecimal(kna.nilai_non_row),
    },
    target_rkad: toDecimal(kna.target_rkad),
    realisasi_rkad: toDecimal(realization),
  };
};

const normalizePassengers = (items = []) => {
  const normalizedItems = items.map((item) => ({
    id: item.id_laporan_penumpang,
    nama_ka: item.nama_ka,
    no_ka: item.no_ka,
    lintas: item.lintas,
    berangkat: item.berangkat,
    kedatangan: item.kedatangan,
    jumlah_penumpang: item.jml_penumpang ?? 0,
    pendapatan: toDecimal(item.pendapatan),
  }));

  return {
    items: normalizedItems,
    totals: normalizedItems.reduce((total, item) => ({
      jumlah_penumpang: total.jumlah_penumpang + item.jumlah_penumpang,
      pendapatan: total.pendapatan.plus(item.pendapatan),
    }), { jumlah_penumpang: 0, pendapatan: toDecimal(0) }),
  };
};

const normalizeGoods = (items = [], warnings) => {
  const storedSummaryRow = items.find((item) => item.id_komoditi === TOTAL_COMMODITY_ID);
  const detailItems = items
    .filter((item) => item.id_komoditi !== TOTAL_COMMODITY_ID)
    .map((item) => ({
      id: item.id_laporan_barang,
      jumlah_ka: item.jml_ka ?? 0,
      komoditi: item.nama_kustom || item.komoditi?.nama_komoditi || `Komoditi #${item.id_komoditi}`,
      id_komoditi: item.id_komoditi,
      satuan: item.komoditi?.satuan || 'TANPA SATUAN',
      volume: toDecimal(item.volume),
      volume_kumulatif: toDecimal(item.volume_kumulatif),
      volume_program: toDecimal(item.volume_program),
      volume_pencapaian: toDecimal(item.volume_pencapaian),
      pendapatan: toDecimal(item.pendapatan),
      pendapatan_kumulatif: toDecimal(item.pendapatan_kumulatif),
      pendapatan_program: toDecimal(item.pendapatan_program),
      pendapatan_pencapaian: toDecimal(item.pendapatan_pencapaian),
    }));

  const totalsByUnitMap = new Map();
  detailItems.forEach((item) => {
    const current = totalsByUnitMap.get(item.satuan) || {
      satuan: item.satuan,
      jumlah_ka: 0,
      volume: toDecimal(0),
      pendapatan: toDecimal(0),
    };
    current.jumlah_ka += item.jumlah_ka;
    current.volume = current.volume.plus(item.volume);
    current.pendapatan = current.pendapatan.plus(item.pendapatan);
    totalsByUnitMap.set(item.satuan, current);
  });

  const detailTotal = detailItems.reduce((total, item) => ({
    volume: total.volume.plus(item.volume),
    pendapatan: total.pendapatan.plus(item.pendapatan),
  }), { volume: toDecimal(0), pendapatan: toDecimal(0) });

  const storedSummary = storedSummaryRow ? {
    volume: toDecimal(storedSummaryRow.volume),
    pendapatan: toDecimal(storedSummaryRow.pendapatan),
  } : null;

  if (storedSummary) {
    const volumeDelta = storedSummary.volume.minus(detailTotal.volume).abs();
    const revenueDelta = storedSummary.pendapatan.minus(detailTotal.pendapatan).abs();
    if (volumeDelta.gt('0.0001') || revenueDelta.gt('0.01')) {
      warnings.push('Ringkasan barang tersimpan tidak sama dengan total baris detail.');
    }
  }

  return {
    items: detailItems,
    totals_by_unit: [...totalsByUnitMap.values()],
    total_pendapatan: detailTotal.pendapatan,
    stored_summary: storedSummary,
  };
};

const FINANCE_DETAIL_SCHEMAS = {
  transaksi: {
    jenis: { type: 'text', maxLength: 100 },
    uraian: { type: 'text', maxLength: 1000 },
    penerimaan: { type: 'decimal' },
    pengeluaran: { type: 'decimal' },
    unit_kerja: { type: 'text', maxLength: 150 },
  },
  spj: {
    no_spj: { type: 'text', maxLength: 100 },
    tanggal_spj: { type: 'date' },
    uraian: { type: 'text', maxLength: 1000 },
    nominal: { type: 'decimal' },
    keterangan: { type: 'text', maxLength: 1000 },
  },
  invoice: {
    no_invoice: { type: 'text', maxLength: 100 },
    tanggal_invoice: { type: 'date' },
    vendor: { type: 'text', maxLength: 300 },
    nominal: { type: 'decimal' },
    jatuh_tempo: { type: 'date' },
    status: { type: 'text', maxLength: 100 },
    keterangan: { type: 'text', maxLength: 1000 },
  },
};

const normalizeFinanceText = (value, maxLength) => {
  if (value === null || value === undefined || value === '') return { value: '', valid: true };
  if (!['string', 'number', 'boolean'].includes(typeof value)) return { value: '', valid: false };
  if (typeof value === 'number' && !Number.isFinite(value)) return { value: '', valid: false };

  const text = String(value);
  const cleaned = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
  return {
    value: cleaned.slice(0, maxLength),
    valid: cleaned === text && cleaned.length <= maxLength,
  };
};

const normalizeFinanceDecimal = (value) => {
  if (value === null || value === undefined || value === '') {
    return { value: toDecimal(0), valid: true };
  }
  if (!['string', 'number', 'bigint'].includes(typeof value)) {
    return { value: toDecimal(0), valid: false };
  }

  try {
    const decimal = new ExportDecimal(value);
    if (!decimal.isFinite() || decimal.abs().gt('9999999999999.99')) {
      throw new TypeError('Nilai di luar batas nominal');
    }
    return { value: decimal, valid: true };
  } catch {
    return { value: toDecimal(0), valid: false };
  }
};

const normalizeFinanceDate = (value) => {
  if (value === null || value === undefined || value === '') return { value: null, valid: true };
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { value: null, valid: false };
  }
  const year = Number(value.slice(0, 4));
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const valid = year >= 1000
    && year <= 9999
    && !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
  return { value: valid ? value : null, valid };
};

const normalizeFinanceRows = (rawValue, label, schema, warnings) => (
  parseJsonArray(rawValue, label, warnings).map((item, index) => {
    const invalidFields = [];
    const normalized = {};

    Object.entries(schema).forEach(([field, definition]) => {
      let result;
      if (definition.type === 'decimal') result = normalizeFinanceDecimal(item[field]);
      else if (definition.type === 'date') result = normalizeFinanceDate(item[field]);
      else result = normalizeFinanceText(item[field], definition.maxLength);

      normalized[field] = result.value;
      if (!result.valid) invalidFields.push(field);
    });

    if (invalidFields.length > 0) {
      warnings.push(`${label} baris ${index + 1} memiliki field tidak valid (${invalidFields.join(', ')}); nilai diamankan.`);
    }
    return normalized;
  })
);

const normalizeFinance = (finance, realization, warnings) => {
  if (!finance) return null;

  return {
    id: finance.id_laporan_keuangan,
    target_rkad: toDecimal(finance.target_rkad),
    realisasi_rkad: toDecimal(realization),
    pendapatan: toDecimal(finance.pendapatan),
    pengeluaran: toDecimal(finance.pengeluaran),
    laba_rugi: toDecimal(finance.laba_rugi),
    transaksi: normalizeFinanceRows(
      finance.rincian_transaksi,
      'Rincian transaksi',
      FINANCE_DETAIL_SCHEMAS.transaksi,
      warnings
    ),
    spj: normalizeFinanceRows(
      finance.rincian_spj,
      'Rincian SPJ',
      FINANCE_DETAIL_SCHEMAS.spj,
      warnings
    ),
    invoice: normalizeFinanceRows(
      finance.rincian_invoice,
      'Rincian invoice',
      FINANCE_DETAIL_SCHEMAS.invoice,
      warnings
    ),
  };
};

const normalizeReport = (report, realization = {}) => {
  const warnings = [];
  const penumpang = normalizePassengers(report.laporan_penumpang || []);
  const barang = normalizeGoods(report.laporan_barang || [], warnings);
  const kna = normalizeKna(report.laporan_kna, realization.kna ?? toDecimal(report.laporan_kna?.realisasi_rkad));
  const keuangan = normalizeFinance(
    report.laporan_keuangan,
    realization.keuangan ?? toDecimal(report.laporan_keuangan?.realisasi_rkad),
    warnings
  );

  const sections = [];
  if (kna) sections.push('KNA');
  if (penumpang.items.length > 0) sections.push('PENUMPANG');
  if (barang.items.length > 0 || barang.stored_summary) sections.push('BARANG');
  if (keuangan) sections.push('KEUANGAN');

  return {
    id: report.id_laporan,
    tanggal: dateOnly(report.tanggal),
    status: report.status,
    status_internal: report.status_internal,
    catatan: report.kotak_detail,
    unit: normalizeUnit(report.unit),
    pembuat: normalizePerson(report.pengguna),
    sections_present: sections,
    sections: { kna, penumpang, barang, keuangan },
    created_at: report.created_at?.toISOString?.() || report.created_at || null,
    updated_at: report.updated_at?.toISOString?.() || report.updated_at || null,
    warnings,
  };
};

const buildSummary = (reports) => {
  const byStatus = {
    DRAFT: 0,
    DIAJUKAN: 0,
    DISETUJUI: 0,
    DITOLAK: 0,
    REVISI: 0,
  };
  const byUnit = new Map();
  const goodsVolumeByUnit = new Map();
  const domainTotals = {
    kna_nilai: toDecimal(0),
    penumpang: 0,
    pendapatan_penumpang: toDecimal(0),
    pendapatan_barang: toDecimal(0),
    pendapatan_keuangan: toDecimal(0),
    pengeluaran_keuangan: toDecimal(0),
    laba_rugi_keuangan: toDecimal(0),
    volume_barang: [],
  };

  reports.forEach((report) => {
    byStatus[report.status] = (byStatus[report.status] || 0) + 1;
    const unitKey = report.unit?.id || 0;
    const unitSummary = byUnit.get(unitKey) || {
      id: report.unit?.id || null,
      nama: report.unit?.nama || 'Tanpa Unit',
      jumlah_laporan: 0,
    };
    unitSummary.jumlah_laporan += 1;
    byUnit.set(unitKey, unitSummary);

    const { kna, penumpang, barang, keuangan } = report.sections;
    if (kna) {
      domainTotals.kna_nilai = domainTotals.kna_nilai
        .plus(kna.row.nilai)
        .plus(kna.non_row.nilai);
    }
    domainTotals.penumpang += penumpang.totals.jumlah_penumpang;
    domainTotals.pendapatan_penumpang = domainTotals.pendapatan_penumpang
      .plus(penumpang.totals.pendapatan);
    domainTotals.pendapatan_barang = domainTotals.pendapatan_barang
      .plus(barang.total_pendapatan);
    barang.totals_by_unit.forEach((total) => {
      const currentVolume = goodsVolumeByUnit.get(total.satuan) || toDecimal(0);
      goodsVolumeByUnit.set(total.satuan, currentVolume.plus(total.volume));
    });
    if (keuangan) {
      domainTotals.pendapatan_keuangan = domainTotals.pendapatan_keuangan.plus(keuangan.pendapatan);
      domainTotals.pengeluaran_keuangan = domainTotals.pengeluaran_keuangan.plus(keuangan.pengeluaran);
      domainTotals.laba_rugi_keuangan = domainTotals.laba_rugi_keuangan.plus(keuangan.laba_rugi);
    }
  });

  domainTotals.volume_barang = [...goodsVolumeByUnit.entries()].map(([satuan, volume]) => ({ satuan, volume }));

  return {
    by_status: byStatus,
    by_unit: [...byUnit.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id-ID')),
    domain_totals: domainTotals,
  };
};

const buildCanonicalModel = ({ reports, realizationByReport = new Map(), filters, pengguna, selectedUnit }) => {
  const normalizedReports = reports.map((report) => normalizeReport(
    report,
    realizationByReport.get(report.id_laporan)
  ));

  const warnings = normalizedReports.flatMap((report) => report.warnings.map((warning) => (
    `Laporan #${report.id}: ${warning}`
  )));

  return {
    schema_version: EXPORT_SCHEMA_VERSION,
    template_version: EXPORT_TEMPLATE_VERSION,
    meta: {
      generated_at: new Date().toISOString(),
      timezone: REPORT_TIMEZONE,
      locale: 'id-ID',
      generated_by: {
        id: pengguna.id_pengguna,
        nama: pengguna.nama,
        peran: pengguna.peran,
      },
      filters: {
        ...filters,
        unit_name: selectedUnit?.nama_unit || null,
      },
      record_count: normalizedReports.length,
    },
    summary: buildSummary(normalizedReports),
    reports: normalizedReports,
    warnings,
  };
};

const getExportData = async (requestedFilters, pengguna, prismaClient = prisma, { signal } = {}) => {
  throwIfExportAborted(signal);
  const { effectiveFilters, where } = buildWhere(requestedFilters, pengguna);
  const selectedUnit = effectiveFilters.id_unit
    ? await prismaClient.unit.findUnique({
      where: { id_unit: effectiveFilters.id_unit },
      select: { id_unit: true, nama_unit: true },
    })
    : null;
  throwIfExportAborted(signal);

  if (effectiveFilters.id_unit && !selectedUnit) {
    throw createExportDataError(
      `Unit dengan ID ${effectiveFilters.id_unit} tidak ditemukan`,
      404,
      'EXPORT_UNIT_NOT_FOUND'
    );
  }

  throwIfExportAborted(signal);
  const reports = await prismaClient.laporan.findMany({
    where,
    include: {
      pengguna: { select: { id_pengguna: true, nama: true } },
      unit: { select: { id_unit: true, nama_unit: true, jenis_unit: true } },
      laporan_kna: true,
      laporan_keuangan: true,
      laporan_penumpang: { orderBy: { id_laporan_penumpang: 'asc' } },
      laporan_barang: {
        include: { komoditi: { select: { id_komoditi: true, nama_komoditi: true, satuan: true } } },
        orderBy: { id_laporan_barang: 'asc' },
      },
    },
    orderBy: [{ tanggal: 'asc' }, { id_laporan: 'asc' }],
  });
  throwIfExportAborted(signal);

  const realizationByReport = await loadAutomaticRealization(reports, prismaClient, signal);
  throwIfExportAborted(signal);

  const model = buildCanonicalModel({
    reports,
    realizationByReport,
    filters: effectiveFilters,
    pengguna,
    selectedUnit,
  });
  throwIfExportAborted(signal);
  return model;
};

module.exports = {
  EXPORT_SCHEMA_VERSION,
  EXPORT_TEMPLATE_VERSION,
  TOTAL_COMMODITY_ID,
  throwIfExportAborted,
  createExportDataError,
  resolveDateFilter,
  buildEffectiveFilters,
  buildWhere,
  createCumulativeSeries,
  cumulativeAt,
  loadAutomaticRealization,
  normalizeReport,
  buildSummary,
  buildCanonicalModel,
  getExportData,
};
