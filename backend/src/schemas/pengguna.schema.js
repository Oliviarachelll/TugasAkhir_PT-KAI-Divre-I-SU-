/**
 * Zod Schemas: Pengguna
 */
const { z } = require('zod');

const PeranEnum = z.enum(['IT', 'ADMIN_GLOBAL', 'USER_UNIT']);

const createPenggunaSchema = z.object({
  nama: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Format email tidak valid'),
  kata_sandi: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  peran: PeranEnum.optional().default('USER_UNIT'),
  no_hp: z.string().max(20).optional().nullable(),
  id_unit: z.number().int().positive('ID unit harus bilangan positif'),
});

const updatePenggunaSchema = z.object({
  nama: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  peran: PeranEnum.optional(),
  no_hp: z.string().max(20).optional().nullable(),
  id_unit: z.number().int().positive().optional().nullable(),
  kata_sandi: z.string().min(6).optional(),
  terkunci: z.boolean().optional(),
});

module.exports = { createPenggunaSchema, updatePenggunaSchema };
