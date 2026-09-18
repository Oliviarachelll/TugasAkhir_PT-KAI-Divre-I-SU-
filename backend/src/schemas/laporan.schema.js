/**
 * Zod Schemas: Laporan
 */
const { z } = require('zod');

const StatusLaporanEnum = z.enum(['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'REVISI']);
const StatusInternalEnum = z.enum(['PENDING', 'DALAM_PROSES', 'SELESAI', 'DIBATALKAN']);

const createLaporanSchema = z.object({
  tanggal: z.string().transform((val) => new Date(val)),
  kotak_detail: z.string().optional().nullable(),
  id_unit: z.coerce.number().int().positive(),
});

const updateLaporanSchema = z.object({
  tanggal: z.string().transform((val) => new Date(val)).optional(),
  status: StatusLaporanEnum.optional(),
  status_internal: StatusInternalEnum.optional(),
  kotak_detail: z.string().optional().nullable(),
});

// Sub-laporan schemas
const laporanKNASchema = z.object({
  jml_kontrak_row: z.coerce.number().int().nonnegative().optional().nullable(),
  luas_t_row: z.coerce.number().nonnegative().optional().nullable(),
  luas_b_row: z.coerce.number().nonnegative().optional().nullable(),
  nilai_row: z.coerce.number().nonnegative().optional().nullable(),
  target_rkad: z.coerce.number().nonnegative().optional().nullable(),
  realisasi_rkad: z.coerce.number().nonnegative().optional().nullable(),
  jml_kontrak_non_row: z.coerce.number().int().nonnegative().optional().nullable(),
  luas_t_non_row: z.coerce.number().nonnegative().optional().nullable(),
  luas_b_non_row: z.coerce.number().nonnegative().optional().nullable(),
  nilai_non_row: z.coerce.number().nonnegative().optional().nullable(),
});

const laporanPenumpangSchema = z.object({
  nama_ka: z.string().min(1).max(150),
  no_ka: z.string().max(50).optional().nullable(),
  lintas: z.string().max(100).optional().nullable(),
  berangkat: z.string().max(50).optional().nullable(),
  kedatangan: z.string().max(50).optional().nullable(),
  jml_penumpang: z.coerce.number().int().nonnegative(),
  pendapatan: z.coerce.number().nonnegative(),
});

const laporanBarangSchema = z.object({
  jml_ka: z.coerce.number().int().nonnegative(),
  volume: z.coerce.number().nonnegative(),
  pendapatan: z.coerce.number().nonnegative(),
  id_komoditi: z.coerce.number().int().positive(),
  nama_kustom: z.string().max(100).optional().nullable(),
  volume_kumulatif: z.coerce.number().nonnegative().optional().nullable(),
  volume_program: z.coerce.number().nonnegative().optional().nullable(),
  volume_pencapaian: z.coerce.number().nonnegative().optional().nullable(),
  pendapatan_kumulatif: z.coerce.number().nonnegative().optional().nullable(),
  pendapatan_program: z.coerce.number().nonnegative().optional().nullable(),
  pendapatan_pencapaian: z.coerce.number().nonnegative().optional().nullable(),
});

const laporanKeuanganSchema = z.object({
  target_rkad: z.coerce.number().nonnegative().optional().nullable(),
  realisasi_rkad: z.coerce.number().nonnegative().optional().nullable(),
  pendapatan: z.coerce.number().nonnegative(),
  pengeluaran: z.coerce.number().nonnegative(),
  rincian_transaksi: z.string().optional().nullable(),
  rincian_spj: z.string().optional().nullable(),
  rincian_invoice: z.string().optional().nullable(),
});

const resubmitLaporanSchema = z.object({
  tanggal: z.string().min(1),
  kotak_detail: z.string().optional().nullable(),
  status_internal: StatusInternalEnum.optional(),
  kna: laporanKNASchema.optional().nullable(),
  penumpangItems: z.array(laporanPenumpangSchema).optional(),
  barangItems: z.array(laporanBarangSchema).optional(),
  keuangan: laporanKeuanganSchema.optional().nullable(),
});

module.exports = {
  createLaporanSchema,
  updateLaporanSchema,
  laporanKNASchema,
  laporanPenumpangSchema,
  laporanBarangSchema,
  laporanKeuanganSchema,
  resubmitLaporanSchema,
};
