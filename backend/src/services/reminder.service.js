'use strict';

const crypto = require('crypto');
const prisma = require('../config/database');
const {
  queueDeadlineReminder,
  queueRevisionReminder,
  queueCustomText,
} = require('./notification.service');
const {
  WhatsAppInvalidPhoneError,
  normalizeIndonesianPhone,
} = require('../whatsapp/baileys.service');
const {
  getBusinessDate,
  getBusinessMonthRangeUtc,
  startOfBusinessDayUtc,
  formatBusinessDate,
  differenceInBusinessDays,
} = require('./business-time');

const DAY_MS = 24 * 60 * 60 * 1000;
const SUBMITTED_REPORT_STATUSES = Object.freeze([
  'DIAJUKAN',
  'DISETUJUI',
  'DITOLAK',
  'REVISI',
]);
const NOTIFICATION_SCOPES = new Set(['SEMUA', 'PUSAT', 'DAERAH', 'CABANG']);
const TEMPLATE_TYPES = new Set(['DEADLINE', 'REVISI', 'BROADCAST']);
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9:_-]{8,100}$/;

class ReminderServiceError extends Error {
  constructor(message, statusCode = 400, code = 'REMINDER_ERROR') {
    super(message);
    this.name = 'ReminderServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function stableDigest(value, length = 24) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, length);
}

function assertScope(value) {
  const scope = value || 'SEMUA';
  if (!NOTIFICATION_SCOPES.has(scope)) {
    throw new ReminderServiceError('Scope penerima tidak valid', 422, 'INVALID_NOTIFICATION_SCOPE');
  }
  return scope;
}

function assertTemplateType(value) {
  if (!TEMPLATE_TYPES.has(value)) {
    throw new ReminderServiceError('Tipe notifikasi template tidak valid', 422, 'INVALID_TEMPLATE_TYPE');
  }
  return value;
}

function resolveForceKey({ force = false, requestKey } = {}) {
  if (!force) return null;
  if (typeof requestKey !== 'string' || !REQUEST_KEY_PATTERN.test(requestKey)) {
    throw new ReminderServiceError(
      'requestKey unik wajib untuk pengiriman force',
      422,
      'FORCE_REQUEST_KEY_REQUIRED'
    );
  }
  return stableDigest(requestKey);
}

function recipientIdentity(recipient) {
  return `phone-${stableDigest(recipient.phone, 16)}`;
}

function resolveRecipients(contacts = []) {
  const recipients = [];
  const seenPhones = new Set();
  const skipReasons = {
    missing_phone: 0,
    invalid_phone: 0,
    duplicate_phone: 0,
  };

  for (const contact of Array.isArray(contacts) ? contacts : []) {
    if (typeof contact?.no_hp !== 'string' || contact.no_hp.trim() === '') {
      skipReasons.missing_phone += 1;
      continue;
    }

    let phone;
    try {
      phone = normalizeIndonesianPhone(contact.no_hp);
    } catch (error) {
      if (!(error instanceof WhatsAppInvalidPhoneError)) throw error;
      skipReasons.invalid_phone += 1;
      continue;
    }

    if (seenPhones.has(phone)) {
      skipReasons.duplicate_phone += 1;
      continue;
    }
    seenPhones.add(phone);
    recipients.push({
      id_pengguna: contact.id_pengguna ?? null,
      nama: typeof contact.nama === 'string' && contact.nama.trim()
        ? contact.nama.trim()
        : 'Pengguna',
      phone,
      unit: contact.unit || null,
    });
  }

  return {
    recipients,
    skipped: Object.values(skipReasons).reduce((sum, count) => sum + count, 0),
    skip_reasons: skipReasons,
  };
}

function createQueueResult(total = 0) {
  return {
    total,
    queued: 0,
    duplicate: 0,
    failed: 0,
    skipped: 0,
    skip_reasons: {
      missing_phone: 0,
      invalid_phone: 0,
      duplicate_phone: 0,
    },
    errors: [],
  };
}

function addSkipReasons(result, reasons = {}) {
  for (const key of Object.keys(result.skip_reasons)) {
    result.skip_reasons[key] += Number(reasons[key] || 0);
  }
}

function mergeQueueResults(results = []) {
  const merged = createQueueResult();
  for (const result of results) {
    merged.total += Number(result?.total || 0);
    merged.queued += Number(result?.queued || 0);
    merged.duplicate += Number(result?.duplicate || 0);
    merged.failed += Number(result?.failed || 0);
    merged.skipped += Number(result?.skipped || 0);
    addSkipReasons(merged, result?.skip_reasons);
    if (Array.isArray(result?.errors)) merged.errors.push(...result.errors);
  }
  return merged;
}

function recordQueueFailure(result, recipient, error) {
  result.failed += 1;
  result.errors.push({
    recipient_id: recipient?.id_pengguna ?? null,
    code: typeof error?.code === 'string' ? error.code : 'QUEUE_FAILED',
  });
}

function recordQueueOutcome(result, recipient, outcome) {
  if (outcome?.terminalConflict) {
    result.failed += 1;
    result.errors.push({
      recipient_id: recipient?.id_pengguna ?? null,
      code: 'TERMINAL_DEDUPE_CONFLICT',
      job_id: outcome.jobId ?? null,
      status: outcome.existingStatus || null,
    });
    return;
  }
  if (outcome?.duplicate) {
    result.duplicate += 1;
    return;
  }
  if (outcome?.state === 'queued' || outcome?.state === 'requeued') {
    result.queued += 1;
    return;
  }
  recordQueueFailure(result, recipient, { code: 'UNEXPECTED_QUEUE_OUTCOME' });
}

function normalizeDeadline(value, now) {
  if (value === undefined || value === null || value === '') {
    const { end } = getBusinessMonthRangeUtc(now);
    return getBusinessDate(new Date(end.getTime() - 1));
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ReminderServiceError(
      'Tenggat harus berformat YYYY-MM-DD',
      422,
      'INVALID_DEADLINE'
    );
  }
  try {
    return getBusinessDate(value);
  } catch {
    throw new ReminderServiceError('Tanggal tenggat tidak valid', 422, 'INVALID_DEADLINE');
  }
}

function scopeMatches(jenisUnit, scope) {
  const normalizedScope = assertScope(scope);
  return normalizedScope === 'SEMUA' || jenisUnit === normalizedScope;
}

/**
 * Unit yang belum memiliki laporan non-DRAFT pada bulan bisnis Jakarta.
 * Semua unit pending tetap dikembalikan, termasuk yang tidak contactable.
 */
async function cariUnitBelumLapor(ref = new Date()) {
  const { start, end } = getBusinessMonthRangeUtc(ref);
  const [units, submittedReports] = await Promise.all([
    prisma.unit.findMany({
      include: {
        pengguna: {
          where: { peran: 'USER_UNIT' },
          select: { id_pengguna: true, nama: true, no_hp: true },
        },
      },
      orderBy: { id_unit: 'asc' },
    }),
    prisma.laporan.findMany({
      where: {
        tanggal: { gte: start, lt: end },
        status: { in: SUBMITTED_REPORT_STATUSES },
      },
      select: { id_unit: true },
    }),
  ]);

  const submittedUnitIds = new Set(submittedReports.map((report) => report.id_unit));
  return units
    .filter((unit) => !submittedUnitIds.has(unit.id_unit))
    .map((unit) => {
      const resolved = resolveRecipients(unit.pengguna);
      const contacts = resolved.recipients.map((recipient) => ({
        id_pengguna: recipient.id_pengguna,
        nama: recipient.nama,
        no_hp: recipient.phone,
      }));
      return {
        id_unit: unit.id_unit,
        nama_unit: unit.nama_unit,
        jenis_unit: unit.jenis_unit,
        contacts,
        // Alias lama dipertahankan selama konsumen beralih ke `contacts`.
        penanggung: contacts,
        contactable: contacts.length > 0,
        contact_count: contacts.length,
        skipped_contact_count: resolved.skipped,
        skipped_contact_reasons: resolved.skip_reasons,
      };
    });
}

/**
 * Semua laporan revisi tertunda; tanpa batas `take` agar laporan yang lebih baru
 * tidak kelaparan di belakang 100 record tertua.
 */
async function cariRevisiTertunda(ambangHari = 3, ref = new Date()) {
  if (!Number.isSafeInteger(ambangHari) || ambangHari < 1 || ambangHari > 3650) {
    throw new ReminderServiceError('Ambang hari revisi tidak valid', 422, 'INVALID_REVISION_AGE');
  }

  const todayStart = startOfBusinessDayUtc(ref);
  const cutoff = new Date(todayStart.getTime() - Math.max(0, ambangHari - 1) * DAY_MS);
  return prisma.laporan.findMany({
    where: {
      status: { in: ['DITOLAK', 'REVISI'] },
      updated_at: { lt: cutoff },
    },
    select: {
      id_laporan: true,
      tanggal: true,
      status: true,
      id_unit: true,
      updated_at: true,
      unit: { select: { id_unit: true, nama_unit: true, jenis_unit: true } },
      pengguna: { select: { id_pengguna: true, nama: true, no_hp: true } },
    },
    orderBy: [{ updated_at: 'asc' }, { id_laporan: 'asc' }],
  });
}

/**
 * Enqueue one deadline reminder per unique contact. A normal daily request is
 * idempotent across cron and HTTP; force requests use an explicit request key.
 */
async function kirimPengingatUnit(unit, options = {}) {
  if (!Number.isSafeInteger(unit?.id_unit) || unit.id_unit <= 0) {
    throw new ReminderServiceError('Unit pengingat tidak valid', 422, 'INVALID_REMINDER_UNIT');
  }

  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  if (Number.isNaN(now.getTime())) {
    throw new ReminderServiceError('Waktu pengingat tidak valid', 422, 'INVALID_REMINDER_TIME');
  }
  const businessDate = getBusinessDate(now);
  const deadline = normalizeDeadline(options.tenggat, now);
  const deadlineLabel = formatBusinessDate(deadline, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const daysRemaining = differenceInBusinessDays(now, deadline);
  const forceKey = resolveForceKey(options);
  const dispatchKey = forceKey ? `force-${forceKey}` : businessDate;
  const contacts = unit.contacts || unit.penanggung || unit.pengguna || [];
  const resolved = resolveRecipients(contacts);
  const inheritedSkipped = Number.isSafeInteger(unit.skipped_contact_count)
    ? unit.skipped_contact_count
    : 0;
  const result = createQueueResult(contacts.length + inheritedSkipped);
  result.skipped = resolved.skipped + inheritedSkipped;
  addSkipReasons(result, resolved.skip_reasons);
  addSkipReasons(result, unit.skipped_contact_reasons);

  for (const recipient of resolved.recipients) {
    try {
      const queued = await queueDeadlineReminder({
        dedupeKey: `deadline:${dispatchKey}:unit-${unit.id_unit}:${recipientIdentity(recipient)}`,
        recipientName: recipient.nama,
        recipientPhone: recipient.phone,
        unitName: unit.nama_unit,
        deadline: deadlineLabel,
        daysRemaining,
        templateText: options.messageText,
        expiresAt: new Date(startOfBusinessDayUtc(businessDate).getTime() + DAY_MS),
        metadata: {
          source: options.source || 'manual',
          businessDate,
          unitId: unit.id_unit,
          deadline,
        },
      });
      recordQueueOutcome(result, recipient, queued);
    } catch (error) {
      recordQueueFailure(result, recipient, error);
    }
  }

  return {
    ...result,
    business_date: businessDate,
    deadline,
    unit_id: unit.id_unit,
  };
}

async function kirimPengingatRevisi(reports, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  if (Number.isNaN(now.getTime())) {
    throw new ReminderServiceError('Waktu pengingat tidak valid', 422, 'INVALID_REMINDER_TIME');
  }
  const businessDate = getBusinessDate(now);
  const forceKey = resolveForceKey(options);
  const dispatchKey = forceKey ? `force-${forceKey}` : businessDate;
  const result = createQueueResult(Array.isArray(reports) ? reports.length : 0);

  for (const report of Array.isArray(reports) ? reports : []) {
    const resolved = resolveRecipients([report.pengguna]);
    if (resolved.recipients.length === 0) {
      result.skipped += 1;
      addSkipReasons(result, resolved.skip_reasons);
      continue;
    }
    const recipient = resolved.recipients[0];
    try {
      const queued = await queueRevisionReminder({
        dedupeKey: `revision:${dispatchKey}:report-${report.id_laporan}:${recipientIdentity(recipient)}`,
        recipientName: recipient.nama,
        recipientPhone: recipient.phone,
        reportDate: formatBusinessDate(report.tanggal),
        status: report.status,
        daysPending: Math.max(0, differenceInBusinessDays(report.updated_at, now)),
        templateText: options.messageText,
        expiresAt: new Date(startOfBusinessDayUtc(businessDate).getTime() + DAY_MS),
        metadata: {
          source: options.source || 'scheduled',
          businessDate,
          reportId: report.id_laporan,
          unitId: report.id_unit,
          unitName: report.unit?.nama_unit || null,
        },
      });
      recordQueueOutcome(result, recipient, queued);
    } catch (error) {
      recordQueueFailure(result, recipient, error);
    }
  }

  return { ...result, business_date: businessDate };
}

/**
 * Resolve a broadcast audience once and enqueue encrypted CUSTOM_BROADCAST jobs.
 * For template sends, the persisted template scope always overrides request input.
 */
async function broadcastBaileys({
  messageType,
  messageText,
  templateName,
  unitPenerima = 'SEMUA',
  force = false,
  requestKey,
  source = 'manual',
  pendingUnitIds,
  template: suppliedTemplate,
  now: suppliedNow,
} = {}) {
  const now = suppliedNow instanceof Date ? suppliedNow : new Date(suppliedNow || Date.now());
  if (Number.isNaN(now.getTime())) {
    throw new ReminderServiceError('Waktu broadcast tidak valid', 422, 'INVALID_BROADCAST_TIME');
  }

  let template = suppliedTemplate || null;
  let text = messageText;
  let scope;
  if (messageType === 'template') {
    template = template || await prisma.konfigurasiTemplate.findUnique({
      where: { nama_template: templateName },
    });
    if (!template) {
      throw new ReminderServiceError(
        `Template lokal "${templateName}" tidak ditemukan`,
        404,
        'NOTIFICATION_TEMPLATE_NOT_FOUND'
      );
    }
    if (typeof template.isi_pesan !== 'string' || template.isi_pesan.trim() === '') {
      throw new ReminderServiceError('Isi template tidak boleh kosong', 422, 'EMPTY_TEMPLATE_BODY');
    }
    const templateType = assertTemplateType(template.tipe_notifikasi);
    if (templateType !== 'BROADCAST') {
      throw new ReminderServiceError(
        'Hanya template BROADCAST yang dapat dikirim melalui endpoint broadcast',
        422,
        'BROADCAST_TEMPLATE_TYPE_REQUIRED'
      );
    }
    text = template.isi_pesan.trim();
    scope = assertScope(template.unit_penerima);
  } else if (messageType === 'text') {
    scope = assertScope(unitPenerima);
    if (typeof text !== 'string' || text.trim() === '') {
      throw new ReminderServiceError('Isi pesan tidak boleh kosong', 422, 'EMPTY_BROADCAST_BODY');
    }
    text = text.trim();
  } else {
    throw new ReminderServiceError('Jenis pesan tidak valid', 422, 'INVALID_MESSAGE_TYPE');
  }

  const forceKey = resolveForceKey({ force, requestKey });
  let targetIds = null;
  if (source === 'scheduled') {
    if (!Array.isArray(pendingUnitIds)) {
      throw new ReminderServiceError(
        'Broadcast terjadwal wajib memiliki target pending',
        422,
        'SCHEDULED_PENDING_TARGET_REQUIRED'
      );
    }
    targetIds = [...new Set(pendingUnitIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
    if (targetIds.length === 0) {
      return {
        ...createQueueResult(0),
        business_date: getBusinessDate(now),
        scope,
        template_type: template?.tipe_notifikasi || 'BROADCAST',
      };
    }
  }

  const unitWhere = {
    ...(scope !== 'SEMUA' ? { jenis_unit: scope } : {}),
    ...(targetIds ? { id_unit: { in: targetIds } } : {}),
  };
  const users = await prisma.pengguna.findMany({
    where: {
      peran: 'USER_UNIT',
      ...(Object.keys(unitWhere).length > 0 ? { unit: unitWhere } : {}),
    },
    select: {
      id_pengguna: true,
      nama: true,
      no_hp: true,
      unit: { select: { id_unit: true, nama_unit: true, jenis_unit: true } },
    },
    orderBy: { id_pengguna: 'asc' },
  });

  const resolved = resolveRecipients(users);
  const result = createQueueResult(users.length);
  result.skipped = resolved.skipped;
  addSkipReasons(result, resolved.skip_reasons);
  const businessDate = getBusinessDate(now);
  const dispatchKey = forceKey ? `force-${forceKey}` : businessDate;
  const campaignKey = stableDigest(JSON.stringify({
    templateId: template?.id_konfig || null,
    templateName: template?.nama_template || null,
    text,
    scope,
  }));

  for (const recipient of resolved.recipients) {
    try {
      const queued = await queueCustomText({
        dedupeKey: `broadcast:${dispatchKey}:${campaignKey}:${recipientIdentity(recipient)}`,
        recipientName: recipient.nama,
        recipientPhone: recipient.phone,
        text,
        expiresAt: new Date(startOfBusinessDayUtc(businessDate).getTime() + DAY_MS),
        metadata: {
          source,
          businessDate,
          scope,
          unitId: recipient.unit?.id_unit || null,
          unitName: recipient.unit?.nama_unit || null,
          templateId: template?.id_konfig || null,
          templateName: template?.nama_template || null,
          templateType: template?.tipe_notifikasi || 'BROADCAST',
        },
      });
      recordQueueOutcome(result, recipient, queued);
    } catch (error) {
      recordQueueFailure(result, recipient, error);
    }
  }

  return {
    ...result,
    business_date: businessDate,
    scope,
    template_type: template?.tipe_notifikasi || 'BROADCAST',
  };
}

const tenggatAkhirBulan = (ref = new Date()) => {
  const { end } = getBusinessMonthRangeUtc(ref);
  return new Date(end.getTime() - 1);
};

module.exports = {
  DAY_MS,
  SUBMITTED_REPORT_STATUSES,
  ReminderServiceError,
  resolveRecipients,
  mergeQueueResults,
  recordQueueOutcome,
  scopeMatches,
  cariUnitBelumLapor,
  cariRevisiTertunda,
  kirimPengingatUnit,
  kirimPengingatRevisi,
  broadcastBaileys,
  tenggatAkhirBulan,
};
