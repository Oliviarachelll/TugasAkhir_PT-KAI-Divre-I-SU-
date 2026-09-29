const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { ExportConcurrencyError } = require('./export-concurrency');
const {
  toNumber,
  parseDateOnly,
  formatDateTime,
  toExcelDateTime,
  safeSpreadsheetText,
} = require('./report-formatters');

const COLORS = {
  navy: 'FF302D78',
  navyDark: 'FF1E2154',
  orange: 'FFF36F21',
  blueLight: 'FFE9EFFA',
  orangeLight: 'FFFFF0E7',
  white: 'FFFFFFFF',
  text: 'FF1F2937',
  muted: 'FF64748B',
  border: 'FFD8DEE9',
  warning: 'FFFFF3CD',
};

const MONEY_FORMAT = '"Rp" #,##0.00;[Red]-"Rp" #,##0.00';
const NUMBER_FORMAT = '#,##0.####;[Red]-#,##0.####';
const INTEGER_FORMAT = '#,##0;[Red]-#,##0';
const PERCENT_FORMAT = '0.00"%"';
const DATE_FORMAT = 'dd mmmm yyyy';
const DATETIME_FORMAT = 'dd mmmm yyyy hh:mm';

const logoPath = path.join(__dirname, '..', '..', 'assets', 'reports', 'kai-logo.png');

const describeFilters = (model) => {
  const filters = model.meta.filters || {};
  const descriptions = [];
  if (filters.unit_name) descriptions.push(`Unit: ${filters.unit_name}`);
  if (filters.status) descriptions.push(`Status: ${filters.status}`);
  if (filters.bulan) descriptions.push(`Bulan: ${filters.bulan}`);
  if (filters.tanggal_mulai) descriptions.push(`Mulai: ${filters.tanggal_mulai}`);
  if (filters.tanggal_akhir) descriptions.push(`Selesai: ${filters.tanggal_akhir}`);
  return descriptions.length > 0 ? descriptions.join(' | ') : 'Semua data yang diizinkan';
};

const applyCellBorder = (cell) => {
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.border } },
    left: { style: 'thin', color: { argb: COLORS.border } },
    bottom: { style: 'thin', color: { argb: COLORS.border } },
    right: { style: 'thin', color: { argb: COLORS.border } },
  };
};

const setCellValue = (cell, value, type) => {
  if (type === 'date') {
    cell.value = parseDateOnly(value);
    cell.numFmt = DATE_FORMAT;
    return;
  }
  if (type === 'datetime') {
    cell.value = toExcelDateTime(value);
    cell.numFmt = DATETIME_FORMAT;
    return;
  }
  if (type === 'money') {
    cell.value = toNumber(value);
    cell.numFmt = MONEY_FORMAT;
    return;
  }
  if (type === 'number') {
    cell.value = toNumber(value);
    cell.numFmt = NUMBER_FORMAT;
    return;
  }
  if (type === 'integer') {
    cell.value = Math.trunc(toNumber(value));
    cell.numFmt = INTEGER_FORMAT;
    return;
  }
  if (type === 'percent') {
    cell.value = toNumber(value);
    cell.numFmt = PERCENT_FORMAT;
    return;
  }
  cell.value = safeSpreadsheetText(value);
};

const addSheetHeading = (worksheet, title, model, columnCount) => {
  const lastColumn = Math.max(columnCount, 6);
  worksheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells(2, 1, 2, lastColumn);
  const filterCell = worksheet.getCell(2, 1);
  filterCell.value = `Filter: ${describeFilters(model)}`;
  filterCell.font = { name: 'Arial', size: 10, color: { argb: COLORS.text } };
  filterCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.blueLight } };
  filterCell.alignment = { vertical: 'middle', wrapText: true };

  worksheet.mergeCells(3, 1, 3, lastColumn);
  const generatedCell = worksheet.getCell(3, 1);
  generatedCell.value = `Dibuat ${formatDateTime(model.meta.generated_at)} oleh ${model.meta.generated_by.nama} | ${model.meta.record_count} laporan | Template ${model.template_version}`;
  generatedCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: COLORS.muted } };
  generatedCell.alignment = { vertical: 'middle', wrapText: true };
};

const writeDataSheet = (workbook, model, config) => {
  const worksheet = workbook.addWorksheet(config.name, {
    properties: { defaultRowHeight: 18 },
    pageSetup: {
      paperSize: 9,
      orientation: config.orientation || 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.65, bottom: 0.65, header: 0.2, footer: 0.2 },
    },
  });

  addSheetHeading(worksheet, config.title, model, config.columns.length);
  const headerRowNumber = 5;
  const headerRow = worksheet.getRow(headerRowNumber);

  config.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? COLORS.navy : COLORS.navyDark } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyCellBorder(cell);
    worksheet.getColumn(index + 1).width = column.width || 16;
  });
  headerRow.height = 32;

  if (config.rows.length === 0) {
    worksheet.mergeCells(headerRowNumber + 1, 1, headerRowNumber + 2, Math.max(config.columns.length, 1));
    const emptyCell = worksheet.getCell(headerRowNumber + 1, 1);
    emptyCell.value = 'Tidak ada data untuk filter yang dipilih.';
    emptyCell.font = { name: 'Arial', italic: true, color: { argb: COLORS.muted } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
  } else {
    config.rows.forEach((row, rowIndex) => {
      const excelRow = worksheet.getRow(headerRowNumber + 1 + rowIndex);
      config.columns.forEach((column, columnIndex) => {
        const cell = excelRow.getCell(columnIndex + 1);
        setCellValue(cell, row[column.key], column.type);
        cell.font = { name: 'Arial', size: 9, color: { argb: COLORS.text } };
        cell.alignment = {
          vertical: 'top',
          horizontal: ['money', 'number', 'integer', 'percent'].includes(column.type) ? 'right' : 'left',
          wrapText: true,
        };
        if (rowIndex % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
        applyCellBorder(cell);
      });
    });
  }

  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: Math.max(headerRowNumber, headerRowNumber + config.rows.length), column: config.columns.length },
  };
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRowNumber, activeCell: `A${headerRowNumber + 1}` }];
  worksheet.headerFooter.oddFooter = '&LPT KAI Divre I Sumatera Utara&C&F&RHalaman &P dari &N';
  worksheet.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;

  return worksheet;
};

const buildSummarySheet = (workbook, model) => {
  const worksheet = workbook.addWorksheet('Ringkasan', {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  worksheet.columns = [
    { width: 4 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 22 },
    { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];

  if (fs.existsSync(logoPath)) {
    const logoId = workbook.addImage({ filename: logoPath, extension: 'png' });
    worksheet.addImage(logoId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 90, height: 58 } });
  }

  worksheet.mergeCells('C1:J2');
  const title = worksheet.getCell('C1');
  title.value = 'REKAP EKSPOR LAPORAN OPERASIONAL';
  title.font = { name: 'Arial', size: 18, bold: true, color: { argb: COLORS.navy } };
  title.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

  worksheet.mergeCells('A4:J4');
  worksheet.getCell('A4').value = 'PT KERETA API INDONESIA (PERSERO) - DIVISI REGIONAL I SUMATERA UTARA';
  worksheet.getCell('A4').font = { name: 'Arial', bold: true, color: { argb: COLORS.white } };
  worksheet.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(4).height = 26;

  const metadata = [
    ['Filter', describeFilters(model)],
    ['Dibuat oleh', `${model.meta.generated_by.nama} (${model.meta.generated_by.peran})`],
    ['Waktu ekspor', formatDateTime(model.meta.generated_at)],
    ['Jumlah laporan', model.meta.record_count],
    ['Versi template', model.template_version],
  ];

  metadata.forEach(([label, value], index) => {
    const row = 6 + index;
    worksheet.getCell(row, 2).value = label;
    worksheet.getCell(row, 2).font = { name: 'Arial', bold: true, color: { argb: COLORS.navy } };
    worksheet.mergeCells(row, 3, row, 9);
    worksheet.getCell(row, 3).value = value;
    worksheet.getCell(row, 3).alignment = { wrapText: true };
  });

  worksheet.mergeCells('B13:E13');
  worksheet.getCell('B13').value = 'JUMLAH LAPORAN PER STATUS';
  worksheet.getCell('B13').font = { name: 'Arial', bold: true, color: { argb: COLORS.white } };
  worksheet.getCell('B13').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  worksheet.getCell('B13').alignment = { horizontal: 'center' };

  Object.entries(model.summary.by_status).forEach(([status, count], index) => {
    const row = 14 + index;
    worksheet.getCell(row, 2).value = status;
    worksheet.getCell(row, 3).value = count;
    worksheet.getCell(row, 3).numFmt = INTEGER_FORMAT;
    applyCellBorder(worksheet.getCell(row, 2));
    applyCellBorder(worksheet.getCell(row, 3));
  });

  worksheet.mergeCells('G13:J13');
  worksheet.getCell('G13').value = 'JUMLAH LAPORAN PER UNIT';
  worksheet.getCell('G13').font = { name: 'Arial', bold: true, color: { argb: COLORS.white } };
  worksheet.getCell('G13').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.orange } };
  worksheet.getCell('G13').alignment = { horizontal: 'center' };

  model.summary.by_unit.forEach((unit, index) => {
    const row = 14 + index;
    worksheet.mergeCells(row, 7, row, 9);
    worksheet.getCell(row, 7).value = safeSpreadsheetText(unit.nama);
    worksheet.getCell(row, 10).value = unit.jumlah_laporan;
    worksheet.getCell(row, 10).numFmt = INTEGER_FORMAT;
    for (let column = 7; column <= 10; column += 1) applyCellBorder(worksheet.getCell(row, column));
  });

  const totals = model.summary.domain_totals;
  const metricStart = Math.max(21, 15 + model.summary.by_unit.length);
  worksheet.mergeCells(metricStart, 2, metricStart, 10);
  worksheet.getCell(metricStart, 2).value = 'RINGKASAN METRIK DATA TERPILIH';
  worksheet.getCell(metricStart, 2).font = { name: 'Arial', bold: true, color: { argb: COLORS.white } };
  worksheet.getCell(metricStart, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  worksheet.getCell(metricStart, 2).alignment = { horizontal: 'center' };

  const metrics = [
    ['Nilai KNA', totals.kna_nilai, MONEY_FORMAT],
    ['Jumlah Penumpang', totals.penumpang, INTEGER_FORMAT],
    ['Pendapatan Penumpang', totals.pendapatan_penumpang, MONEY_FORMAT],
    ['Pendapatan Barang', totals.pendapatan_barang, MONEY_FORMAT],
    ['Pendapatan Keuangan', totals.pendapatan_keuangan, MONEY_FORMAT],
    ['Pengeluaran Keuangan', totals.pengeluaran_keuangan, MONEY_FORMAT],
    ['Laba/Rugi Keuangan', totals.laba_rugi_keuangan, MONEY_FORMAT],
  ];

  metrics.forEach(([label, value, format], index) => {
    const row = metricStart + 1 + index;
    worksheet.mergeCells(row, 2, row, 5);
    worksheet.getCell(row, 2).value = label;
    worksheet.mergeCells(row, 6, row, 10);
    worksheet.getCell(row, 6).value = toNumber(value);
    worksheet.getCell(row, 6).numFmt = format;
    for (let column = 2; column <= 10; column += 1) applyCellBorder(worksheet.getCell(row, column));
  });

  let volumeRow = metricStart + metrics.length + 2;
  totals.volume_barang.forEach((item) => {
    worksheet.mergeCells(volumeRow, 2, volumeRow, 5);
    worksheet.getCell(volumeRow, 2).value = `Volume Barang (${item.satuan})`;
    worksheet.mergeCells(volumeRow, 6, volumeRow, 10);
    worksheet.getCell(volumeRow, 6).value = toNumber(item.volume);
    worksheet.getCell(volumeRow, 6).numFmt = NUMBER_FORMAT;
    for (let column = 2; column <= 10; column += 1) applyCellBorder(worksheet.getCell(volumeRow, column));
    volumeRow += 1;
  });

  if (model.warnings.length > 0) {
    worksheet.mergeCells(volumeRow + 1, 2, volumeRow + 1, 10);
    worksheet.getCell(volumeRow + 1, 2).value = `${model.warnings.length} peringatan kualitas data ditemukan. Lihat sheet Peringatan.`;
    worksheet.getCell(volumeRow + 1, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warning } };
    worksheet.getCell(volumeRow + 1, 2).font = { name: 'Arial', bold: true, color: { argb: COLORS.text } };
  }

  worksheet.views = [{ state: 'frozen', ySplit: 4 }];
  worksheet.headerFooter.oddFooter = '&LPT KAI Divre I Sumatera Utara&C&F&RHalaman &P dari &N';
  return worksheet;
};

const flattenRows = (model) => {
  const laporan = [];
  const kna = [];
  const penumpang = [];
  const barang = [];
  const keuangan = [];
  const transaksi = [];
  const spj = [];
  const invoice = [];

  model.reports.forEach((report) => {
    const base = {
      id_laporan: report.id,
      tanggal: report.tanggal,
      unit: report.unit?.nama || '-',
    };

    laporan.push({
      ...base,
      jenis_unit: report.unit?.jenis || '-',
      pembuat: report.pembuat?.nama || '-',
      status: report.status,
      status_internal: report.status_internal,
      sections: report.sections_present.join(', ') || '-',
      catatan: report.catatan || '',
      created_at: report.created_at,
      updated_at: report.updated_at,
    });

    const dataKna = report.sections.kna;
    if (dataKna) {
      kna.push({
        ...base,
        target_rkad: dataKna.target_rkad,
        realisasi_rkad: dataKna.realisasi_rkad,
        jml_kontrak_row: dataKna.row.jumlah_kontrak,
        luas_t_row: dataKna.row.luas_tanah,
        luas_b_row: dataKna.row.luas_bangunan,
        nilai_row: dataKna.row.nilai,
        jml_kontrak_non_row: dataKna.non_row.jumlah_kontrak,
        luas_t_non_row: dataKna.non_row.luas_tanah,
        luas_b_non_row: dataKna.non_row.luas_bangunan,
        nilai_non_row: dataKna.non_row.nilai,
      });
    }

    report.sections.penumpang.items.forEach((item) => penumpang.push({ ...base, ...item }));
    report.sections.barang.items.forEach((item) => barang.push({ ...base, ...item }));

    const finance = report.sections.keuangan;
    if (finance) {
      keuangan.push({
        ...base,
        target_rkad: finance.target_rkad,
        realisasi_rkad: finance.realisasi_rkad,
        pendapatan: finance.pendapatan,
        pengeluaran: finance.pengeluaran,
        laba_rugi: finance.laba_rugi,
      });

      finance.transaksi.forEach((item, index) => transaksi.push({
        ...base,
        nomor: index + 1,
        jenis: item?.jenis,
        uraian: item?.uraian,
        penerimaan: item?.penerimaan,
        pengeluaran: item?.pengeluaran,
        unit_kerja: item?.unit_kerja,
      }));
      finance.spj.forEach((item, index) => spj.push({
        ...base,
        nomor: index + 1,
        no_spj: item?.no_spj,
        tanggal_spj: item?.tanggal_spj,
        uraian: item?.uraian,
        nominal: item?.nominal,
        keterangan: item?.keterangan,
      }));
      finance.invoice.forEach((item, index) => invoice.push({
        ...base,
        nomor: index + 1,
        no_invoice: item?.no_invoice,
        tanggal_invoice: item?.tanggal_invoice,
        vendor: item?.vendor,
        nominal: item?.nominal,
        jatuh_tempo: item?.jatuh_tempo,
        status: item?.status,
        keterangan: item?.keterangan,
      }));
    }
  });

  return { laporan, kna, penumpang, barang, keuangan, transaksi, spj, invoice };
};

const renderExcel = async (model, { signal } = {}) => {
  if (signal?.aborted) throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RACHE - PT KAI Divre I Sumatera Utara';
  workbook.lastModifiedBy = model.meta.generated_by.nama;
  workbook.created = new Date(model.meta.generated_at);
  workbook.modified = new Date(model.meta.generated_at);
  workbook.company = 'PT Kereta Api Indonesia (Persero)';
  workbook.subject = `Ekspor ${model.meta.record_count} laporan operasional`;
  workbook.title = 'Ekspor Laporan Operasional RACHE';
  workbook.description = `Schema ${model.schema_version}; template ${model.template_version}`;
  workbook.calcProperties.fullCalcOnLoad = true;

  buildSummarySheet(workbook, model);
  const rows = flattenRows(model);

  const baseColumns = [
    { header: 'ID Laporan', key: 'id_laporan', width: 12, type: 'integer' },
    { header: 'Tanggal', key: 'tanggal', width: 17, type: 'date' },
    { header: 'Unit', key: 'unit', width: 28 },
  ];

  writeDataSheet(workbook, model, {
    name: 'Laporan', title: 'DAFTAR LAPORAN', rows: rows.laporan,
    columns: [
      ...baseColumns,
      { header: 'Jenis Unit', key: 'jenis_unit', width: 16 },
      { header: 'Pembuat', key: 'pembuat', width: 24 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Status Internal', key: 'status_internal', width: 18 },
      { header: 'Bagian Data', key: 'sections', width: 28 },
      { header: 'Catatan', key: 'catatan', width: 40 },
      { header: 'Dibuat', key: 'created_at', width: 22, type: 'datetime' },
      { header: 'Diperbarui', key: 'updated_at', width: 22, type: 'datetime' },
    ],
  });

  writeDataSheet(workbook, model, {
    name: 'KNA', title: 'DETAIL LAPORAN KNA', rows: rows.kna,
    columns: [
      ...baseColumns,
      { header: 'Target RKAD', key: 'target_rkad', width: 20, type: 'money' },
      { header: 'Realisasi RKAD', key: 'realisasi_rkad', width: 20, type: 'money' },
      { header: 'Kontrak ROW', key: 'jml_kontrak_row', width: 15, type: 'integer' },
      { header: 'Luas Tanah ROW', key: 'luas_t_row', width: 18, type: 'number' },
      { header: 'Luas Bangunan ROW', key: 'luas_b_row', width: 20, type: 'number' },
      { header: 'Nilai ROW', key: 'nilai_row', width: 20, type: 'money' },
      { header: 'Kontrak Non-ROW', key: 'jml_kontrak_non_row', width: 18, type: 'integer' },
      { header: 'Luas Tanah Non-ROW', key: 'luas_t_non_row', width: 22, type: 'number' },
      { header: 'Luas Bangunan Non-ROW', key: 'luas_b_non_row', width: 24, type: 'number' },
      { header: 'Nilai Non-ROW', key: 'nilai_non_row', width: 20, type: 'money' },
    ],
  });

  writeDataSheet(workbook, model, {
    name: 'Penumpang', title: 'DETAIL LAPORAN ANGKUTAN PENUMPANG', rows: rows.penumpang,
    columns: [
      ...baseColumns,
      { header: 'Nama KA', key: 'nama_ka', width: 24 },
      { header: 'No. KA', key: 'no_ka', width: 14 },
      { header: 'Lintas', key: 'lintas', width: 30 },
      { header: 'Berangkat', key: 'berangkat', width: 14 },
      { header: 'Kedatangan', key: 'kedatangan', width: 14 },
      { header: 'Jumlah Penumpang', key: 'jumlah_penumpang', width: 20, type: 'integer' },
      { header: 'Pendapatan', key: 'pendapatan', width: 20, type: 'money' },
    ],
  });

  writeDataSheet(workbook, model, {
    name: 'Barang', title: 'DETAIL LAPORAN ANGKUTAN BARANG', rows: rows.barang,
    columns: [
      ...baseColumns,
      { header: 'Komoditi', key: 'komoditi', width: 24 },
      { header: 'Satuan', key: 'satuan', width: 14 },
      { header: 'Jumlah KA', key: 'jumlah_ka', width: 14, type: 'integer' },
      { header: 'Volume', key: 'volume', width: 16, type: 'number' },
      { header: 'Volume Kumulatif', key: 'volume_kumulatif', width: 20, type: 'number' },
      { header: 'Program Volume', key: 'volume_program', width: 18, type: 'number' },
      { header: 'Pencapaian Volume', key: 'volume_pencapaian', width: 20, type: 'percent' },
      { header: 'Pendapatan', key: 'pendapatan', width: 20, type: 'money' },
      { header: 'Pendapatan Kumulatif', key: 'pendapatan_kumulatif', width: 23, type: 'money' },
      { header: 'Program Pendapatan', key: 'pendapatan_program', width: 22, type: 'money' },
      { header: 'Pencapaian Pendapatan', key: 'pendapatan_pencapaian', width: 24, type: 'percent' },
    ],
  });

  writeDataSheet(workbook, model, {
    name: 'Keuangan', title: 'RINGKASAN LAPORAN KEUANGAN', rows: rows.keuangan,
    columns: [
      ...baseColumns,
      { header: 'Target RKAD', key: 'target_rkad', width: 20, type: 'money' },
      { header: 'Realisasi RKAD', key: 'realisasi_rkad', width: 20, type: 'money' },
      { header: 'Pendapatan', key: 'pendapatan', width: 20, type: 'money' },
      { header: 'Pengeluaran', key: 'pengeluaran', width: 20, type: 'money' },
      { header: 'Laba/Rugi', key: 'laba_rugi', width: 20, type: 'money' },
    ],
  });

  writeDataSheet(workbook, model, {
    name: 'Transaksi', title: 'RINCIAN TRANSAKSI KEUANGAN', rows: rows.transaksi,
    columns: [
      ...baseColumns,
      { header: 'No.', key: 'nomor', width: 8, type: 'integer' },
      { header: 'Jenis', key: 'jenis', width: 18 },
      { header: 'Uraian', key: 'uraian', width: 40 },
      { header: 'Penerimaan', key: 'penerimaan', width: 20, type: 'money' },
      { header: 'Pengeluaran', key: 'pengeluaran', width: 20, type: 'money' },
      { header: 'Unit Kerja', key: 'unit_kerja', width: 24 },
    ],
  });

  writeDataSheet(workbook, model, {
    name: 'SPJ', title: 'RINCIAN SPJ', rows: rows.spj,
    columns: [
      ...baseColumns,
      { header: 'No.', key: 'nomor', width: 8, type: 'integer' },
      { header: 'No. SPJ', key: 'no_spj', width: 20 },
      { header: 'Tanggal SPJ', key: 'tanggal_spj', width: 18, type: 'date' },
      { header: 'Uraian', key: 'uraian', width: 40 },
      { header: 'Nominal', key: 'nominal', width: 20, type: 'money' },
      { header: 'Keterangan', key: 'keterangan', width: 32 },
    ],
  });

  writeDataSheet(workbook, model, {
    name: 'Invoice', title: 'RINCIAN INVOICE', rows: rows.invoice,
    columns: [
      ...baseColumns,
      { header: 'No.', key: 'nomor', width: 8, type: 'integer' },
      { header: 'No. Invoice', key: 'no_invoice', width: 20 },
      { header: 'Tanggal Invoice', key: 'tanggal_invoice', width: 20, type: 'date' },
      { header: 'Vendor', key: 'vendor', width: 28 },
      { header: 'Nominal', key: 'nominal', width: 20, type: 'money' },
      { header: 'Jatuh Tempo', key: 'jatuh_tempo', width: 18, type: 'date' },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Keterangan', key: 'keterangan', width: 32 },
    ],
  });

  if (model.warnings.length > 0) {
    writeDataSheet(workbook, model, {
      name: 'Peringatan', title: 'PERINGATAN KUALITAS DATA', orientation: 'portrait',
      rows: model.warnings.map((warning, index) => ({ nomor: index + 1, warning })),
      columns: [
        { header: 'No.', key: 'nomor', width: 8, type: 'integer' },
        { header: 'Peringatan', key: 'warning', width: 100 },
      ],
    });
  }

  if (signal?.aborted) throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);
  const buffer = await workbook.xlsx.writeBuffer();
  if (signal?.aborted) throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);
  return Buffer.from(buffer);
};

module.exports = {
  COLORS,
  describeFilters,
  flattenRows,
  renderExcel,
};
