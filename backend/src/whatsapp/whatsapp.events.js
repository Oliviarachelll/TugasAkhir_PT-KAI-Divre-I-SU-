'use strict';

const prisma = require('../config/database');
const { verifyToken } = require('../utils/jwt');
const { hasActiveLock } = require('../middlewares/auth.middleware');
const whatsappService = require('./baileys.service');
const { getNotificationQueueStats } = require('../services/notification.service');

const DASHBOARD_NAMESPACE = '/dashboard';
const DEFAULT_SESSION_REVALIDATE_MS = 60_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const ADMIN_ROLES = new Set(['IT', 'ADMIN_GLOBAL']);
const SOCKET_USER_SELECT = Object.freeze({
  id_pengguna: true,
  nama: true,
  email: true,
  peran: true,
  id_unit: true,
  terkunci: true,
  terkunci_sampai: true,
  session_version: true,
});
const WHATSAPP_STATES = new Set([
  'disabled',
  'connecting',
  'connected',
  'backoff',
  'logged_out',
  'stopping',
]);

class SocketAuthenticationError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'SocketAuthenticationError';
    this.data = { code: 'SOCKET_UNAUTHORIZED' };
  }
}

function parseBearer(value) {
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match ? match[1] : null;
}

function extractSocketToken(handshake = {}) {
  const authToken = handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return parseBearer(authToken) || (/^[^\s]+$/.test(authToken.trim()) ? authToken.trim() : null);
  }
  return parseBearer(handshake.headers?.authorization);
}

function sanitizeWhatsAppStatus(status = {}) {
  return {
    state: WHATSAPP_STATES.has(status.state) ? status.state : 'disabled',
    pairingRequired: Boolean(status.pairingRequired),
  };
}

function sanitizeQueueStats(stats = {}) {
  const fields = [
    'total',
    'pending',
    'processing',
    'retry',
    'accepted',
    'delivered',
    'failed',
    'expired',
    'due',
    'staleLocks',
  ];
  return Object.fromEntries(
    fields.map((field) => [
      field,
      Number.isSafeInteger(stats[field]) && stats[field] >= 0 ? stats[field] : 0,
    ])
  );
}

function isAuthorizedSocketUser(pengguna, sessionVersion, now = new Date()) {
  return Boolean(
    pengguna &&
    !hasActiveLock(pengguna, now) &&
    pengguna.session_version === sessionVersion &&
    (ADMIN_ROLES.has(pengguna.peran) || pengguna.peran === 'USER_UNIT') &&
    (pengguna.peran !== 'USER_UNIT' || Number.isSafeInteger(pengguna.id_unit))
  );
}

function resolveRevalidationInterval(value) {
  if (value === 0) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 1000
    ? parsed
    : DEFAULT_SESSION_REVALIDATE_MS;
}

function createSocketAuthMiddleware({
  prismaClient = prisma,
  verifyTokenFn = verifyToken,
  clock = () => new Date(),
} = {}) {
  return async (socket, next) => {
    try {
      const token = extractSocketToken(socket.handshake);
      if (!token) throw new SocketAuthenticationError();

      const decoded = verifyTokenFn(token);
      const currentTime = clock();
      const currentDate = currentTime instanceof Date ? currentTime : new Date(currentTime);
      const currentEpochSeconds = Math.floor(currentDate.getTime() / 1000);
      if (
        Number.isNaN(currentDate.getTime()) ||
        !Number.isSafeInteger(decoded?.id_pengguna) ||
        decoded.id_pengguna <= 0 ||
        !Number.isInteger(decoded.session_version) ||
        !Number.isSafeInteger(decoded.exp) ||
        decoded.exp <= currentEpochSeconds
      ) {
        throw new SocketAuthenticationError();
      }

      const pengguna = await prismaClient.pengguna.findUnique({
        where: { id_pengguna: decoded.id_pengguna },
        select: SOCKET_USER_SELECT,
      });

      if (!isAuthorizedSocketUser(pengguna, decoded.session_version, currentDate)) {
        throw new SocketAuthenticationError();
      }

      if (pengguna.terkunci) {
        const unlocked = await prismaClient.pengguna.updateMany({
          where: {
            id_pengguna: pengguna.id_pengguna,
            terkunci: true,
            terkunci_sampai: { lte: currentDate },
          },
          data: {
            terkunci: false,
            terkunci_sampai: null,
            percobaan_login: 0,
          },
        });
        if (unlocked.count !== 1) throw new SocketAuthenticationError();
        pengguna.terkunci = false;
        pengguna.terkunci_sampai = null;
      }

      socket.data = socket.data || {};
      socket.data.pengguna = pengguna;
      socket.data.authSession = {
        idPengguna: pengguna.id_pengguna,
        sessionVersion: pengguna.session_version,
        role: pengguna.peran,
        idUnit: pengguna.id_unit,
        expiresAtMs: decoded.exp * 1000,
      };
      return next();
    } catch (error) {
      return next(new SocketAuthenticationError());
    }
  };
}

function setupSocketEvents(io, options = {}) {
  const prismaClient = options.prismaClient || prisma;
  const getWhatsAppStatus =
    options.getWhatsAppStatus || (() => whatsappService.getStatus());
  const getQueueStats =
    options.getNotificationQueueStats ||
    (() => getNotificationQueueStats({ prismaClient }));
  const dashboard = io.of(DASHBOARD_NAMESPACE);
  const clock = options.clock || (() => new Date());
  const setTimeoutFn = options.setTimeoutFn || setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn || clearTimeout;
  const setIntervalFn = options.setIntervalFn || setInterval;
  const clearIntervalFn = options.clearIntervalFn || clearInterval;
  const sessionRevalidateMs = resolveRevalidationInterval(
    options.sessionRevalidateMs ?? process.env.SOCKET_SESSION_REVALIDATE_MS
  );

  dashboard.use(
    createSocketAuthMiddleware({
      prismaClient,
      verifyTokenFn: options.verifyTokenFn || verifyToken,
      clock,
    })
  );

  dashboard.on('connection', (socket) => {
    const pengguna = socket.data.pengguna;
    const authSession = socket.data.authSession;
    let expiryTimer = null;
    let revalidationTimer = null;
    let revalidationRunning = false;
    let closed = false;

    const cleanupSessionChecks = () => {
      if (expiryTimer !== null) clearTimeoutFn(expiryTimer);
      if (revalidationTimer !== null) clearIntervalFn(revalidationTimer);
      expiryTimer = null;
      revalidationTimer = null;
    };
    const disconnect = () => {
      if (closed) return;
      closed = true;
      cleanupSessionChecks();
      socket.disconnect(true);
    };
    const revalidateSession = async () => {
      if (closed || revalidationRunning) return;
      revalidationRunning = true;
      try {
        const currentTime = clock();
        const currentDate = currentTime instanceof Date ? currentTime : new Date(currentTime);
        if (
          Number.isNaN(currentDate.getTime()) ||
          currentDate.getTime() >= authSession.expiresAtMs
        ) {
          disconnect();
          return;
        }
        const current = await prismaClient.pengguna.findUnique({
          where: { id_pengguna: authSession.idPengguna },
          select: SOCKET_USER_SELECT,
        });
        if (
          !isAuthorizedSocketUser(current, authSession.sessionVersion, currentDate) ||
          current.peran !== authSession.role ||
          current.id_unit !== authSession.idUnit
        ) {
          disconnect();
        }
      } catch (error) {
        disconnect();
      } finally {
        revalidationRunning = false;
      }
    };

    socket.on('disconnect', () => {
      closed = true;
      cleanupSessionChecks();
    });

    const initialize = async () => {
      const currentTime = clock();
      const currentDate = currentTime instanceof Date ? currentTime : new Date(currentTime);
      const expiresInMs = authSession.expiresAtMs - currentDate.getTime();
      if (Number.isNaN(currentDate.getTime()) || expiresInMs <= 0) {
        disconnect();
        return;
      }

      expiryTimer = setTimeoutFn(disconnect, Math.min(expiresInMs, MAX_TIMEOUT_MS));
      expiryTimer?.unref?.();
      if (sessionRevalidateMs > 0) {
        revalidationTimer = setIntervalFn(() => {
          void revalidateSession();
        }, sessionRevalidateMs);
        revalidationTimer?.unref?.();
      }

      await socket.join(`user:${pengguna.id_pengguna}`);
      if (pengguna.peran === 'USER_UNIT') {
        await socket.join(`unit:${pengguna.id_unit}`);
        return;
      }

      await socket.join('admin');
      socket.emit('wa:status', sanitizeWhatsAppStatus(getWhatsAppStatus()));
      try {
        const queueStats = await getQueueStats();
        socket.emit('notification:queue-stats', sanitizeQueueStats(queueStats));
      } catch (error) {
        socket.emit('notification:queue-stats', sanitizeQueueStats());
      }
    };

    void initialize().catch(disconnect);
  });

  const emitWAStatus = (status) => {
    const source = status || getWhatsAppStatus();
    dashboard.to('admin').emit('wa:status', sanitizeWhatsAppStatus(source));
  };

  const emitPairingRequired = () => {
    const current = getWhatsAppStatus();
    emitWAStatus({ ...current, pairingRequired: true });
  };

  const emitNotificationQueueStats = (stats) => {
    dashboard
      .to('admin')
      .emit('notification:queue-stats', sanitizeQueueStats(stats));
  };

  const refreshNotificationQueueStats = async () => {
    const stats = await getQueueStats();
    emitNotificationQueueStats(stats);
    return sanitizeQueueStats(stats);
  };

  return {
    dashboard,
    emitLaporanBaru(laporan) {
      dashboard.to(`unit:${laporan.id_unit}`).emit('laporan:baru', laporan);
      dashboard.to('admin').emit('laporan:baru', laporan);
    },
    emitStatusLaporanUpdate(laporan) {
      dashboard.to(`unit:${laporan.id_unit}`).emit('laporan:status_update', laporan);
      dashboard.to('admin').emit('laporan:status_update', laporan);
    },
    emitPermintaanBaru(permintaan) {
      dashboard.to('admin').emit('permintaan:baru', permintaan);
    },
    emitWAStatus,
    emitPairingRequired,
    emitNotificationQueueStats,
    refreshNotificationQueueStats,
    disconnectUserSessions(idPengguna) {
      if (!Number.isSafeInteger(idPengguna) || idPengguna <= 0) return false;
      dashboard.in(`user:${idPengguna}`).disconnectSockets(true);
      return true;
    },
  };
}

module.exports = {
  DASHBOARD_NAMESPACE,
  DEFAULT_SESSION_REVALIDATE_MS,
  ADMIN_ROLES,
  SOCKET_USER_SELECT,
  SocketAuthenticationError,
  extractSocketToken,
  sanitizeWhatsAppStatus,
  sanitizeQueueStats,
  isAuthorizedSocketUser,
  resolveRevalidationInterval,
  createSocketAuthMiddleware,
  setupSocketEvents,
};
