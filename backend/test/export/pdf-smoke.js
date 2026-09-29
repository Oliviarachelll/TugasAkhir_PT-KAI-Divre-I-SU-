const assert = require('node:assert/strict');
const { renderPdf, closePdfBrowser } = require('../../src/services/export/pdf.renderer');

const model = {
  schema_version: 'laporan-export.v1',
  template_version: '1.0.0',
  meta: {
    generated_at: new Date().toISOString(),
    timezone: 'Asia/Jakarta',
    locale: 'id-ID',
    generated_by: { id: 1, nama: 'Smoke Test', peran: 'ADMIN_GLOBAL' },
    filters: { unit_name: null },
    record_count: 1,
  },
  summary: {
    by_status: { DRAFT: 0, DIAJUKAN: 0, DISETUJUI: 1, DITOLAK: 0, REVISI: 0 },
    by_unit: [{ id: 3, nama: 'Unit Uji', jumlah_laporan: 1 }],
    domain_totals: {
      kna_nilai: 0,
      penumpang: 125,
      pendapatan_penumpang: 5000000,
      pendapatan_barang: 0,
      pendapatan_keuangan: 5000000,
      pengeluaran_keuangan: 2000000,
      laba_rugi_keuangan: 3000000,
      volume_barang: [],
    },
  },
  reports: [{
    id: 9001,
    tanggal: '2026-09-15',
    status: 'DISETUJUI',
    status_internal: 'SELESAI',
    catatan: 'Data smoke test PDF',
    unit: { id: 3, nama: 'Unit Uji', jenis: 'CABANG' },
    pembuat: { id: 7, nama: 'Pengguna Uji' },
    sections_present: ['PENUMPANG', 'KEUANGAN'],
    sections: {
      kna: null,
      penumpang: {
        items: [{
          id: 1,
          nama_ka: 'PUTRI DELI',
          no_ka: 'U75',
          lintas: 'Medan - Tanjungbalai',
          berangkat: '08:00',
          kedatangan: '12:00',
          jumlah_penumpang: 125,
          pendapatan: 5000000,
        }],
        totals: { jumlah_penumpang: 125, pendapatan: 5000000 },
      },
      barang: { items: [], totals_by_unit: [], total_pendapatan: 0, stored_summary: null },
      keuangan: {
        id: 1,
        target_rkad: 100000000,
        realisasi_rkad: 5000000,
        pendapatan: 5000000,
        pengeluaran: 2000000,
        laba_rugi: 3000000,
        transaksi: [{
          jenis: 'Penerimaan',
          uraian: 'Pendapatan smoke test',
          penerimaan: 5000000,
          pengeluaran: 0,
          unit_kerja: 'Keuangan',
        }],
        spj: [{
          no_spj: 'SPJ-001',
          tanggal_spj: '2026-09-15',
          uraian: 'SPJ smoke test',
          nominal: 2000000,
          keterangan: 'Lengkap',
        }],
        invoice: [{
          no_invoice: 'INV-001',
          tanggal_invoice: '2026-09-15',
          vendor: 'Vendor Uji',
          nominal: 1000000,
          jatuh_tempo: '2026-10-15',
          status: 'Belum Lunas',
          keterangan: '',
        }],
      },
    },
    created_at: '2026-09-15T01:00:00.000Z',
    updated_at: '2026-09-15T02:00:00.000Z',
    warnings: [],
  }],
  warnings: [],
};

(async () => {
  try {
    const buffer = await renderPdf(model);
    assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
    assert.ok(buffer.length > 1000);
    console.log(`PDF smoke test passed (${buffer.length} bytes)`);
  } finally {
    await closePdfBrowser();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
