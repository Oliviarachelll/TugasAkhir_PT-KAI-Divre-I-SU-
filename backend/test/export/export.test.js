const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { Prisma } = require('@prisma/client');

const { exportLaporanSchema } = require('../../src/schemas/export.schema');
const {
  buildWhere,
  createCumulativeSeries,
  cumulativeAt,
  loadAutomaticRealization,
  normalizeReport,
  buildCanonicalModel,
  getExportData,
} = require('../../src/services/export/laporan-export.service');
const { flattenRows, renderExcel } = require('../../src/services/export/excel.renderer');
const { getTemplates, renderPdf } = require('../../src/services/export/pdf.renderer');
const { parseJsonArray, formatCurrency } = require('../../src/services/export/report-formatters');
const { ExportSemaphore } = require('../../src/services/export/export-concurrency');

const rawReport = {
  id_laporan: 10,
  tanggal: new Date('2026-09-15T00:00:00.000Z'),
  status: 'DISETUJUI',
  status_internal: 'SELESAI',
  kotak_detail: 'Laporan uji',
  id_unit: 3,
  unit: { id_unit: 3, nama_unit: 'Unit Angkutan Barang', jenis_unit: 'CABANG' },
  pengguna: { id_pengguna: 7, nama: 'Pengguna Uji' },
  laporan_kna: null,
  laporan_penumpang: [{
    id_laporan_penumpang: 1,
    nama_ka: 'PUTRI DELI',
    no_ka: 'U75',
    lintas: 'Medan - Tanjungbalai',
    berangkat: '08:00',
    kedatangan: '12:00',
    jml_penumpang: 125,
    pendapatan: 5000000,
  }],
  laporan_barang: [
    {
      id_laporan_barang: 1,
      id_komoditi: 8,
      jml_ka: 2,
      volume: 15,
      pendapatan: 2500000,
      volume_kumulatif: 100,
      volume_program: 500,
      volume_pencapaian: 20,
      pendapatan_kumulatif: 10000000,
      pendapatan_program: 50000000,
      pendapatan_pencapaian: 20,
      nama_kustom: null,
      komoditi: { id_komoditi: 8, nama_komoditi: 'Peti Kemas', satuan: 'TON' },
    },
    {
      id_laporan_barang: 2,
      id_komoditi: 99,
      jml_ka: 0,
      volume: 15,
      pendapatan: 2500000,
      komoditi: { id_komoditi: 99, nama_komoditi: 'TOTAL SUMMARY', satuan: 'TON' },
    },
  ],
  laporan_keuangan: {
    id_laporan_keuangan: 1,
    target_rkad: 100000000,
    realisasi_rkad: 20000000,
    pendapatan: 5000000,
    pengeluaran: 2000000,
    laba_rugi: 3000000,
    rincian_transaksi: JSON.stringify([{ jenis: 'Penerimaan', uraian: 'Pendapatan', penerimaan: 5000000, pengeluaran: 0 }]),
    rincian_spj: '[]',
    rincian_invoice: 'not-json',
  },
  created_at: new Date('2026-09-15T01:00:00.000Z'),
  updated_at: new Date('2026-09-15T02:00:00.000Z'),
};

const createModel = () => buildCanonicalModel({
  reports: [rawReport],
  realizationByReport: new Map([[10, { kna: 0, keuangan: 5000000 }]]),
  filters: {},
  pengguna: { id_pengguna: 1, nama: 'Admin Uji', peran: 'ADMIN_GLOBAL' },
  selectedUnit: null,
});

test('schema accepts all-data export and rejects invalid filters', () => {
  assert.equal(exportLaporanSchema.safeParse({ filters: {} }).success, true);
  assert.equal(exportLaporanSchema.safeParse({ filters: { id_unit: '3' } }).success, true);
  assert.equal(exportLaporanSchema.safeParse({
    filters: { tanggal_mulai: '2026-09-30', tanggal_akhir: '2026-09-01' },
  }).success, false);
  assert.equal(exportLaporanSchema.safeParse({ filters: { tanggal_mulai: '1999-12-31' } }).success, false);
  assert.equal(exportLaporanSchema.safeParse({ filters: { bulan: '2101-01' } }).success, false);
  assert.equal(exportLaporanSchema.safeParse({ filters: { id_unit: true } }).success, false);
  assert.equal(exportLaporanSchema.safeParse({ filters: { id_unit: ['3'] } }).success, false);
  assert.equal(exportLaporanSchema.safeParse({ filters: { id_unit: ' 3' } }).success, false);
});

test('USER_UNIT scope overrides requested unit and date filter is inclusive', () => {
  const { effectiveFilters, where } = buildWhere(
    { id_unit: 99, tanggal_mulai: '2026-09-01', tanggal_akhir: '2026-09-30' },
    { peran: 'USER_UNIT', id_unit: 3 }
  );
  assert.equal(effectiveFilters.id_unit, 3);
  assert.equal(where.id_unit, 3);
  assert.equal(where.tanggal.gte.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(where.tanggal.lt.toISOString(), '2026-10-01T00:00:00.000Z');
});

test('export query is unpaginated and applies server-side filters', async () => {
  let reportQuery;
  const fakePrisma = {
    laporan: {
      findMany: async (query) => {
        reportQuery = query;
        return [];
      },
    },
    unit: {
      findUnique: async () => ({ id_unit: 3, nama_unit: 'Unit Angkutan Barang' }),
    },
  };

  const model = await getExportData(
    { id_unit: 3, status: 'DISETUJUI', bulan: '2026-09' },
    { id_pengguna: 1, nama: 'Admin Uji', peran: 'ADMIN_GLOBAL' },
    fakePrisma
  );

  assert.equal(reportQuery.skip, undefined);
  assert.equal(reportQuery.take, undefined);
  assert.equal(reportQuery.where.id_unit, 3);
  assert.equal(reportQuery.where.status, 'DISETUJUI');
  assert.equal(reportQuery.where.tanggal.gte.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(reportQuery.where.tanggal.lt.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(reportQuery.select.id_laporan, true);
  assert.equal(reportQuery.select.token_revisi, undefined);
  assert.equal(reportQuery.select.token_revisi_exp, undefined);
  assert.equal(reportQuery.include, undefined);
  assert.equal(model.meta.record_count, 0);
});

test('canonical mapper uses jml_penumpang and excludes commodity total row', () => {
  const report = normalizeReport(rawReport, { keuangan: 5000000 });
  assert.equal(report.sections.penumpang.totals.jumlah_penumpang, 125);
  assert.equal(report.sections.barang.items.length, 1);
  assert.equal(report.sections.barang.total_pendapatan.equals('2500000'), true);
  assert.equal(report.sections.barang.totals_by_unit[0].volume.equals('15'), true);
  assert.equal(report.sections.keuangan.invoice.length, 0);
  assert.match(report.warnings[0], /invoice/i);
});

test('Excel renderer creates complete typed workbook', async () => {
  const model = createModel();
  const buffer = await renderExcel(model);
  assert.ok(buffer.length > 1000);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ['Ringkasan', 'Laporan', 'KNA', 'Penumpang', 'Barang', 'Keuangan', 'Transaksi', 'SPJ', 'Invoice', 'Peringatan']
  );
  assert.equal(workbook.getWorksheet('Penumpang').getCell('I6').value, 125);
  assert.equal(workbook.getWorksheet('Barang').getCell('A6').value, 10);
  assert.equal(typeof workbook.getWorksheet('Ringkasan').getCell('F24').value, 'number');
  assert.equal(
    workbook.getWorksheet('Laporan').getCell('J6').value.toISOString(),
    '2026-09-15T08:00:00.000Z'
  );
});

test('PDF Handlebars template renders canonical report safely', () => {
  const model = createModel();
  const templates = getTemplates();
  const html = templates.body({ ...model, styles: '', logoDataUri: 'data:image/png;base64,' });
  assert.match(html, /Rekap Laporan Operasional/);
  assert.match(html, /PUTRI DELI/);
  assert.match(html, /Peti Kemas/);
  assert.doesNotMatch(html, /not-json/);
  assert.doesNotMatch(html, /\[object Object\]/);
});

test('finance JSON keeps only plain object rows and remains renderable', async () => {
  const warnings = [];
  const parsed = parseJsonArray(
    JSON.stringify([null, 7, ['nested'], { jenis: 'Penerimaan', uraian: 'Valid' }]),
    'Rincian transaksi',
    warnings
  );
  assert.deepEqual(parsed, [{ jenis: 'Penerimaan', uraian: 'Valid' }]);
  assert.match(warnings[0], /3 item tidak valid/i);

  const malformedReport = {
    ...rawReport,
    laporan_keuangan: {
      ...rawReport.laporan_keuangan,
      rincian_transaksi: JSON.stringify([
        null,
        7,
        [],
        {
          jenis: 'Penerimaan',
          uraian: { toString: null, valueOf: null },
          penerimaan: { nominal: 5000 },
          pengeluaran: '1e1000000',
          unit_kerja: 'Keuangan',
        },
      ]),
      rincian_spj: JSON.stringify([
        null,
        'teks',
        [],
        {
          no_spj: 'SPJ-001',
          tanggal_spj: '2026-09-16',
          uraian: 'Pengujian SPJ',
          nominal: '2500.75',
          keterangan: { nested: true },
        },
      ]),
      rincian_invoice: JSON.stringify([{
        no_invoice: 'INV-001',
        tanggal_invoice: '2026-09-17',
        vendor: 'Vendor Uji',
        nominal: '1000.25',
        jatuh_tempo: '2026-10-17',
        status: 'Belum Lunas',
      }]),
    },
  };
  const model = buildCanonicalModel({
    reports: [malformedReport],
    filters: {},
    pengguna: { id_pengguna: 1, nama: 'Admin Uji', peran: 'ADMIN_GLOBAL' },
    selectedUnit: null,
  });

  assert.equal(model.reports[0].sections.keuangan.transaksi.length, 1);
  assert.equal(model.reports[0].sections.keuangan.transaksi[0].uraian, '');
  assert.equal(model.reports[0].sections.keuangan.transaksi[0].penerimaan.equals(0), true);
  assert.equal(model.reports[0].sections.keuangan.transaksi[0].pengeluaran.equals(0), true);
  assert.equal(model.reports[0].sections.keuangan.spj.length, 1);
  assert.ok(model.warnings.some((warning) => /Rincian transaksi.*3 item/i.test(warning)));
  assert.ok(model.warnings.some((warning) => /Rincian transaksi baris 1.*uraian.*penerimaan/i.test(warning)));
  assert.ok(model.warnings.some((warning) => /Rincian SPJ.*3 item/i.test(warning)));
  assert.ok(model.warnings.some((warning) => /Rincian SPJ baris 1.*keterangan/i.test(warning)));
  assert.doesNotThrow(() => flattenRows(model));

  const templates = getTemplates();
  const html = templates.body({ ...model, styles: '', logoDataUri: 'data:image/png;base64,' });
  assert.match(html, /SPJ-001/);
  assert.doesNotMatch(html, /\[object Object\]/);

  const buffer = await renderExcel(model);
  assert.ok(buffer.length > 1000);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.equal(workbook.getWorksheet('SPJ').getCell('F6').value.toISOString(), '2026-09-16T00:00:00.000Z');
  assert.equal(workbook.getWorksheet('Invoice').getCell('F6').value.toISOString(), '2026-09-17T00:00:00.000Z');
  assert.equal(workbook.getWorksheet('Invoice').getCell('I6').value.toISOString(), '2026-10-17T00:00:00.000Z');
});

test('Decimal accumulation remains exact until renderer conversion', () => {
  const amount = new Prisma.Decimal('9999999999999.99');
  const rows = Array.from({ length: 10 }, (_, index) => ({
    tanggal: new Date(Date.UTC(2026, 0, index + 1)),
    amount,
  }));
  const series = createCumulativeSeries(rows, (row) => row.amount);
  const expected = '99999999999999.9';

  assert.equal(series.at(-1).total.equals(expected), true);
  assert.equal(cumulativeAt(series, Date.UTC(2026, 0, 31)).equals(expected), true);

  const reports = rows.map((row, index) => ({
    ...rawReport,
    id_laporan: 100 + index,
    tanggal: row.tanggal,
    laporan_kna: null,
    laporan_barang: [],
    laporan_keuangan: null,
    laporan_penumpang: [{
      ...rawReport.laporan_penumpang[0],
      id_laporan_penumpang: 100 + index,
      pendapatan: amount,
    }],
  }));
  const model = buildCanonicalModel({
    reports,
    filters: {},
    pengguna: { id_pengguna: 1, nama: 'Admin Uji', peran: 'ADMIN_GLOBAL' },
    selectedUnit: null,
  });

  assert.equal(model.summary.domain_totals.pendapatan_penumpang.equals(expected), true);
  assert.match(formatCurrency(new Prisma.Decimal('9007199254740991.99')), /9\.007\.199\.254\.740\.991,99/);
});

test('automatic realization uses two bulk queries for all unit-year scopes', async () => {
  const reportDate = new Date('2026-02-01T00:00:00.000Z');
  const reports = [{
    id_laporan: 1,
    id_unit: 3,
    tanggal: reportDate,
    laporan_kna: { realisasi_rkad: 0 },
    laporan_keuangan: { realisasi_rkad: 0 },
  }];
  const queries = [];
  const fakePrisma = {
    laporan: {
      findMany: async (query) => {
        queries.push(query);
        if (query.where.laporan_kna) {
          return [
            {
              id_unit: 3,
              tanggal: new Date('2026-01-01T00:00:00.000Z'),
              laporan_kna: { nilai_row: new Prisma.Decimal('0.10'), nilai_non_row: new Prisma.Decimal('0.20') },
            },
            {
              id_unit: 3,
              tanggal: reportDate,
              laporan_kna: { nilai_row: new Prisma.Decimal('0.30'), nilai_non_row: new Prisma.Decimal('0.40') },
            },
          ];
        }
        return [
          {
            id_unit: 3,
            tanggal: new Date('2026-01-01T00:00:00.000Z'),
            laporan_keuangan: { pendapatan: new Prisma.Decimal('0.10') },
          },
          {
            id_unit: 3,
            tanggal: reportDate,
            laporan_keuangan: { pendapatan: new Prisma.Decimal('0.20') },
          },
        ];
      },
    },
  };

  const realization = await loadAutomaticRealization(reports, fakePrisma);
  assert.equal(queries.length, 2);
  assert.equal(queries[0].where.OR.length, 1);
  assert.equal(realization.get(1).kna.equals('1'), true);
  assert.equal(realization.get(1).keuangan.equals('0.3'), true);
});

test('missing selected unit fails before querying report data', async () => {
  let reportQueryExecuted = false;
  const fakePrisma = {
    unit: { findUnique: async () => null },
    laporan: {
      findMany: async () => {
        reportQueryExecuted = true;
        return [];
      },
    },
  };

  await assert.rejects(
    getExportData(
      { id_unit: 999 },
      { id_pengguna: 1, nama: 'Admin Uji', peran: 'ADMIN_GLOBAL' },
      fakePrisma
    ),
    (error) => error.code === 'EXPORT_UNIT_NOT_FOUND' && error.statusCode === 404
  );
  assert.equal(reportQueryExecuted, false);
});

test('aborted data loading does not start realization queries', async () => {
  const abortController = new AbortController();
  let reportQueries = 0;
  const fakePrisma = {
    laporan: {
      findMany: async (query) => {
        reportQueries += 1;
        assert.equal(query.select?.id_laporan, true, 'query pertama harus query laporan utama');
        assert.equal(query.select?.token_revisi, undefined);
        abortController.abort();
        return [rawReport];
      },
    },
  };

  await assert.rejects(
    getExportData(
      {},
      { id_pengguna: 1, nama: 'Admin Uji', peran: 'ADMIN_GLOBAL' },
      fakePrisma,
      { signal: abortController.signal }
    ),
    (error) => error.code === 'EXPORT_REQUEST_ABORTED'
  );
  assert.equal(reportQueries, 1);
});

test('export semaphore bounds concurrency and queue size', async () => {
  const semaphore = new ExportSemaphore({
    maxConcurrency: 1,
    maxQueue: 1,
    queueTimeoutMs: 1000,
  });

  const releaseFirst = await semaphore.acquire();
  const secondPermit = semaphore.acquire();
  assert.deepEqual(semaphore.stats, {
    active: 1,
    queued: 1,
    maxConcurrency: 1,
    maxQueue: 1,
    closed: false,
  });
  await assert.rejects(
    semaphore.acquire(),
    (error) => error.code === 'EXPORT_QUEUE_FULL' && error.statusCode === 503
  );

  releaseFirst();
  const releaseSecond = await secondPermit;
  assert.equal(semaphore.stats.active, 1);
  assert.equal(semaphore.stats.queued, 0);
  releaseSecond();
  releaseSecond();
  await semaphore.onIdle();
  assert.equal(semaphore.stats.active, 0);
});

test('renderers reject an already aborted export', async () => {
  const abortController = new AbortController();
  abortController.abort();
  const options = { signal: abortController.signal };

  await assert.rejects(renderExcel(createModel(), options), (error) => error.code === 'EXPORT_REQUEST_ABORTED');
  await assert.rejects(renderPdf(createModel(), options), (error) => error.code === 'EXPORT_REQUEST_ABORTED');
});

test('export semaphore removes timed-out and aborted waiters', async () => {
  const semaphore = new ExportSemaphore({
    maxConcurrency: 1,
    maxQueue: 2,
    queueTimeoutMs: 20,
  });
  const release = await semaphore.acquire();

  await assert.rejects(
    semaphore.acquire(),
    (error) => error.code === 'EXPORT_QUEUE_TIMEOUT'
  );
  assert.equal(semaphore.stats.queued, 0);

  const abortController = new AbortController();
  const abortedPermit = semaphore.acquire({ signal: abortController.signal });
  abortController.abort();
  await assert.rejects(
    abortedPermit,
    (error) => error.code === 'EXPORT_REQUEST_ABORTED'
  );
  assert.equal(semaphore.stats.queued, 0);

  release();
  await semaphore.onIdle();
});
