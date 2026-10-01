'use strict';

const { z } = require('zod');

const JenisPermintaanEnum = z.enum([
  'BANTUAN_TEKNIS',
  'KLARIFIKASI_DATA',
  'PERMINTAAN_AKSES',
  'LAINNYA',
]);
const StatusPermintaanEnum = z.enum(['MENUNGGU', 'DIPROSES', 'SELESAI', 'DITOLAK']);
const HandlerStatusEnum = z.enum(['DIPROSES', 'SELESAI', 'DITOLAK']);
const PermintaanUnitCategoryEnum = z.enum(['KNA', 'BARANG', 'PENUMPANG', 'KEUANGAN']);

const exactPositiveIdSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return Number(value);
    return value;
  },
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
);

const boundedQueryInteger = (minimum, maximum) =>
  z.preprocess(
    (value) => {
      if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) return Number(value);
      return value;
    },
    z.number().int().min(minimum).max(maximum)
  );

const optionalQuery = (schema) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    schema.optional()
  );

const deskripsiSchema = z
  .string()
  .trim()
  .min(10, 'Deskripsi minimal 10 karakter')
  .max(5000, 'Deskripsi maksimal 5000 karakter');

const clarificationCreateSchema = z
  .object({
    jenis: z.literal('KLARIFIKASI_DATA'),
    deskripsi: deskripsiSchema,
    id_laporan: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

function createNonReportSchema(jenis) {
  return z
    .object({
      jenis: z.literal(jenis),
      deskripsi: deskripsiSchema,
    })
    .strict();
}

const createPermintaanSchema = z.discriminatedUnion('jenis', [
  clarificationCreateSchema,
  createNonReportSchema('BANTUAN_TEKNIS'),
  createNonReportSchema('PERMINTAAN_AKSES'),
  createNonReportSchema('LAINNYA'),
]);

const tanggapiPermintaanSchema = z
  .object({
    status: HandlerStatusEnum,
  })
  .strict();

const permintaanIdParamsSchema = z
  .object({
    id: exactPositiveIdSchema,
  })
  .strict();

const permintaanListQuerySchema = z
  .object({
    status: optionalQuery(StatusPermintaanEnum),
    unitCategory: optionalQuery(PermintaanUnitCategoryEnum),
    page: optionalQuery(boundedQueryInteger(1, Number.MAX_SAFE_INTEGER)),
    limit: optionalQuery(boundedQueryInteger(1, 100)),
  })
  .strict();

module.exports = {
  JenisPermintaanEnum,
  StatusPermintaanEnum,
  HandlerStatusEnum,
  PermintaanUnitCategoryEnum,
  exactPositiveIdSchema,
  createPermintaanSchema,
  tanggapiPermintaanSchema,
  permintaanIdParamsSchema,
  permintaanListQuerySchema,
};
