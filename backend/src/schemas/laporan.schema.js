'use strict';

/**
 * Zod Schemas: Laporan
 */
const { z } = require('zod');
const { getBusinessDate } = require('../services/business-time');
const { normalizeHumanToken } = require('../utils/security-token');

const StatusLaporanEnum = z.enum(['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'REVISI']);
const StatusInternalEnum = z.enum(['PENDING', 'DALAM_PROSES', 'SELESAI', 'DIBATALKAN']);
const UpdateStatusLaporanEnum = z.enum(['DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'REVISI']);

const positiveIdSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return Number(value);
    return value;
  },
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
);

const boundedIntegerSchema = (minimum, maximum) => z.preprocess(
  (value) => {
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
    return value;
  },
  z.number().int().min(minimum).max(maximum)
);

const optionalQueryValue = (schema) => z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  schema.optional()
);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD')
  .transform((value, context) => {
    try {
      const businessDate = getBusinessDate(value);
      return new Date(`${businessDate}T00:00:00.000Z`);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tanggal kalender tidak valid',
      });
      return z.NEVER;
    }
  });

const createLaporanSchema = z.object({
  tanggal: dateOnlySchema,
  kotak_detail: z.string().max(5000).optional().nullable(),
  id_unit: positiveIdSchema,
}).strict();

const updateLaporanSchema = z.object({
  tanggal: dateOnlySchema.optional(),
  status: UpdateStatusLaporanEnum.optional(),
  status_internal: StatusInternalEnum.optional(),
  kotak_detail: z.string().max(5000).optional().nullable(),
  id_unit: positiveIdSchema.optional(),
}).strict().refine(
  (value) => Object.keys(value).some((field) => field !== 'id_unit'),
  { message: 'Minimal satu field yang dapat diubah harus dikirim' }
);

const laporanListQuerySchema = z.object({
  status: optionalQueryValue(StatusLaporanEnum),
  id_unit: optionalQueryValue(positiveIdSchema),
  tahun: optionalQueryValue(boundedIntegerSchema(1900, 9999)),
  bulan: optionalQueryValue(boundedIntegerSchema(1, 12)),
  page: optionalQueryValue(boundedIntegerSchema(1, Number.MAX_SAFE_INTEGER)),
  limit: optionalQueryValue(boundedIntegerSchema(1, 500)),
}).strict();

const laporanIdParamsSchema = z.object({
  id: positiveIdSchema,
}).strict();

const laporanItemParamsSchema = z.object({
  id: positiveIdSchema,
  itemId: positiveIdSchema,
}).strict();

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
  id_komoditi: positiveIdSchema,
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
  tanggal: dateOnlySchema,
  kotak_detail: z.string().max(5000).optional().nullable(),
  status_internal: StatusInternalEnum.optional(),
  kna: laporanKNASchema.optional().nullable(),
  penumpangItems: z.array(laporanPenumpangSchema).optional(),
  barangItems: z.array(laporanBarangSchema).optional(),
  keuangan: laporanKeuanganSchema.optional().nullable(),
}).strict();

const unlockLaporanSchema = z.object({
  token: z.string().superRefine((value, context) => {
    try {
      normalizeHumanToken(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Token harus berisi tepat 16 karakter yang valid',
      });
    }
  }),
}).strict();

module.exports = {
  positiveIdSchema,
  dateOnlySchema,
  createLaporanSchema,
  updateLaporanSchema,
  laporanListQuerySchema,
  laporanIdParamsSchema,
  laporanItemParamsSchema,
  laporanKNASchema,
  laporanPenumpangSchema,
  laporanBarangSchema,
  laporanKeuanganSchema,
  resubmitLaporanSchema,
  unlockLaporanSchema,
};
