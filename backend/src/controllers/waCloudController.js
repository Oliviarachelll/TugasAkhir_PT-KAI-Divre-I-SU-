'use strict';

const QRCode = require('qrcode');
const prisma = require('../config/database');
const whatsappService = require('../whatsapp/baileys.service');
const reminderService = require('../services/reminder.service');
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUSES,
  getNotificationQueueStats,
} = require('../services/notification.service');
const {
  getBusinessDate,
  startOfBusinessDayUtc,
} = require('../services/business-time');
const { sendSuccess, sendError } = require('../utils/response');
const { buildPaginationMeta } = require('../utils/pagination');

const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_STATUSES = new Set(['ACCEPTED', 'DELIVERED', 'FAILED', 'EXPIRED']);

function resolveContactId() {
  throw new Error('Meta webhook deprecated: gunakan notification outbox');
}

function handleControllerError(res, error, fallbackMessage) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const message = statusCode < 500 && error?.message ? error.message : fallbackMessage;
  return sendError(res, message, statusCode);
}

function sendQueueOutcome(res, result, successMessage) {
  const accepted = Number(result.queued || 0) + Number(result.duplicate || 0);
  if (accepted === 0) {
    if (Number(result.failed || 0) > 0) {
      return sendError(
        res,
        'Semua notifikasi gagal diantrikan',
        503,
        result
      );
    }
    return sendError(
      res,
      'Tidak ada penerima valid untuk diantrikan',
      422,
      result
    );
  }

  const partial = Number(result.failed || 0) > 0 || Number(result.skipped || 0) > 0;
  return sendSuccess(
    res,
    result,
    partial ? `${successMessage} dengan sebagian penerima dilewati` : successMessage,
    partial ? 207 : 202
  );
}

function redactPhone(phone) {
  if (typeof phone !== 'string' || phone.length === 0) return null;
  if (phone.length <= 6) return '*'.repeat(phone.length);
  return `${phone.slice(0, 2)}${'*'.repeat(Math.max(3, phone.length - 6))}${phone.slice(-4)}`;
}

const sendBroadcast = async (req, res) => {
  try {
    const result = await reminderService.broadcastBaileys({
      ...req.body,
      source: 'manual',
    });
    return sendQueueOutcome(res, result, 'Broadcast berhasil diantrikan');
  } catch (error) {
    return handleControllerError(res, error, 'Gagal mengantrikan broadcast');
  }
};

const verifyWebhook = (req, res) => sendError(
  res,
  'Meta webhook deprecated: gunakan notification outbox',
  410
);

const handleWebhook = async (req, res) => sendError(
  res,
  'Meta webhook deprecated: gunakan notification outbox',
  410
);

const createTemplate = async (req, res) => {
  try {
    const { name, body, trigger, unit, tipe_notifikasi } = req.body;
    const templateName = name.toLocaleLowerCase('id-ID').replace(/\s+/g, '_');
    const template = await prisma.konfigurasiTemplate.upsert({
      where: { nama_template: templateName },
      update: {
        isi_pesan: body,
        trigger_waktu: trigger,
        unit_penerima: unit,
        tipe_notifikasi,
      },
      create: {
        nama_template: templateName,
        isi_pesan: body,
        trigger_waktu: trigger,
        unit_penerima: unit,
        tipe_notifikasi,
      },
    });

    return sendSuccess(res, {
      id: String(template.id_konfig),
      name: template.nama_template,
      status: 'APPROVED',
      category: 'LOCAL',
      language: 'id',
      trigger_waktu: template.trigger_waktu,
      unit_penerima: template.unit_penerima,
      tipe_notifikasi: template.tipe_notifikasi,
    }, 'Template notifikasi berhasil disimpan', 201);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal menyimpan template notifikasi');
  }
};

const getTemplates = async (req, res) => {
  try {
    const configs = await prisma.konfigurasiTemplate.findMany({
      orderBy: { created_at: 'desc' },
    });
    const templates = configs.map((config) => ({
      id: String(config.id_konfig),
      name: config.nama_template,
      status: 'APPROVED',
      category: 'LOCAL',
      language: 'id',
      trigger_waktu: config.trigger_waktu,
      unit_penerima: config.unit_penerima,
      tipe_notifikasi: config.tipe_notifikasi,
      components: [{ type: 'BODY', text: config.isi_pesan || '' }],
    }));
    return sendSuccess(res, templates);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal mengambil template notifikasi');
  }
};

const getLogs = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;
    const where = {
      ...(req.query.status ? { status: req.query.status } : {}),
      ...(req.query.jenis ? { jenis: req.query.jenis } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.notificationJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          dedupe_key: true,
          jenis: true,
          recipient_name: true,
          recipient_phone: true,
          status: true,
          attempts: true,
          max_attempts: true,
          next_attempt_at: true,
          provider_message_id: true,
          last_error: true,
          accepted_at: true,
          delivered_at: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.notificationJob.count({ where }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      dedupe_key: row.dedupe_key,
      jenis: row.jenis,
      recipient: {
        name: row.recipient_name,
        phone: redactPhone(row.recipient_phone),
      },
      status: {
        code: row.status,
        terminal: TERMINAL_STATUSES.has(row.status),
        attempts: row.attempts,
        max_attempts: row.max_attempts,
        next_attempt_at: row.next_attempt_at,
        accepted_at: row.accepted_at,
        delivered_at: row.delivered_at,
        provider_message_id: row.provider_message_id,
        last_error: row.last_error,
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return sendSuccess(res, {
      items,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    return handleControllerError(res, error, 'Gagal mengambil log notifikasi');
  }
};

const getNotificationMetrics = async (req, res) => {
  try {
    const now = new Date();
    const businessDate = getBusinessDate(now);
    const start = startOfBusinessDayUtc(now);
    const end = new Date(start.getTime() + DAY_MS);
    const createdToday = { created_at: { gte: start, lt: end } };
    const [statusGroups, typeGroups, acceptedToday, deliveredToday] = await Promise.all([
      prisma.notificationJob.groupBy({
        by: ['status'],
        where: createdToday,
        _count: { _all: true },
      }),
      prisma.notificationJob.groupBy({
        by: ['jenis'],
        where: createdToday,
        _count: { _all: true },
      }),
      prisma.notificationJob.count({
        where: { accepted_at: { gte: start, lt: end } },
      }),
      prisma.notificationJob.count({
        where: { delivered_at: { gte: start, lt: end } },
      }),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(NOTIFICATION_STATUSES).map((status) => [status, 0])
    );
    const byType = Object.fromEntries(
      Object.values(NOTIFICATION_TYPES).map((type) => [type, 0])
    );
    for (const group of statusGroups) byStatus[group.status] = group._count?._all || 0;
    for (const group of typeGroups) byType[group.jenis] = group._count?._all || 0;

    return sendSuccess(res, {
      business_date: businessDate,
      timezone: 'Asia/Jakarta',
      range: { start, end },
      created: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      accepted: acceptedToday,
      delivered: deliveredToday,
      by_status: byStatus,
      by_type: byType,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Gagal mengambil metrik notifikasi');
  }
};

const getPairingQr = async (req, res) => {
  res.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  try {
    const pairing = whatsappService.getPairingQr();
    if (!pairing) {
      return sendSuccess(res, {
        available: false,
        image_data_url: null,
        expires_at: null,
      }, 'QR pairing belum tersedia');
    }

    const imageDataUrl = await QRCode.toDataURL(pairing.value, {
      type: 'image/png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#111827', light: '#FFFFFF' },
    });
    return sendSuccess(res, {
      available: true,
      image_data_url: imageDataUrl,
      expires_at: pairing.expiresAt.toISOString(),
    }, 'QR pairing tersedia');
  } catch (error) {
    return handleControllerError(res, error, 'Gagal membuat QR pairing');
  }
};

const getWaStatus = async (req, res) => {
  try {
    const transportStatus = whatsappService.getStatus();
    const queueStatus = await getNotificationQueueStats();
    return sendSuccess(res, {
      channel: 'baileys',
      connected: transportStatus.connected,
      queued: queueStatus.pending + queueStatus.retry + queueStatus.processing,
      transport: {
        state: transportStatus.state,
        connected: transportStatus.connected,
        enabled: transportStatus.enabled,
        retry_scheduled: transportStatus.retryScheduled,
        pairing_required: transportStatus.pairingRequired,
        pairing_web_enabled: transportStatus.webPairingEnabled,
        pairing_qr_available: transportStatus.pairingQrAvailable,
        terminal_reason: transportStatus.terminalReason,
      },
      queue: queueStatus,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Gagal mengambil status notifikasi');
  }
};

const getUnitBelumLapor = async (req, res) => {
  try {
    const periode = req.query.periode || 'HARIAN';
    const data = await reminderService.cariUnitBelumLapor(new Date(), { periode });
    return sendSuccess(res, data);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal mengambil unit belum lapor');
  }
};

const kirimPerUnit = async (req, res) => {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id_unit: req.params.id_unit },
      include: {
        pengguna: {
          where: { peran: 'USER_UNIT' },
          select: { id_pengguna: true, nama: true, no_hp: true },
        },
      },
    });
    if (!unit) return sendError(res, 'Unit tidak ditemukan', 404);

    const messageText = req.body.messageText || req.body.pesan;
    const force = req.body.force !== undefined ? req.body.force : true;
    const requestKey = req.body.requestKey || (force ? `manual-${Date.now()}-u${unit.id_unit}` : undefined);

    const result = await reminderService.kirimPengingatUnit({
      id_unit: unit.id_unit,
      nama_unit: unit.nama_unit,
      jenis_unit: unit.jenis_unit,
      contacts: unit.pengguna,
    }, {
      tenggat: req.body.tenggat,
      force,
      requestKey,
      messageText,
      source: 'manual',
    });
    const successMsg = messageText ? 'Pesan custom berhasil diantrikan' : 'Pengingat unit berhasil diantrikan';
    return sendQueueOutcome(res, result, successMsg);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal mengantrikan pengingat unit');
  }
};

module.exports = {
  resolveContactId,
  redactPhone,
  sendQueueOutcome,
  sendBroadcast,
  verifyWebhook,
  handleWebhook,
  createTemplate,
  getTemplates,
  getLogs,
  getNotificationMetrics,
  getPairingQr,
  getWaStatus,
  getUnitBelumLapor,
  kirimPerUnit,
};
