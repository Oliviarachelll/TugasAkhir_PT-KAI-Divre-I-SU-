'use strict';

const prisma = require('../config/database');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { generateHumanToken } = require('../utils/security-token');
const {
  enqueueNotification,
  queuePasswordReset,
  queueRequestUpdate,
} = require('../services/notification.service');
const {
  WhatsAppInvalidPhoneError,
  normalizeIndonesianPhone,
} = require('../whatsapp/baileys.service');

const TOKEN_TTL_MS = 60 * 60 * 1000;
const IT_TICKET_TYPES = new Set(['BANTUAN_TEKNIS', 'PERMINTAAN_AKSES', 'LAINNYA']);
const TERMINAL_STATUSES = new Set(['SELESAI', 'DITOLAK']);
const ALLOWED_TRANSITIONS = Object.freeze({
  MENUNGGU: new Set(['DIPROSES', 'SELESAI', 'DITOLAK']),
  DIPROSES: new Set(['SELESAI', 'DITOLAK']),
  SELESAI: new Set(),
  DITOLAK: new Set(),
});

class PermintaanDomainError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'PermintaanDomainError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function fail(message, statusCode, code) {
  throw new PermintaanDomainError(message, statusCode, code);
}

function normalizeRecipientPhone(phone) {
  if (typeof phone !== 'string' || phone.trim() === '') return null;
  try {
    return normalizeIndonesianPhone(phone);
  } catch (error) {
    if (error instanceof WhatsAppInvalidPhoneError) return null;
    throw error;
  }
}

function canHandleTicket(role, jenis) {
  if (role === 'IT') return IT_TICKET_TYPES.has(jenis);
  if (role === 'ADMIN_GLOBAL') return jenis === 'KLARIFIKASI_DATA';
  return false;
}

function unitCategoryWhere(category) {
  const searchTerms = {
    KNA: ['KNA', 'Kontrak'],
    BARANG: ['Barang'],
    PENUMPANG: ['Penumpang'],
    KEUANGAN: ['Keuangan'],
  }[category];
  if (!searchTerms) return {};
  return {
    OR: searchTerms.map((term) => ({
      pengaju: {
        is: {
          unit: {
            is: { nama_unit: { contains: term } },
          },
        },
      },
    })),
  };
}

function assertTransitionAllowed(currentStatus, nextStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.has(nextStatus)) {
    fail('Transisi status permintaan tidak diizinkan', 409, 'INVALID_TICKET_TRANSITION');
  }
}

function assertClarificationReport(ticket) {
  const report = ticket.laporan;
  const requester = ticket.pengaju;
  if (!ticket.id_laporan || !report || !requester) {
    fail('Laporan klarifikasi tidak ditemukan', 409, 'CLARIFICATION_REPORT_MISSING');
  }
  if (
    report.id_laporan !== ticket.id_laporan ||
    report.id_pengguna !== ticket.id_pengguna_pengaju ||
    report.id_unit !== requester.id_unit
  ) {
    fail('Pemohon tidak berwenang untuk laporan ini', 403, 'CLARIFICATION_REPORT_FORBIDDEN');
  }
  if (report.status !== 'DISETUJUI') {
    fail(
      'Token klarifikasi hanya dapat diterbitkan untuk laporan DISETUJUI',
      409,
      'CLARIFICATION_REPORT_NOT_APPROVED'
    );
  }
  return report;
}

function publicDeliveryState(result) {
  return {
    state: result?.state || 'unknown',
    jobId: result?.jobId ?? null,
  };
}

function validClockDate(clock) {
  const value = clock();
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Permintaan clock returned an invalid date');
  return date;
}

async function runTransaction(client, callback, options) {
  if (typeof client.$transaction === 'function') {
    return options
      ? client.$transaction(callback, options)
      : client.$transaction(callback);
  }
  return callback(client);
}

function createPermintaanController(dependencies = {}) {
  const db = dependencies.prismaClient || prisma;
  const createHumanToken = dependencies.generateHumanTokenFn || generateHumanToken;
  const enqueue = dependencies.enqueueNotificationFn || enqueueNotification;
  const enqueuePasswordReset = dependencies.queuePasswordResetFn || queuePasswordReset;
  const enqueueRequestUpdate = dependencies.queueRequestUpdateFn || queueRequestUpdate;
  const normalizePhone = dependencies.normalizePhoneFn || normalizeRecipientPhone;
  const clock = dependencies.clock || (() => new Date());
  const now = () => validClockDate(clock);

  const getAllPermintaan = async (req, res) => {
    const { skip, take, page, limit } = parsePagination(req.query);
    const { status, unitCategory } = req.query;
    const where = {
      ...(status && { status }),
      ...unitCategoryWhere(unitCategory),
      ...(req.pengguna.peran === 'USER_UNIT' && {
        id_pengguna_pengaju: req.pengguna.id_pengguna,
      }),
      ...(req.pengguna.peran === 'IT' && {
        jenis: { in: Array.from(IT_TICKET_TYPES) },
      }),
      ...(req.pengguna.peran === 'ADMIN_GLOBAL' && {
        jenis: 'KLARIFIKASI_DATA',
      }),
    };

    const [data, total] = await db.$transaction([
      db.permintaanBantuan.findMany({
        where,
        skip,
        take,
        include: {
          pengaju: {
            select: {
              nama: true,
              unit: { select: { nama_unit: true } },
            },
          },
          penanggung: { select: { nama: true } },
          laporan: { select: { id_laporan: true, tanggal: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      db.permintaanBantuan.count({ where }),
    ]);

    return sendPaginated(res, data, buildPaginationMeta(total, page, limit));
  };

  const createPermintaan = async (req, res) => {
    if (Object.prototype.hasOwnProperty.call(req.body, 'token')) {
      return sendError(res, 'Token tidak boleh dikirim oleh klien', 422);
    }
    if (req.pengguna.peran !== 'USER_UNIT') {
      return sendError(res, 'Hanya USER_UNIT yang dapat membuat permintaan', 403);
    }

    try {
      const permintaan = await runTransaction(
        db,
        async (tx) => {
          const { jenis, deskripsi } = req.body;
          let reportId = null;

          if (jenis === 'KLARIFIKASI_DATA') {
            const report = await tx.laporan.findUnique({
              where: { id_laporan: req.body.id_laporan },
              select: {
                id_laporan: true,
                id_pengguna: true,
                id_unit: true,
                status: true,
              },
            });
            if (!report) {
              fail('Laporan tidak ditemukan', 404, 'REPORT_NOT_FOUND');
            }
            if (
              report.id_pengguna !== req.pengguna.id_pengguna ||
              report.id_unit !== req.pengguna.id_unit
            ) {
              fail('Laporan bukan milik pemohon', 403, 'REPORT_NOT_OWNED');
            }
            if (report.status !== 'DISETUJUI') {
              fail(
                'Klarifikasi hanya dapat diajukan untuk laporan DISETUJUI',
                409,
                'REPORT_NOT_APPROVED'
              );
            }
            reportId = report.id_laporan;
          }

          if (jenis === 'PERMINTAAN_AKSES') {
            const pending = await tx.permintaanBantuan.findFirst({
              where: {
                id_pengguna_pengaju: req.pengguna.id_pengguna,
                jenis: 'PERMINTAAN_AKSES',
                status: { in: ['MENUNGGU', 'DIPROSES'] },
              },
              select: { id_permintaan: true },
            });
            if (pending) {
              fail(
                'Permintaan akses aktif sudah ada',
                409,
                'DUPLICATE_PENDING_ACCESS_REQUEST'
              );
            }
          }

          return tx.permintaanBantuan.create({
            data: {
              jenis,
              deskripsi,
              id_laporan: reportId,
              id_pengguna_pengaju: req.pengguna.id_pengguna,
            },
          });
        },
        { isolationLevel: 'Serializable' }
      );

      return sendCreated(res, permintaan, 'Permintaan bantuan berhasil diajukan');
    } catch (error) {
      if (error instanceof PermintaanDomainError) {
        return sendError(res, error.message, error.statusCode);
      }
      if (error?.code === 'P2034' && req.body.jenis === 'PERMINTAAN_AKSES') {
        return sendError(res, 'Permintaan akses aktif sudah ada', 409);
      }
      throw error;
    }
  };

  const tanggapiPermintaan = async (req, res) => {
    if (Object.prototype.hasOwnProperty.call(req.body, 'token')) {
      return sendError(res, 'Token tidak boleh dikirim oleh klien', 422);
    }

    const ticketId = req.params.id;
    const nextStatus = req.body.status;
    const existing = await db.permintaanBantuan.findUnique({
      where: { id_permintaan: ticketId },
      include: {
        pengaju: {
          select: {
            id_pengguna: true,
            nama: true,
            no_hp: true,
            id_unit: true,
          },
        },
        laporan: {
          select: {
            id_laporan: true,
            id_pengguna: true,
            id_unit: true,
            status: true,
          },
        },
      },
    });

    if (!existing) return sendError(res, 'Tiket tidak ditemukan', 404);
    if (!canHandleTicket(req.pengguna.peran, existing.jenis)) {
      return sendError(res, 'Anda tidak berwenang menangani jenis tiket ini', 403);
    }

    try {
      assertTransitionAllowed(existing.status, nextStatus);
      const isAccessCompletion =
        nextStatus === 'SELESAI' && existing.jenis === 'PERMINTAAN_AKSES';
      const isClarificationCompletion =
        nextStatus === 'SELESAI' && existing.jenis === 'KLARIFIKASI_DATA';
      const requiresToken = isAccessCompletion || isClarificationCompletion;

      if (isClarificationCompletion) assertClarificationReport(existing);

      const canonicalPhone = normalizePhone(existing.pengaju?.no_hp);
      if (requiresToken && !canonicalPhone) {
        return sendError(
          res,
          'Nomor WhatsApp pemohon tidak valid untuk pengiriman token',
          422
        );
      }

      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + TOKEN_TTL_MS);
      const tokenBundle = requiresToken ? createHumanToken() : null;

      const result = await runTransaction(db, async (tx) => {
        const claimed = await tx.permintaanBantuan.updateMany({
          where: {
            id_permintaan: ticketId,
            jenis: existing.jenis,
            status: existing.status,
          },
          data: {
            status: nextStatus,
            id_pengguna_penanganan: req.pengguna.id_pengguna,
          },
        });
        if (claimed.count !== 1) {
          fail(
            'Status tiket telah berubah, muat ulang data',
            409,
            'TICKET_CONCURRENTLY_UPDATED'
          );
        }

        let delivery;
        if (isAccessCompletion) {
          await tx.tokenReset.updateMany({
            where: {
              id_pengguna: existing.id_pengguna_pengaju,
              sudah_dipakai: false,
            },
            data: {
              sudah_dipakai: true,
              used_at: issuedAt,
            },
          });
          const resetToken = await tx.tokenReset.create({
            data: {
              token: tokenBundle.tokenDigest,
              tujuan: 'RESET_PASSWORD',
              sudah_dipakai: false,
              attempt_count: 0,
              kedaluwarsa_pada: expiresAt,
              id_pengguna: existing.id_pengguna_pengaju,
            },
            select: { id_token_reset: true },
          });
          delivery = await enqueuePasswordReset({
            tx,
            dedupeKey: `password-reset:request:${ticketId}:token:${resetToken.id_token_reset}`,
            recipientName: existing.pengaju.nama,
            recipientPhone: canonicalPhone,
            token: tokenBundle.plainToken,
            expiresAt,
            metadata: {
              requestId: ticketId,
              tokenResetId: resetToken.id_token_reset,
              source: 'access_request',
            },
          });
        } else if (isClarificationCompletion) {
          const reportUpdated = await tx.laporan.updateMany({
            where: {
              id_laporan: existing.id_laporan,
              id_pengguna: existing.id_pengguna_pengaju,
              id_unit: existing.laporan.id_unit,
              status: 'DISETUJUI',
            },
            data: {
              token_revisi: tokenBundle.tokenDigest,
              token_revisi_exp: expiresAt,
            },
          });
          if (reportUpdated.count !== 1) {
            fail(
              'Laporan tidak lagi dapat menerima token klarifikasi',
              409,
              'CLARIFICATION_REPORT_CHANGED'
            );
          }

          const text =
            `🔐 *Token Klarifikasi Laporan*\n\n` +
            `Halo ${existing.pengaju.nama},\n\n` +
            `Gunakan token berikut untuk membuka laporan #${existing.id_laporan}:\n\n` +
            `*${tokenBundle.plainToken}*\n\n` +
            `⏰ Token berlaku selama *1 jam* dan hanya dapat digunakan satu kali.`;
          delivery = await enqueue({
            tx,
            dedupeKey: `report-clarification:${ticketId}`,
            jenis: 'REPORT_REVISION_REQUESTED',
            recipientName: existing.pengaju.nama,
            recipientPhone: canonicalPhone,
            text,
            metadata: {
              requestId: ticketId,
              reportId: existing.id_laporan,
              source: 'clarification_request',
            },
            expiresAt,
          });
        } else if (canonicalPhone) {
          delivery = await enqueueRequestUpdate({
            tx,
            dedupeKey: `request-status:${ticketId}:${nextStatus}`,
            recipientName: existing.pengaju.nama,
            recipientPhone: canonicalPhone,
            requestType: existing.jenis,
            status: nextStatus,
            metadata: {
              requestId: ticketId,
              handledBy: req.pengguna.id_pengguna,
            },
          });
        } else {
          delivery = { state: 'skipped', jobId: null };
        }

        const updated = await tx.permintaanBantuan.findUnique({
          where: { id_permintaan: ticketId },
          include: {
            pengaju: {
              select: {
                nama: true,
                unit: { select: { nama_unit: true } },
              },
            },
            penanggung: { select: { nama: true } },
            laporan: { select: { id_laporan: true, tanggal: true } },
          },
        });
        if (!updated) fail('Tiket tidak ditemukan', 404, 'TICKET_NOT_FOUND');

        return { ticket: updated, delivery: publicDeliveryState(delivery) };
      });

      return sendSuccess(
        res,
        { ...result.ticket, delivery: result.delivery },
        'Status permintaan berhasil diperbarui'
      );
    } catch (error) {
      if (error instanceof PermintaanDomainError) {
        return sendError(res, error.message, error.statusCode);
      }
      throw error;
    }
  };

  return { getAllPermintaan, createPermintaan, tanggapiPermintaan };
}

const controllers = createPermintaanController();

module.exports = {
  ...controllers,
  TOKEN_TTL_MS,
  IT_TICKET_TYPES,
  TERMINAL_STATUSES,
  ALLOWED_TRANSITIONS,
  PermintaanDomainError,
  normalizeRecipientPhone,
  canHandleTicket,
  unitCategoryWhere,
  assertTransitionAllowed,
  assertClarificationReport,
  createPermintaanController,
};
