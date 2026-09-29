const { z } = require('zod');

const STATUS_LAPORAN = ['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'REVISI'];
const MIN_EXPORT_YEAR = 2000;
const MAX_EXPORT_YEAR = 2100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const emptyToUndefined = (value) => (
  value === '' || value === null || value === undefined ? undefined : value
);

const isValidDateOnly = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < MIN_EXPORT_YEAR || year > MAX_EXPORT_YEAR) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isValidMonth = (value) => {
  if (!MONTH_PATTERN.test(value)) return false;
  const [year, month] = value.split('-').map(Number);
  return year >= MIN_EXPORT_YEAR && year <= MAX_EXPORT_YEAR && month >= 1 && month <= 12;
};

const normalizeUnitId = (value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined || typeof normalized === 'number') return normalized;
  if (typeof normalized === 'string' && /^\d+$/.test(normalized)) return Number(normalized);
  return normalized;
};

const optionalDate = z.preprocess(
  emptyToUndefined,
  z.string().refine(isValidDateOnly, 'Tanggal harus valid dengan format YYYY-MM-DD').optional()
);

const optionalMonth = z.preprocess(
  emptyToUndefined,
  z.string().refine(isValidMonth, 'Bulan harus valid dengan format YYYY-MM').optional()
);

const exportFiltersSchema = z.object({
  id_unit: z.preprocess(
    normalizeUnitId,
    z.number({ invalid_type_error: 'ID unit harus berupa bilangan bulat' })
      .int()
      .positive()
      .max(2147483647)
      .optional()
  ),
  status: z.preprocess(emptyToUndefined, z.enum(STATUS_LAPORAN).optional()),
  tanggal_mulai: optionalDate,
  tanggal_akhir: optionalDate,
  bulan: optionalMonth,
}).strict().superRefine((filters, ctx) => {
  if (filters.bulan && (filters.tanggal_mulai || filters.tanggal_akhir)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bulan'],
      message: 'Filter bulan tidak dapat digabungkan dengan rentang tanggal',
    });
  }

  if (filters.tanggal_mulai && filters.tanggal_akhir && filters.tanggal_mulai > filters.tanggal_akhir) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tanggal_akhir'],
      message: 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai',
    });
  }
});

const exportLaporanSchema = z.object({
  filters: exportFiltersSchema.optional().default({}),
}).strict();

module.exports = {
  STATUS_LAPORAN,
  MIN_EXPORT_YEAR,
  MAX_EXPORT_YEAR,
  exportFiltersSchema,
  exportLaporanSchema,
  isValidDateOnly,
  isValidMonth,
  normalizeUnitId,
};
