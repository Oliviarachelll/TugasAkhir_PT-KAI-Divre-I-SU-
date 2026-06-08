/**
 * Middleware: JWT Authentication
 * Verifikasi token JWT dari Authorization header
 */
const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const prisma = require('../config/database');

/**
 * Middleware autentikasi — wajib login
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Token autentikasi tidak ditemukan', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Ambil data pengguna terbaru dari DB untuk cek status terkunci dll
    const pengguna = await prisma.pengguna.findUnique({
      where: { id_pengguna: decoded.id_pengguna },
      select: {
        id_pengguna: true,
        nama: true,
        email: true,
        peran: true,
        terkunci: true,
        id_unit: true,
      },
    });

    if (!pengguna) {
      return sendError(res, 'Pengguna tidak ditemukan', 401);
    }

    if (pengguna.terkunci) {
      return sendError(res, 'Akun Anda terkunci. Hubungi administrator.', 403);
    }

    req.pengguna = pengguna;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token sudah kedaluwarsa. Silakan login ulang.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 'Token tidak valid', 401);
    }
    next(error);
  }
};

/**
 * Middleware otorisasi berbasis peran (Role-Based Access Control)
 * @param {...string} roles - Peran yang diizinkan
 * @example authorize('ADMIN', 'MANAJER')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.pengguna) {
      return sendError(res, 'Tidak terautentikasi', 401);
    }

    if (!roles.includes(req.pengguna.peran)) {
      return sendError(
        res,
        `Akses ditolak. Hanya ${roles.join(', ')} yang diizinkan.`,
        403
      );
    }

    next();
  };
};

module.exports = { authenticate, authorize };
