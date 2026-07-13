/**
 * Zod Schemas: Laporan
 */
const { z } = require('zod');

const StatusLaporanEnum = z.enum(['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'REVISI']);
const StatusInternalEnum = z.enum(['PENDING', 'DALAM_PROSES', 'SELESAI', 'DIBATALKAN']);

const createLaporanSchema = z.object({
  tanggal: z.string().transform((val) => new Date(val)),
  kotak_detail: z.string().optional().nullable(),
  id_unit: z.number().int().positive(),
});

const updateLaporanSchema = z.object({
  tanggal: z.string().transform((val) => new Date(val)).optional(),
  status: StatusLaporanEnum.optional(),
  status_internal: StatusInternalEnum.optional(),
  kotak_detail: z.string().optional().nullable(),
});

// Sub-laporan schemas
const laporanKNASchema = z.object({
  jml_kontrak_row: z.number().int().nonnegative().optional().nullable(),
  luas_t_row: z.number().nonnegative().optional().nullable(),
  luas_b_row: z.number().nonnegative().optional().nullable(),
  nilai_row: z.number().nonnegative().optional().nullable(),
  target_rkad: z.number().nonnegative().optional().nullable(),
  realisasi_rkad: z.number().nonnegative().optional().nullable(),
  jml_kontrak_non_row: z.number().int().nonnegative().optional().nullable(),
  luas_t_non_row: z.number().nonnegative().optional().nullable(),
  luas_b_non_row: z.number().nonnegative().optional().nullable(),
  nilai_non_row: z.number().nonnegative().optional().nullable(),
});

const laporanPenumpangSchema = z.object({
  nama_ka: z.string().min(1).max(150),
  jml_penumpang: z.number().int().nonnegative(),
  pendapatan: z.number().nonnegative(),
});

const laporanBarangSchema = z.object({
  jml_ka: z.number().int().nonnegative(),
  volume: z.number().nonnegative(),
  pendapatan: z.number().nonnegative(),
  id_komoditi: z.number().int().positive(),
  nama_kustom: z.string().max(100).optional().nullable(),
  volume_kumulatif: z.number().nonnegative().optional().nullable(),
  volume_program: z.number().nonnegative().optional().nullable(),
  volume_pencapaian: z.number().nonnegative().optional().nullable(),
  pendapatan_kumulatif: z.number().nonnegative().optional().nullable(),
  pendapatan_program: z.number().nonnegative().optional().nullable(),
  pendapatan_pencapaian: z.number().nonnegative().optional().nullable(),
});

const laporanKeuanganSchema = z.object({
  target_rkad: z.number().nonnegative().optional().nullable(),
  realisasi_rkad: z.number().nonnegative().optional().nullable(),
  pendapatan: z.number().nonnegative(),
  pengeluaran: z.number().nonnegative(),
  rincian_transaksi: z.string().optional().nullable(),
  rincian_spj: z.string().optional().nullable(),
  rincian_invoice: z.string().optional().nullable(),
});

module.exports = {
  createLaporanSchema,
  updateLaporanSchema,
  laporanKNASchema,
  laporanPenumpangSchema,
  laporanBarangSchema,
  laporanKeuanganSchema,
};
