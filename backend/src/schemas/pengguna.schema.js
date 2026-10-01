'use strict';

const { z } = require('zod');
const {
  newPasswordSchema,
  optionalWhatsappPhoneSchema,
} = require('./auth.schema');

const PeranEnum = z.enum(['IT', 'ADMIN_GLOBAL', 'USER_UNIT']);
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Format email tidak valid')
  .max(150, 'Email maksimal 150 karakter');

const createPenggunaSchema = z
  .object({
    nama: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
    email: emailSchema,
    kata_sandi: newPasswordSchema,
    peran: PeranEnum.optional().default('USER_UNIT'),
    no_hp: optionalWhatsappPhoneSchema,
    id_unit: z.number().int().positive('ID unit harus bilangan positif'),
  })
  .strict();

const updatePenggunaSchema = z
  .object({
    nama: z.string().trim().min(2).max(100).optional(),
    email: emailSchema.optional(),
    peran: PeranEnum.optional(),
    no_hp: optionalWhatsappPhoneSchema,
    id_unit: z.number().int().positive().optional().nullable(),
    kata_sandi: newPasswordSchema.optional(),
    terkunci: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Minimal satu field harus diperbarui',
  });

module.exports = {
  PeranEnum,
  createPenggunaSchema,
  updatePenggunaSchema,
};
