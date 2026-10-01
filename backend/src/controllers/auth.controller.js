'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');
const {
  HumanTokenValidationError,
  generateHumanToken,
  hashHumanToken,
} = require('../utils/security-token');
const {
  queuePasswordReset,
  queuePasswordChanged,
} = require('../services/notification.service');
const { isValidIndonesianPhone } = require('../whatsapp/baileys.service');

const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const SECURITY_NOTIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  '$2a$12$dr7SEN3tPaSkb0EaA1SGv.bWg0HKdladks7w/I1UQ5QsAn69mLVve';
const GENERIC_LOGIN_MESSAGE = 'Email atau kata sandi salah';
const GENERIC_RESET_REQUEST_MESSAGE =
  'Jika email terdaftar dan dapat menerima pesan, instruksi reset akan dikirim.';
const GENERIC_UNLOCK_REQUEST_MESSAGE =
  'Jika akun memenuhi syarat, permintaan pembukaan kunci telah dikirim.';
const GENERIC_RESET_TOKEN_MESSAGE = 'Token tidak valid atau kedaluwarsa';

class ResetTokenRaceError extends Error {
  constructor() {
    super('Reset token is no longer redeemable');
    this.name = 'ResetTokenRaceError';
  }
}

function bcryptRounds() {
  const configured = Number.parseInt(process.env.BCRYPT_ROUNDS, 10);
  return Number.isInteger(configured) && configured >= 10 && configured <= 14
    ? configured
    : 12;
}

function activeLock(pengguna, now) {
  if (!pengguna?.terkunci) return false;
  if (!pengguna.terkunci_sampai) return true;
  return new Date(pengguna.terkunci_sampai).getTime() > now.getTime();
}

function disconnectUserSockets(req, idPengguna) {
  const socketEvents = req?.app?.get?.('socketEvents');
  if (typeof socketEvents?.disconnectUserSessions !== 'function') return false;
  return socketEvents.disconnectUserSessions(idPengguna);
}

function validDateFromClock(clock) {
  const value = clock();
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Auth clock returned an invalid date');
  return date;
}

async function runTransaction(client, callback, options) {
  if (typeof client.$transaction === 'function') {
    return client.$transaction(callback, options);
  }
  return callback(client);
}

async function invalidateUnusedResetTokens(tx, userId, usedAt) {
  return tx.tokenReset.updateMany({
    where: {
      id_pengguna: userId,
      sudah_dipakai: false,
    },
    data: {
      sudah_dipakai: true,
      used_at: usedAt,
    },
  });
}

function createAuthController(dependencies = {}) {
  const db = dependencies.prismaClient || prisma;
  const passwordService = dependencies.bcryptService || bcrypt;
  const issueJwt = dependencies.generateTokenFn || generateToken;
  const createHumanToken = dependencies.generateHumanTokenFn || generateHumanToken;
  const digestHumanToken = dependencies.hashHumanTokenFn || hashHumanToken;
  const enqueuePasswordReset = dependencies.queuePasswordResetFn || queuePasswordReset;
  const enqueuePasswordChanged = dependencies.queuePasswordChangedFn || queuePasswordChanged;
  const phoneIsValid = dependencies.isValidPhoneFn || isValidIndonesianPhone;
  const clock = dependencies.clock || (() => new Date());
  const logger = dependencies.logger || console;

  const now = () => validDateFromClock(clock);
  const logRecoveryFailure = (message) => {
    try {
      if (typeof logger?.error === 'function') logger.error(message);
    } catch {
      // Logging must never make account-recovery responses distinguishable.
    }
  };

  const rejectLogin = (res) => sendError(res, GENERIC_LOGIN_MESSAGE, 401);
  const rejectResetToken = (res) => sendError(res, GENERIC_RESET_TOKEN_MESSAGE, 400);

  async function clearExpiredLock(userId, currentTime) {
    return db.pengguna.updateMany({
      where: {
        id_pengguna: userId,
        terkunci: true,
        terkunci_sampai: { lte: currentTime },
      },
      data: {
        terkunci: false,
        terkunci_sampai: null,
        percobaan_login: 0,
      },
    });
  }

  async function recordFailedLogin(userId, currentTime) {
    return runTransaction(db, async (tx) => {
      const failed = await tx.pengguna.update({
        where: { id_pengguna: userId },
        data: { percobaan_login: { increment: 1 } },
        select: { percobaan_login: true },
      });

      if (failed.percobaan_login >= MAX_LOGIN_ATTEMPTS) {
        await tx.pengguna.update({
          where: { id_pengguna: userId },
          data: {
            terkunci: true,
            terkunci_sampai: new Date(currentTime.getTime() + LOGIN_LOCK_MS),
          },
        });
        return true;
      }
      return false;
    });
  }

  const login = async (req, res) => {
    const { email, kata_sandi } = req.body;
    const pengguna = await db.pengguna.findUnique({
      where: { email },
      include: { unit: { select: { nama_unit: true } } },
    });

    const passwordMatches = await passwordService.compare(
      kata_sandi,
      pengguna?.kata_sandi || DUMMY_PASSWORD_HASH
    );
    if (!pengguna) return rejectLogin(res);

    const currentTime = now();
    if (activeLock(pengguna, currentTime)) return rejectLogin(res);

    if (pengguna.terkunci) {
      await clearExpiredLock(pengguna.id_pengguna, currentTime);
      pengguna.percobaan_login = 0;
      pengguna.terkunci = false;
      pengguna.terkunci_sampai = null;
    }

    if (!passwordMatches) {
      const wasLocked = await recordFailedLogin(pengguna.id_pengguna, currentTime);
      if (wasLocked) disconnectUserSockets(req, pengguna.id_pengguna);
      return rejectLogin(res);
    }

    const unlocked = await db.pengguna.updateMany({
      where: {
        id_pengguna: pengguna.id_pengguna,
        OR: [
          { terkunci: false },
          { terkunci: true, terkunci_sampai: { lte: currentTime } },
        ],
      },
      data: {
        percobaan_login: 0,
        terkunci: false,
        terkunci_sampai: null,
      },
    });
    if (unlocked.count !== 1) return rejectLogin(res);

    const loginState = await db.pengguna.findUnique({
      where: { id_pengguna: pengguna.id_pengguna },
      select: { session_version: true },
    });
    if (!loginState) return rejectLogin(res);

    const token = issueJwt({
      id_pengguna: pengguna.id_pengguna,
      email: pengguna.email,
      peran: pengguna.peran,
      id_unit: pengguna.id_unit,
      session_version: loginState.session_version,
    });

    return sendSuccess(
      res,
      {
        token,
        pengguna: {
          id_pengguna: pengguna.id_pengguna,
          nama: pengguna.nama,
          email: pengguna.email,
          peran: pengguna.peran,
          no_hp: pengguna.no_hp,
          id_unit: pengguna.id_unit,
          unit: pengguna.unit,
        },
      },
      'Login berhasil'
    );
  };

  const getProfile = async (req, res) => {
    const pengguna = await db.pengguna.findUnique({
      where: { id_pengguna: req.pengguna.id_pengguna },
      select: {
        id_pengguna: true,
        nama: true,
        email: true,
        peran: true,
        no_hp: true,
        id_unit: true,
        created_at: true,
        unit: { select: { id_unit: true, nama_unit: true, jenis_unit: true } },
      },
    });
    return sendSuccess(res, pengguna, 'Profil berhasil diambil');
  };

  const updateWhatsappContact = async (req, res) => {
    const userId = req.pengguna.id_pengguna;
    const pengguna = await db.pengguna.findUnique({
      where: { id_pengguna: userId },
      select: {
        id_pengguna: true,
        kata_sandi: true,
        no_hp: true,
      },
    });
    if (!pengguna) return sendError(res, 'Sesi tidak valid. Silakan login ulang.', 401);

    const passwordMatches = await passwordService.compare(
      req.body.kata_sandi,
      pengguna.kata_sandi
    );
    if (!passwordMatches) return sendError(res, 'Kata sandi tidak sesuai', 400);

    const changedAt = now();
    const updated = await runTransaction(db, async (tx) => {
      const profile = await tx.pengguna.update({
        where: { id_pengguna: userId },
        data: { no_hp: req.body.no_hp },
        select: {
          id_pengguna: true,
          nama: true,
          email: true,
          peran: true,
          no_hp: true,
          id_unit: true,
          unit: { select: { id_unit: true, nama_unit: true, jenis_unit: true } },
        },
      });

      await invalidateUnusedResetTokens(tx, userId, changedAt);
      await tx.logAudit.create({
        data: {
          id_pengguna: userId,
          aksi: 'UPDATE_WHATSAPP_CONTACT',
          tabel_terkait: 'pengguna',
          id_record_terkait: userId,
          detail: JSON.stringify({
            source: 'self_service',
            contact_type: 'WHATSAPP',
            replaced_existing: Boolean(pengguna.no_hp),
          }),
        },
      });

      return profile;
    });

    return sendSuccess(res, updated, 'Nomor WhatsApp berhasil diperbarui');
  };

  const requestResetPassword = async (req, res) => {
    try {
      const tokenBundle = createHumanToken();
      const pengguna = await db.pengguna.findUnique({
        where: { email: req.body.email },
        select: {
          id_pengguna: true,
          nama: true,
          no_hp: true,
        },
      });

      if (pengguna && pengguna.no_hp && phoneIsValid(pengguna.no_hp)) {
        const issuedAt = now();
        const expiresAt = new Date(issuedAt.getTime() + RESET_TOKEN_TTL_MS);

        await runTransaction(db, async (tx) => {
          await invalidateUnusedResetTokens(tx, pengguna.id_pengguna, issuedAt);
          const tokenRecord = await tx.tokenReset.create({
            data: {
              token: tokenBundle.tokenDigest,
              tujuan: 'RESET_PASSWORD',
              sudah_dipakai: false,
              attempt_count: 0,
              kedaluwarsa_pada: expiresAt,
              id_pengguna: pengguna.id_pengguna,
            },
            select: { id_token_reset: true },
          });

          await enqueuePasswordReset({
            tx,
            dedupeKey: `password-reset:${tokenRecord.id_token_reset}`,
            recipientName: pengguna.nama,
            recipientPhone: pengguna.no_hp,
            token: tokenBundle.plainToken,
            expiresAt,
            metadata: { tokenResetId: tokenRecord.id_token_reset },
          });
        });
      }
    } catch (error) {
      // Deliberately return the same response for unknown users, invalid contact
      // data, and internal delivery setup failures to prevent account discovery.
      logRecoveryFailure('[Auth] Password reset request could not be queued.');
    }

    return sendSuccess(res, null, GENERIC_RESET_REQUEST_MESSAGE);
  };

  const requestUnlockTicket = async (req, res) => {
    try {
      const currentTime = now();
      await runTransaction(
        db,
        async (tx) => {
          const pengguna = await tx.pengguna.findUnique({
            where: { email: req.body.email },
            select: {
              id_pengguna: true,
              terkunci: true,
              terkunci_sampai: true,
            },
          });
          if (!pengguna) return;

          if (!activeLock(pengguna, currentTime)) {
            if (pengguna.terkunci) {
              await tx.pengguna.updateMany({
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
            }
            return;
          }

          const existingTicket = await tx.permintaanBantuan.findFirst({
            where: {
              id_pengguna_pengaju: pengguna.id_pengguna,
              jenis: 'PERMINTAAN_AKSES',
              status: { in: ['MENUNGGU', 'DIPROSES'] },
            },
            select: { id_permintaan: true },
          });
          if (existingTicket) return;

          await tx.permintaanBantuan.create({
            data: {
              jenis: 'PERMINTAAN_AKSES',
              deskripsi: 'Permintaan pembukaan akun yang sedang terkunci.',
              status: 'MENUNGGU',
              id_pengguna_pengaju: pengguna.id_pengguna,
            },
          });
        },
        { isolationLevel: 'Serializable' }
      );
    } catch (error) {
      // The response remains indistinguishable even if a concurrent request won.
      logRecoveryFailure('[Auth] Unlock request could not be processed.');
    }

    return sendSuccess(res, null, GENERIC_UNLOCK_REQUEST_MESSAGE);
  };

  const resetPassword = async (req, res) => {
    let tokenDigest;
    try {
      tokenDigest = digestHumanToken(req.body.token);
    } catch (error) {
      if (error instanceof HumanTokenValidationError || error?.code === 'INVALID_HUMAN_TOKEN') {
        return rejectResetToken(res);
      }
      throw error;
    }

    const [tokenRecord, passwordHash] = await Promise.all([
      db.tokenReset.findUnique({
        where: { token: tokenDigest },
        select: {
          id_token_reset: true,
          id_pengguna: true,
          tujuan: true,
          sudah_dipakai: true,
          kedaluwarsa_pada: true,
          pengguna: {
            select: {
              id_pengguna: true,
              nama: true,
              no_hp: true,
            },
          },
        },
      }),
      passwordService.hash(req.body.kata_sandi_baru, bcryptRounds()),
    ]);

    const currentTime = now();
    const recordIsUsable = Boolean(
      tokenRecord &&
        tokenRecord.tujuan === 'RESET_PASSWORD' &&
        !tokenRecord.sudah_dipakai &&
        new Date(tokenRecord.kedaluwarsa_pada).getTime() > currentTime.getTime()
    );

    if (!recordIsUsable) {
      if (tokenRecord) {
        await db.tokenReset.updateMany({
          where: { id_token_reset: tokenRecord.id_token_reset },
          data: { attempt_count: { increment: 1 } },
        });
      }
      return rejectResetToken(res);
    }

    try {
      await runTransaction(db, async (tx) => {
        const consumed = await tx.tokenReset.updateMany({
          where: {
            id_token_reset: tokenRecord.id_token_reset,
            token: tokenDigest,
            tujuan: 'RESET_PASSWORD',
            sudah_dipakai: false,
            kedaluwarsa_pada: { gt: currentTime },
          },
          data: {
            sudah_dipakai: true,
            used_at: currentTime,
            attempt_count: { increment: 1 },
          },
        });
        if (consumed.count !== 1) throw new ResetTokenRaceError();

        const updated = await tx.pengguna.update({
          where: { id_pengguna: tokenRecord.id_pengguna },
          data: {
            kata_sandi: passwordHash,
            session_version: { increment: 1 },
            percobaan_login: 0,
            terkunci: false,
            terkunci_sampai: null,
          },
          select: {
            id_pengguna: true,
            nama: true,
            no_hp: true,
            session_version: true,
          },
        });
        await invalidateUnusedResetTokens(tx, updated.id_pengguna, currentTime);

        if (updated.no_hp && phoneIsValid(updated.no_hp)) {
          await enqueuePasswordChanged({
            tx,
            dedupeKey: `password-changed:reset:${tokenRecord.id_token_reset}`,
            recipientName: updated.nama,
            recipientPhone: updated.no_hp,
            expiresAt: new Date(currentTime.getTime() + SECURITY_NOTIFICATION_TTL_MS),
            metadata: {
              source: 'password_reset',
              sessionVersion: updated.session_version,
            },
          });
        }
      });
    } catch (error) {
      if (error instanceof ResetTokenRaceError) return rejectResetToken(res);
      throw error;
    }

    disconnectUserSockets(req, tokenRecord.id_pengguna);
    return sendSuccess(res, null, 'Kata sandi berhasil direset. Silakan login.');
  };

  const gantiPassword = async (req, res) => {
    const pengguna = await db.pengguna.findUnique({
      where: { id_pengguna: req.pengguna.id_pengguna },
      select: {
        id_pengguna: true,
        nama: true,
        no_hp: true,
        kata_sandi: true,
      },
    });
    if (!pengguna) return sendError(res, 'Sesi tidak valid. Silakan login ulang.', 401);

    const passwordMatches = await passwordService.compare(
      req.body.kata_sandi_lama,
      pengguna.kata_sandi
    );
    if (!passwordMatches) return sendError(res, 'Kata sandi lama tidak sesuai', 400);

    const passwordHash = await passwordService.hash(
      req.body.kata_sandi_baru,
      bcryptRounds()
    );
    const changedAt = now();

    await runTransaction(db, async (tx) => {
      const updated = await tx.pengguna.update({
        where: { id_pengguna: pengguna.id_pengguna },
        data: {
          kata_sandi: passwordHash,
          session_version: { increment: 1 },
          percobaan_login: 0,
          terkunci: false,
          terkunci_sampai: null,
        },
        select: {
          id_pengguna: true,
          nama: true,
          no_hp: true,
          session_version: true,
        },
      });
      await invalidateUnusedResetTokens(tx, updated.id_pengguna, changedAt);

      if (updated.no_hp && phoneIsValid(updated.no_hp)) {
        await enqueuePasswordChanged({
          tx,
          dedupeKey: `password-changed:user:${updated.id_pengguna}:session:${updated.session_version}`,
          recipientName: updated.nama,
          recipientPhone: updated.no_hp,
          expiresAt: new Date(changedAt.getTime() + SECURITY_NOTIFICATION_TTL_MS),
          metadata: {
            source: 'self_service',
            sessionVersion: updated.session_version,
          },
        });
      }
    });

    disconnectUserSockets(req, pengguna.id_pengguna);
    return sendSuccess(
      res,
      null,
      'Kata sandi berhasil diubah. Silakan login kembali.'
    );
  };

  return {
    login,
    getProfile,
    updateWhatsappContact,
    requestResetPassword,
    requestUnlockTicket,
    resetPassword,
    gantiPassword,
  };
}

const controllers = createAuthController();

module.exports = {
  ...controllers,
  MAX_LOGIN_ATTEMPTS,
  LOGIN_LOCK_MS,
  RESET_TOKEN_TTL_MS,
  DUMMY_PASSWORD_HASH,
  GENERIC_LOGIN_MESSAGE,
  GENERIC_RESET_REQUEST_MESSAGE,
  GENERIC_UNLOCK_REQUEST_MESSAGE,
  GENERIC_RESET_TOKEN_MESSAGE,
  ResetTokenRaceError,
  activeLock,
  disconnectUserSockets,
  createAuthController,
};
