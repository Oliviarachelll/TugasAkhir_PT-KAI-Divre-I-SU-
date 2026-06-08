/**
 * Zod Schemas: Auth
 */
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  kata_sandi: z.string().min(6, 'Kata sandi minimal 6 karakter'),
});

const resetPasswordRequestSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi'),
  kata_sandi_baru: z.string().min(6, 'Kata sandi minimal 6 karakter'),
});

const gantiPasswordSchema = z.object({
  kata_sandi_lama: z.string().min(1, 'Kata sandi lama wajib diisi'),
  kata_sandi_baru: z.string().min(6, 'Kata sandi baru minimal 6 karakter'),
});

module.exports = {
  loginSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  gantiPasswordSchema,
};
