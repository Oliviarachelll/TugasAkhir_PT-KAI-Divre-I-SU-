/**
 * Middleware: Global Error Handler
 * Menangkap semua error yang diteruskan via next(error)
 */
const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.name}: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return sendError(res, `Data dengan ${field} tersebut sudah ada.`, 409);
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return sendError(res, 'Data tidak ditemukan.', 404);
  }

  // Prisma foreign key constraint failed
  if (err.code === 'P2003') {
    return sendError(res, 'Referensi data tidak valid (foreign key).', 422);
  }

  // Zod validation error (jika tidak ditangani di middleware validate)
  if (err.name === 'ZodError') {
    return sendError(res, 'Validasi gagal', 422, err.errors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Token tidak valid', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token sudah kedaluwarsa', 401);
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan pada server'
      : err.message;

  return sendError(res, message, statusCode);
};

module.exports = errorHandler;
