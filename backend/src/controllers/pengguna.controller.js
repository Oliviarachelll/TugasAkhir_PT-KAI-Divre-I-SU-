'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { queuePasswordChanged } = require('../services/notification.service');
const { isValidIndonesianPhone } = require('../whatsapp/baileys.service');

const SECURITY_NOTIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function bcryptRounds() {
  const configured = Number.parseInt(process.env.BCRYPT_ROUNDS, 10);
  return Number.isInteger(configured) && configured >= 10 && configured <= 14
    ? configured
    : 12;
}

function parsePositiveId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === String(value)
    ? parsed
    : null;
}

function disconnectUserSockets(req, idPengguna) {
  const socketEvents = req?.app?.get?.('socketEvents');
  if (typeof socketEvents?.disconnectUserSessions !== 'function') return false;
  return socketEvents.disconnectUserSessions(idPengguna);
}

async function runTransaction(client, callback) {
  if (typeof client.$transaction === 'function') return client.$transaction(callback);
  return callback(client);
}

async function invalidateUnusedResetTokens(tx, userId, usedAt) {
  return tx.tokenReset.updateMany({
    where: { id_pengguna: userId, sudah_dipakai: false },
    data: { sudah_dipakai: true, used_at: usedAt },
  });
}

function createPenggunaController(dependencies = {}) {
  const db = dependencies.prismaClient || prisma;
  const passwordService = dependencies.bcryptService || bcrypt;
  const enqueuePasswordChanged = dependencies.queuePasswordChangedFn || queuePasswordChanged;
  const phoneIsValid = dependencies.isValidPhoneFn || isValidIndonesianPhone;
  const clock = dependencies.clock || (() => new Date());
  const now = () => {
    const value = clock();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('Pengguna clock returned an invalid date');
    return date;
  };

  const getAllPengguna = async (req, res) => {
    const { skip, take, page, limit } = parsePagination(req.query);
    const { search, peran, id_unit, status, terkunci } = req.query;

    const parsedIdUnit = id_unit ? Number.parseInt(id_unit, 10) : null;
    let terkunciCondition;
    if (terkunci !== undefined && terkunci !== '') {
      terkunciCondition = terkunci === 'true' || terkunci === true;
    } else if (status === 'terkunci' || status === 'locked') {
      terkunciCondition = true;
    } else if (status === 'aktif' || status === 'active') {
      terkunciCondition = false;
    }

    const where = {
      ...(search && {
        OR: [
          { nama: { contains: search } },
          { email: { contains: search } },
          { no_hp: { contains: search } },
        ],
      }),
      ...(peran && peran !== 'ALL' && { peran }),
      ...(Number.isInteger(parsedIdUnit) && parsedIdUnit > 0 && { id_unit: parsedIdUnit }),
      ...(terkunciCondition !== undefined && { terkunci: terkunciCondition }),
    };

    const [data, total] = await db.$transaction([
      db.pengguna.findMany({
        where,
        skip,
        take,
        select: {
          id_pengguna: true,
          nama: true,
          email: true,
          peran: true,
          no_hp: true,
          terkunci: true,
          percobaan_login: true,
          created_at: true,
          unit: { select: { id_unit: true, nama_unit: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      db.pengguna.count({ where }),
    ]);
    return sendPaginated(res, data, buildPaginationMeta(total, page, limit));
  };

  const getPenggunaById = async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return sendError(res, 'ID pengguna tidak valid', 422);

    const pengguna = await db.pengguna.findUnique({
      where: { id_pengguna: id },
      select: {
        id_pengguna: true,
        nama: true,
        email: true,
        peran: true,
        no_hp: true,
        terkunci: true,
        percobaan_login: true,
        created_at: true,
        updated_at: true,
        unit: { select: { id_unit: true, nama_unit: true, jenis_unit: true } },
      },
    });
    if (!pengguna) return sendError(res, 'Pengguna tidak ditemukan', 404);
    return sendSuccess(res, pengguna);
  };

  const createPengguna = async (req, res) => {
    const { kata_sandi, ...rest } = req.body;
    const unit = await db.unit.findUnique({ where: { id_unit: rest.id_unit } });
    if (!unit) return sendError(res, 'Unit tidak ditemukan', 404);

    const passwordHash = await passwordService.hash(kata_sandi, bcryptRounds());
    const pengguna = await db.pengguna.create({
      data: { ...rest, kata_sandi: passwordHash },
      select: {
        id_pengguna: true,
        nama: true,
        email: true,
        peran: true,
        no_hp: true,
        created_at: true,
      },
    });
    return sendCreated(res, pengguna, 'Pengguna berhasil dibuat');
  };

  const updatePengguna = async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return sendError(res, 'ID pengguna tidak valid', 422);

    const existing = await db.pengguna.findUnique({ where: { id_pengguna: id } });
    if (!existing) return sendError(res, 'Pengguna tidak ditemukan', 404);

    const changedAt = now();
    const updateData = { ...req.body };
    const passwordChanged = Object.prototype.hasOwnProperty.call(updateData, 'kata_sandi');
    if (passwordChanged) {
      updateData.kata_sandi = await passwordService.hash(
        updateData.kata_sandi,
        bcryptRounds()
      );
    }

    if (updateData.terkunci === false) {
      updateData.percobaan_login = 0;
      updateData.terkunci_sampai = null;
    } else if (updateData.terkunci === true) {
      updateData.terkunci_sampai = null;
    }
    updateData.session_version = { increment: 1 };

    const pengguna = await runTransaction(db, async (tx) => {
      const updated = await tx.pengguna.update({
        where: { id_pengguna: id },
        data: updateData,
        select: {
          id_pengguna: true,
          nama: true,
          email: true,
          peran: true,
          no_hp: true,
          terkunci: true,
          session_version: true,
          updated_at: true,
        },
      });

      await invalidateUnusedResetTokens(tx, id, changedAt);

      if (Object.prototype.hasOwnProperty.call(req.body, 'terkunci')) {
        await tx.logAudit.create({
          data: {
            id_pengguna: req.pengguna.id_pengguna,
            aksi: req.body.terkunci ? 'LOCK_PENGGUNA' : 'UNLOCK_PENGGUNA',
            tabel_terkait: 'pengguna',
            id_record_terkait: id,
            detail: JSON.stringify({
              source: 'admin_update',
              terkunci_sebelum: existing.terkunci,
              terkunci_sesudah: req.body.terkunci,
              session_version: updated.session_version,
            }),
          },
        });
      }

      if (req.body.terkunci === false) {
        await tx.permintaanBantuan.updateMany({
          where: {
            id_pengguna_pengaju: id,
            jenis: 'PERMINTAAN_AKSES',
            status: { in: ['MENUNGGU', 'DIPROSES'] },
          },
          data: {
            status: 'SELESAI',
            id_pengguna_penanganan: req.pengguna.id_pengguna,
          },
        });
      }

      if (passwordChanged && updated.no_hp && phoneIsValid(updated.no_hp)) {
        await enqueuePasswordChanged({
          tx,
          dedupeKey: `password-changed:admin:${id}:session:${updated.session_version}`,
          recipientName: updated.nama,
          recipientPhone: updated.no_hp,
          expiresAt: new Date(changedAt.getTime() + SECURITY_NOTIFICATION_TTL_MS),
          metadata: {
            source: 'admin_update',
            changedBy: req.pengguna.id_pengguna,
            sessionVersion: updated.session_version,
          },
        });
      }

      return updated;
    });

    const { session_version: omittedSessionVersion, ...responseData } = pengguna;
    disconnectUserSockets(req, id);
    return sendSuccess(res, responseData, 'Pengguna berhasil diperbarui');
  };

  const deletePengguna = async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return sendError(res, 'ID pengguna tidak valid', 422);
    if (id === req.pengguna.id_pengguna) {
      return sendError(res, 'Tidak dapat menghapus akun sendiri', 400);
    }

    const existing = await db.pengguna.findUnique({ where: { id_pengguna: id } });
    if (!existing) return sendError(res, 'Pengguna tidak ditemukan', 404);
    await db.pengguna.delete({ where: { id_pengguna: id } });
    disconnectUserSockets(req, id);
    return sendSuccess(res, null, 'Pengguna berhasil dihapus');
  };

  const unlockPengguna = async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return sendError(res, 'ID pengguna tidak valid', 422);

    const existing = await db.pengguna.findUnique({
      where: { id_pengguna: id },
      select: {
        id_pengguna: true,
        terkunci: true,
        terkunci_sampai: true,
      },
    });
    if (!existing) return sendError(res, 'Pengguna tidak ditemukan', 404);

    const unlockedAt = now();
    await runTransaction(db, async (tx) => {
      const updated = await tx.pengguna.update({
        where: { id_pengguna: id },
        data: {
          terkunci: false,
          terkunci_sampai: null,
          percobaan_login: 0,
          session_version: { increment: 1 },
        },
        select: { session_version: true },
      });

      await invalidateUnusedResetTokens(tx, id, unlockedAt);
      await tx.permintaanBantuan.updateMany({
        where: {
          id_pengguna_pengaju: id,
          jenis: 'PERMINTAAN_AKSES',
          status: { in: ['MENUNGGU', 'DIPROSES'] },
        },
        data: {
          status: 'SELESAI',
          id_pengguna_penanganan: req.pengguna.id_pengguna,
        },
      });
      await tx.logAudit.create({
        data: {
          id_pengguna: req.pengguna.id_pengguna,
          aksi: 'UNLOCK_PENGGUNA',
          tabel_terkait: 'pengguna',
          id_record_terkait: id,
          detail: JSON.stringify({
            source: 'admin_unlock',
            terkunci_sebelum: existing.terkunci,
            terkunci_sampai_sebelum: existing.terkunci_sampai,
            session_version: updated.session_version,
          }),
        },
      });
    });

    disconnectUserSockets(req, id);
    return sendSuccess(res, null, 'Akun berhasil dibuka kuncinya');
  };

  return {
    getAllPengguna,
    getPenggunaById,
    createPengguna,
    updatePengguna,
    deletePengguna,
    unlockPengguna,
  };
}

const controllers = createPenggunaController();

module.exports = {
  ...controllers,
  SECURITY_NOTIFICATION_TTL_MS,
  parsePositiveId,
  disconnectUserSockets,
  createPenggunaController,
};
