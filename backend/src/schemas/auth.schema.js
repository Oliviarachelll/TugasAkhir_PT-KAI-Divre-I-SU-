'use strict';

const { z } = require('zod');
const { normalizeHumanToken } = require('../utils/security-token');
const { normalizeIndonesianPhone } = require('../whatsapp/baileys.service');

const MAX_PASSWORD_BYTES = 72;
const MIN_NEW_PASSWORD_CHARACTERS = 10;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Format email tidak valid')
  .max(150, 'Email maksimal 150 karakter');

const passwordInputSchema = z
  .string()
  .min(1, 'Kata sandi wajib diisi')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES,
    `Kata sandi maksimal ${MAX_PASSWORD_BYTES} byte UTF-8`
  );

const newPasswordSchema = z
  .string()
  .refine((value) => Array.from(value).length >= MIN_NEW_PASSWORD_CHARACTERS, {
    message: `Kata sandi minimal ${MIN_NEW_PASSWORD_CHARACTERS} karakter`,
  })
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES,
    `Kata sandi maksimal ${MAX_PASSWORD_BYTES} byte UTF-8`
  );

const whatsappPhoneSchema = z
  .string()
  .trim()
  .min(1, 'Nomor WhatsApp wajib diisi')
  .max(40, 'Nomor WhatsApp terlalu panjang')
  .transform((value, context) => {
    try {
      return normalizeIndonesianPhone(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gunakan nomor Indonesia yang valid, contoh 081234567890',
      });
      return z.NEVER;
    }
  });

const optionalWhatsappPhoneSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  whatsappPhoneSchema.nullable().optional()
);

const humanTokenSchema = z.string().transform((value, context) => {
  try {
    return normalizeHumanToken(value);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Token harus berisi tepat 16 karakter Crockford uppercase',
    });
    return z.NEVER;
  }
});

const loginSchema = z
  .object({
    email: emailSchema,
    kata_sandi: passwordInputSchema,
  })
  .strict();

const resetPasswordRequestSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

const unlockRequestSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

const resetPasswordSchema = z
  .object({
    token: humanTokenSchema,
    kata_sandi_baru: newPasswordSchema,
  })
  .strict();

const gantiPasswordSchema = z
  .object({
    kata_sandi_lama: passwordInputSchema,
    kata_sandi_baru: newPasswordSchema,
  })
  .strict();

const updateWhatsappContactSchema = z
  .object({
    no_hp: whatsappPhoneSchema,
    kata_sandi: passwordInputSchema,
  })
  .strict();

module.exports = {
  MAX_PASSWORD_BYTES,
  MIN_NEW_PASSWORD_CHARACTERS,
  emailSchema,
  passwordInputSchema,
  newPasswordSchema,
  whatsappPhoneSchema,
  optionalWhatsappPhoneSchema,
  humanTokenSchema,
  loginSchema,
  resetPasswordRequestSchema,
  unlockRequestSchema,
  resetPasswordSchema,
  gantiPasswordSchema,
  updateWhatsappContactSchema,
};
