'use strict';

const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const prisma = require('../config/database');

const SESSION_INVALID_MESSAGE = 'Sesi tidak valid. Silakan login ulang.';

function hasActiveLock(pengguna, now = new Date()) {
  if (!pengguna?.terkunci) return false;
  if (!pengguna.terkunci_sampai) return true;
  return new Date(pengguna.terkunci_sampai).getTime() > now.getTime();
}

function createAuthMiddleware({ prismaClient = prisma, verifyTokenFn = verifyToken, clock } = {}) {
  const now = typeof clock === 'function' ? clock : () => new Date();

  const authenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const match = typeof authHeader === 'string' ? /^Bearer\s+([^\s]+)$/.exec(authHeader) : null;
      if (!match) return sendError(res, 'Token autentikasi tidak ditemukan', 401);

      const decoded = verifyTokenFn(match[1]);
      const pengguna = await prismaClient.pengguna.findUnique({
        where: { id_pengguna: decoded.id_pengguna },
        select: {
          id_pengguna: true,
          nama: true,
          email: true,
          peran: true,
          terkunci: true,
          terkunci_sampai: true,
          session_version: true,
          id_unit: true,
        },
      });

      if (
        !pengguna ||
        !Number.isInteger(decoded.session_version) ||
        decoded.session_version !== pengguna.session_version
      ) {
        return sendError(res, SESSION_INVALID_MESSAGE, 401);
      }

      const currentTime = now();
      if (hasActiveLock(pengguna, currentTime)) {
        return sendError(res, 'Akun tidak dapat digunakan saat ini.', 403);
      }

      if (pengguna.terkunci) {
        await prismaClient.pengguna.updateMany({
          where: {
            id_pengguna: pengguna.id_pengguna,
            terkunci: true,
            terkunci_sampai: { lte: currentTime },
          },
          data: {
            terkunci: false,
            terkunci_sampai: null,
            percobaan_login: 0,
          },
        });
        pengguna.terkunci = false;
        pengguna.terkunci_sampai = null;
      }

      req.pengguna = pengguna;
      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return sendError(res, 'Token sudah kedaluwarsa. Silakan login ulang.', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        return sendError(res, SESSION_INVALID_MESSAGE, 401);
      }
      return next(error);
    }
  };

  return { authenticate };
}

const { authenticate } = createAuthMiddleware();

const authorize = (...roles) => (req, res, next) => {
  if (!req.pengguna) return sendError(res, 'Tidak terautentikasi', 401);
  if (!roles.includes(req.pengguna.peran)) {
    return sendError(res, `Akses ditolak. Hanya ${roles.join(', ')} yang diizinkan.`, 403);
  }
  return next();
};

module.exports = {
  SESSION_INVALID_MESSAGE,
  hasActiveLock,
  createAuthMiddleware,
  authenticate,
  authorize,
};
