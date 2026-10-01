'use strict';

const crypto = require('crypto');
const os = require('os');
const prisma = require('../config/database');
const whatsappService = require('../whatsapp/baileys.service');
const {
  CONNECTION_STATES,
  WhatsAppServiceError,
  normalizeIndonesianPhone,
} = require('../whatsapp/baileys.service');

const NOTIFICATION_TYPES = Object.freeze({
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  REPORT_APPROVED: 'REPORT_APPROVED',
  REPORT_REJECTED: 'REPORT_REJECTED',
  REPORT_REVISION_REQUESTED: 'REPORT_REVISION_REQUESTED',
  REPORT_RESUBMITTED: 'REPORT_RESUBMITTED',
  REQUEST_STATUS: 'REQUEST_STATUS',
  DEADLINE_REMINDER: 'DEADLINE_REMINDER',
  REVISION_REMINDER: 'REVISION_REMINDER',
  CUSTOM_BROADCAST: 'CUSTOM_BROADCAST',
});

const NOTIFICATION_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  RETRY: 'RETRY',
  ACCEPTED: 'ACCEPTED',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
});

const VALID_NOTIFICATION_TYPES = new Set(Object.values(NOTIFICATION_TYPES));
const CLAIMABLE_STATUSES = [NOTIFICATION_STATUSES.PENDING, NOTIFICATION_STATUSES.RETRY];
const ACTIVE_STATUSES = [
  NOTIFICATION_STATUSES.PENDING,
  NOTIFICATION_STATUSES.PROCESSING,
  NOTIFICATION_STATUSES.RETRY,
];
const ACCEPTABLE_DUPLICATE_STATUSES = new Set([
  ...ACTIVE_STATUSES,
  NOTIFICATION_STATUSES.ACCEPTED,
  NOTIFICATION_STATUSES.DELIVERED,
]);
const REQUEUEABLE_STATUSES = [
  NOTIFICATION_STATUSES.FAILED,
  NOTIFICATION_STATUSES.EXPIRED,
];
const ENCRYPTION_VERSION = 'v1';
const ENCRYPTION_AAD = Buffer.from('notification-job-payload:v1', 'utf8');
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_MAX_ATTEMPTS = 100;
const DEFAULT_STALE_LOCK_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_BASE_MS = 5 * 1000;
const DEFAULT_RETRY_MAX_MS = 30 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MS = 1000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_WORKER_ID = `${os.hostname()}:${process.pid}:${crypto
  .randomBytes(6)
  .toString('hex')}`.slice(0, 100);

class NotificationServiceError extends Error {
  constructor(message, { code = 'NOTIFICATION_ERROR', retryable = false, cause } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = Boolean(retryable);
    if (cause !== undefined) this.cause = cause;
  }
}

class NotificationValidationError extends NotificationServiceError {
  constructor(message) {
    super(message, { code: 'NOTIFICATION_VALIDATION_ERROR', retryable: false });
  }
}

class NotificationConfigurationError extends NotificationServiceError {
  constructor(message) {
    super(message, { code: 'NOTIFICATION_CONFIGURATION_ERROR', retryable: true });
  }
}

class NotificationPayloadError extends NotificationServiceError {
  constructor(message = 'Encrypted notification payload is invalid', cause) {
    super(message, {
      code: 'NOTIFICATION_PAYLOAD_ERROR',
      retryable: false,
      cause,
    });
  }
}

function readBoundedInteger(value, fallback, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function deriveNotificationEncryptionKey(secret) {
  const source =
    secret === undefined
      ? process.env.NOTIFICATION_ENCRYPTION_KEY || process.env.JWT_SECRET
      : secret;
  if (typeof source !== 'string' || source.length === 0) {
    throw new NotificationConfigurationError(
      'NOTIFICATION_ENCRYPTION_KEY or JWT_SECRET must be configured'
    );
  }
  return crypto.createHash('sha256').update(source, 'utf8').digest();
}

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(value) {
  if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new NotificationPayloadError();
  }
  const padding = (4 - (value.length % 4)) % 4;
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padding);
  const decoded = Buffer.from(normalized, 'base64');
  if (toBase64Url(decoded) !== value) throw new NotificationPayloadError();
  return decoded;
}

function serializePayload(payload) {
  try {
    const serialized = JSON.stringify(payload);
    if (serialized === undefined) throw new TypeError('Payload is not JSON serializable');
    return serialized;
  } catch (error) {
    throw new NotificationValidationError('Notification payload must be JSON serializable');
  }
}

function encryptNotificationPayload(payload, options = {}) {
  const key = deriveNotificationEncryptionKey(options.secret);
  const iv = options.iv ? Buffer.from(options.iv) : crypto.randomBytes(12);
  if (iv.length !== 12) {
    throw new NotificationValidationError('AES-GCM initialization vector must be 12 bytes');
  }

  const plaintext = Buffer.from(serializePayload(payload), 'utf8');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(ENCRYPTION_AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  plaintext.fill(0);

  return [
    ENCRYPTION_VERSION,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(ciphertext),
  ].join('.');
}

function decryptNotificationPayload(envelope, options = {}) {
  if (typeof envelope !== 'string') throw new NotificationPayloadError();
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw new NotificationPayloadError();
  }

  try {
    const iv = fromBase64Url(parts[1]);
    const authTag = fromBase64Url(parts[2]);
    const ciphertext = fromBase64Url(parts[3]);
    if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
      throw new NotificationPayloadError();
    }

    const key = deriveNotificationEncryptionKey(options.secret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(ENCRYPTION_AAD);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    try {
      return JSON.parse(plaintext.toString('utf8'));
    } finally {
      plaintext.fill(0);
    }
  } catch (error) {
    if (error instanceof NotificationConfigurationError) throw error;
    if (error instanceof NotificationPayloadError) throw error;
    throw new NotificationPayloadError(undefined, error);
  }
}

function requiredTrimmedString(value, field, maximumLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new NotificationValidationError(`${field} is required`);
  }
  const normalized = value.trim();
  if (maximumLength && normalized.length > maximumLength) {
    throw new NotificationValidationError(`${field} is too long`);
  }
  return normalized;
}

function optionalTrimmedString(value, field, maximumLength) {
  if (value === undefined || value === null || value === '') return null;
  return requiredTrimmedString(value, field, maximumLength);
}

function optionalDate(value, field) {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new NotificationValidationError(`${field} must be a valid date`);
  }
  return date;
}

function normalizeMetadata(metadata) {
  if (metadata === undefined || metadata === null) return null;
  if (typeof metadata !== 'object') {
    throw new NotificationValidationError('metadata must be an object or null');
  }
  serializePayload(metadata);
  return metadata;
}

function isPrismaUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

async function enqueueNotification({
  tx,
  dedupeKey,
  jenis,
  recipientName = null,
  recipientPhone,
  text,
  metadata = null,
  expiresAt = null,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
} = {}) {
  const client = tx || prisma;
  if (!client?.notificationJob || typeof client.notificationJob.create !== 'function') {
    throw new NotificationConfigurationError('Prisma NotificationJob client is unavailable');
  }

  const normalizedDedupeKey = requiredTrimmedString(dedupeKey, 'dedupeKey', 191);
  if (!VALID_NOTIFICATION_TYPES.has(jenis)) {
    throw new NotificationValidationError('jenis is not a supported notification type');
  }
  const normalizedName = optionalTrimmedString(recipientName, 'recipientName', 100);
  const normalizedPhone = normalizeIndonesianPhone(recipientPhone);
  const normalizedText = requiredTrimmedString(text, 'text', 100000);
  const normalizedMetadata = normalizeMetadata(metadata);
  const normalizedExpiresAt = optionalDate(expiresAt, 'expiresAt');
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_MAX_ATTEMPTS) {
    throw new NotificationValidationError(
      `maxAttempts must be an integer between 1 and ${MAX_MAX_ATTEMPTS}`
    );
  }

  const payloadEncrypted = encryptNotificationPayload({
    version: 1,
    text: normalizedText,
    metadata: normalizedMetadata,
  });

  const queuedAt = new Date();
  const jobData = {
    dedupe_key: normalizedDedupeKey,
    jenis,
    recipient_name: normalizedName,
    recipient_phone: normalizedPhone,
    payload_encrypted: payloadEncrypted,
    status: NOTIFICATION_STATUSES.PENDING,
    attempts: 0,
    max_attempts: maxAttempts,
    next_attempt_at: queuedAt,
    expires_at: normalizedExpiresAt,
  };

  try {
    const created = await client.notificationJob.create({
      data: jobData,
      select: { id: true },
    });

    return {
      state: 'queued',
      duplicate: false,
      jobId: created.id,
      dedupeKey: normalizedDedupeKey,
    };
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    if (typeof client.notificationJob.findUnique !== 'function') throw error;

    let existing = await client.notificationJob.findUnique({
      where: { dedupe_key: normalizedDedupeKey },
      select: { id: true, status: true },
    });
    if (!existing) throw error;

    const expiryAllowsRetry =
      normalizedExpiresAt === null || normalizedExpiresAt.getTime() > queuedAt.getTime();
    if (
      REQUEUEABLE_STATUSES.includes(existing.status) &&
      expiryAllowsRetry &&
      typeof client.notificationJob.updateMany === 'function'
    ) {
      const requeued = await client.notificationJob.updateMany({
        where: {
          id: existing.id,
          status: existing.status,
        },
        data: {
          jenis: jobData.jenis,
          recipient_name: jobData.recipient_name,
          recipient_phone: jobData.recipient_phone,
          payload_encrypted: jobData.payload_encrypted,
          status: NOTIFICATION_STATUSES.PENDING,
          attempts: 0,
          max_attempts: jobData.max_attempts,
          next_attempt_at: queuedAt,
          expires_at: jobData.expires_at,
          locked_at: null,
          lock_owner: null,
          provider_message_id: null,
          last_error: null,
          accepted_at: null,
          delivered_at: null,
        },
      });
      if (requeued.count === 1) {
        return {
          state: 'requeued',
          duplicate: false,
          terminalConflict: false,
          jobId: existing.id,
          previousStatus: existing.status,
          dedupeKey: normalizedDedupeKey,
        };
      }

      existing = await client.notificationJob.findUnique({
        where: { dedupe_key: normalizedDedupeKey },
        select: { id: true, status: true },
      });
      if (!existing) throw error;
    }

    const acceptable = ACCEPTABLE_DUPLICATE_STATUSES.has(existing.status);
    return {
      state: acceptable ? 'duplicate' : 'terminal_conflict',
      duplicate: acceptable,
      terminalConflict: !acceptable,
      jobId: existing.id,
      existingStatus: existing.status,
      dedupeKey: normalizedDedupeKey,
    };
  }
}

function mergeMetadata(generated, supplied) {
  const normalized = normalizeMetadata(supplied);
  if (normalized === null) return generated;
  if (Array.isArray(normalized)) {
    return { details: generated, supplied: normalized };
  }
  return { ...normalized, ...generated };
}

function convenienceArguments(args, jenis, text, generatedMetadata) {
  return enqueueNotification({
    tx: args.tx,
    dedupeKey: args.dedupeKey,
    jenis,
    recipientName: args.recipientName,
    recipientPhone: args.recipientPhone,
    text,
    metadata: mergeMetadata(generatedMetadata, args.metadata),
    expiresAt: args.expiresAt,
    maxAttempts: args.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
  });
}

function displayName(name) {
  return optionalTrimmedString(name, 'recipientName', 100) || 'Pengguna';
}

function queuePasswordReset(args = {}) {
  const token = requiredTrimmedString(args.token, 'token', 200);
  const name = displayName(args.recipientName);
  const text =
    `🔐 *Reset Kata Sandi - Sistem Laporan*\n\n` +
    `Halo ${name},\n\n` +
    `Anda meminta reset kata sandi. Gunakan token berikut:\n\n` +
    `*${token}*\n\n` +
    `⏰ Token hanya berlaku sampai waktu yang ditentukan.\n` +
    `🚫 Abaikan pesan ini jika Anda tidak meminta reset kata sandi.`;
  return convenienceArguments(args, NOTIFICATION_TYPES.PASSWORD_RESET, text, {
    event: 'password_reset',
  });
}

function queuePasswordChanged(args = {}) {
  const name = displayName(args.recipientName);
  const text =
    `✅ *Kata Sandi Berhasil Diubah*\n\n` +
    `Halo ${name}, kata sandi akun Anda telah berhasil diubah.\n` +
    `Jika ini bukan Anda, segera hubungi admin.`;
  return convenienceArguments(args, NOTIFICATION_TYPES.PASSWORD_CHANGED, text, {
    event: 'password_changed',
  });
}

function normalizeDecision(value) {
  const decision = requiredTrimmedString(value, 'decision', 50).toUpperCase();
  const aliases = {
    APPROVED: 'APPROVED',
    DISETUJUI: 'APPROVED',
    REJECTED: 'REJECTED',
    DITOLAK: 'REJECTED',
    REVISION_REQUESTED: 'REVISION_REQUESTED',
    REVISION: 'REVISION_REQUESTED',
    REVISI: 'REVISION_REQUESTED',
  };
  const normalized = aliases[decision];
  if (!normalized) throw new NotificationValidationError('decision is not supported');
  return normalized;
}

function queueReportDecision(args = {}) {
  const decision = normalizeDecision(args.decision);
  const name = displayName(args.recipientName);
  const reportDate = requiredTrimmedString(args.reportDate, 'reportDate', 100);
  const unitName = requiredTrimmedString(args.unitName, 'unitName', 150);
  const reason = optionalTrimmedString(args.reason, 'reason', 5000);

  let jenis;
  let text;
  if (decision === 'APPROVED') {
    jenis = NOTIFICATION_TYPES.REPORT_APPROVED;
    text =
      `✅ *Laporan Disetujui*\n\nHalo ${name}, laporan unit *${unitName}* ` +
      `tanggal *${reportDate}* telah *DISETUJUI*.\n\nSilakan login untuk melihat detail.`;
  } else if (decision === 'REJECTED') {
    jenis = NOTIFICATION_TYPES.REPORT_REJECTED;
    text =
      `❌ *Laporan Ditolak*\n\nHalo ${name}, laporan tanggal *${reportDate}* ` +
      `dari unit *${unitName}* telah *DITOLAK*.` +
      (reason ? `\n\nAlasan: ${reason}` : '') +
      `\n\nSilakan login untuk melihat detail.`;
  } else {
    jenis = NOTIFICATION_TYPES.REPORT_REVISION_REQUESTED;
    text =
      `🔄 *Revisi Laporan Diperlukan*\n\nHalo ${name}, laporan tanggal *${reportDate}* ` +
      `dari unit *${unitName}* perlu direvisi.` +
      (reason ? `\n\nCatatan: ${reason}` : '') +
      `\n\nSilakan login untuk melihat detail.`;
  }

  return convenienceArguments(args, jenis, text, {
    event: 'report_decision',
    decision,
    reportDate,
    unitName,
    ...(reason ? { reason } : {}),
  });
}

function queueReportResubmitted(args = {}) {
  const name = displayName(args.recipientName);
  const reportId = requiredTrimmedString(String(args.reportId ?? ''), 'reportId', 100);
  const unitName = requiredTrimmedString(args.unitName, 'unitName', 150);
  const changedFields = Array.isArray(args.changedFields)
    ? args.changedFields.map((field) => String(field)).slice(0, 100)
    : [];
  const text =
    `🔄 *Laporan Diajukan Ulang*\n\nHalo ${name}, laporan #${reportId} dari ` +
    `*${unitName}* telah diperbaiki dan membutuhkan review ulang.` +
    (changedFields.length > 0 ? `\n\nField berubah: ${changedFields.join(', ')}` : '');
  return convenienceArguments(args, NOTIFICATION_TYPES.REPORT_RESUBMITTED, text, {
    event: 'report_resubmitted',
    reportId,
    unitName,
    changedFields,
  });
}

function queueRequestUpdate(args = {}) {
  const name = displayName(args.recipientName);
  const requestType = requiredTrimmedString(args.requestType, 'requestType', 150);
  const status = requiredTrimmedString(args.status, 'status', 100);
  const text =
    `📋 *Update Permintaan Bantuan*\n\nHalo ${name},\n\nPermintaan ` +
    `*${requestType}* Anda sekarang berstatus: *${status}*.\n\nSilakan login untuk detail.`;
  return convenienceArguments(args, NOTIFICATION_TYPES.REQUEST_STATUS, text, {
    event: 'request_status',
    requestType,
    status,
  });
}

function queueDeadlineReminder(args = {}) {
  const name = displayName(args.recipientName);
  const unitName = requiredTrimmedString(args.unitName, 'unitName', 150);
  const deadline = requiredTrimmedString(args.deadline, 'deadline', 100);
  if (!Number.isInteger(args.daysRemaining)) {
    throw new NotificationValidationError('daysRemaining must be an integer');
  }
  const daysRemaining = args.daysRemaining;
  const urgency =
    daysRemaining < 0
      ? `⚠️ Sudah lewat *${Math.abs(daysRemaining)} hari* dari tenggat.`
      : daysRemaining === 0
        ? '⚠️ Tenggat *HARI INI*.'
        : `⏰ Sisa *${daysRemaining} hari* menuju tenggat.`;
  const defaultText =
    `⏰ *Pengingat Laporan - Sistem Laporan*\n\nHalo ${name} (${unitName}),\n\n` +
    `Unit Anda belum mengirim laporan periode ini.\nTenggat: *${deadline}*\n${urgency}\n\n` +
    `Silakan login dan submit laporan sebelum tenggat.`;
  const text = optionalTrimmedString(args.templateText, 'templateText', 100000) || defaultText;
  return convenienceArguments(args, NOTIFICATION_TYPES.DEADLINE_REMINDER, text, {
    event: 'deadline_reminder',
    unitName,
    deadline,
    daysRemaining,
  });
}

function queueRevisionReminder(args = {}) {
  const name = displayName(args.recipientName);
  const reportDate = requiredTrimmedString(args.reportDate, 'reportDate', 100);
  const status = requiredTrimmedString(args.status, 'status', 100);
  if (!Number.isInteger(args.daysPending) || args.daysPending < 0) {
    throw new NotificationValidationError('daysPending must be a non-negative integer');
  }
  const defaultText =
    `🔄 *Pengingat Revisi Laporan*\n\nHalo ${name},\n\nLaporan tanggal ` +
    `*${reportDate}* berstatus *${status}* dan belum diperbaiki selama ` +
    `*${args.daysPending} hari*.\n\nSilakan login untuk melihat catatan reviewer dan ajukan ulang.`;
  const text = optionalTrimmedString(args.templateText, 'templateText', 100000) || defaultText;
  return convenienceArguments(args, NOTIFICATION_TYPES.REVISION_REMINDER, text, {
    event: 'revision_reminder',
    reportDate,
    status,
    daysPending: args.daysPending,
  });
}

function queueCustomText(args = {}) {
  const text = requiredTrimmedString(args.text, 'text', 100000);
  return convenienceArguments(args, NOTIFICATION_TYPES.CUSTOM_BROADCAST, text, {
    event: 'custom_broadcast',
  });
}

function normalizeWorkerId(value) {
  return requiredTrimmedString(value || DEFAULT_WORKER_ID, 'workerId', 100);
}

function asNow(value) {
  const resolved = typeof value === 'function' ? value() : value ?? new Date();
  const date = resolved instanceof Date ? new Date(resolved.getTime()) : new Date(resolved);
  if (Number.isNaN(date.getTime())) throw new NotificationValidationError('now is invalid');
  return date;
}

async function withTransaction(client, callback) {
  if (typeof client?.$transaction === 'function') {
    return client.$transaction(callback, { timeout: 10000 });
  }
  return callback(client);
}

async function claimNextNotificationJob({
  prismaClient = prisma,
  workerId = DEFAULT_WORKER_ID,
  now,
  staleLockMs = readBoundedInteger(
    process.env.NOTIFICATION_STALE_LOCK_MS,
    DEFAULT_STALE_LOCK_MS,
    { minimum: 1000 }
  ),
  scanLimit = 25,
} = {}) {
  const lockOwner = normalizeWorkerId(workerId);
  const claimTime = asNow(now);
  const staleBefore = new Date(claimTime.getTime() - staleLockMs);
  const boundedScanLimit = readBoundedInteger(scanLimit, 25, { minimum: 1, maximum: 1000 });

  return withTransaction(prismaClient, async (tx) => {
    const jobs = tx?.notificationJob;
    if (!jobs) throw new NotificationConfigurationError('Prisma NotificationJob client is unavailable');

    await jobs.updateMany({
      where: {
        status: NOTIFICATION_STATUSES.PROCESSING,
        OR: [{ locked_at: null }, { locked_at: { lte: staleBefore } }],
      },
      data: {
        status: NOTIFICATION_STATUSES.RETRY,
        next_attempt_at: claimTime,
        locked_at: null,
        lock_owner: null,
        last_error: 'PROCESSING_LOCK_EXPIRED',
      },
    });

    await jobs.updateMany({
      where: {
        status: { in: CLAIMABLE_STATUSES },
        expires_at: { lte: claimTime },
      },
      data: {
        status: NOTIFICATION_STATUSES.EXPIRED,
        locked_at: null,
        lock_owner: null,
        last_error: 'NOTIFICATION_EXPIRED',
      },
    });

    for (let scanned = 0; scanned < boundedScanLimit; scanned += 1) {
      const candidate = await jobs.findFirst({
        where: {
          status: { in: CLAIMABLE_STATUSES },
          next_attempt_at: { lte: claimTime },
          OR: [{ expires_at: null }, { expires_at: { gt: claimTime } }],
        },
        orderBy: [{ next_attempt_at: 'asc' }, { id: 'asc' }],
      });

      if (!candidate) return null;

      if (candidate.attempts >= candidate.max_attempts) {
        await jobs.updateMany({
          where: {
            id: candidate.id,
            status: { in: CLAIMABLE_STATUSES },
            attempts: candidate.attempts,
          },
          data: {
            status: NOTIFICATION_STATUSES.FAILED,
            locked_at: null,
            lock_owner: null,
            last_error: 'MAX_ATTEMPTS_REACHED',
          },
        });
        continue;
      }

      const claimed = await jobs.updateMany({
        where: {
          id: candidate.id,
          status: { in: CLAIMABLE_STATUSES },
          attempts: candidate.attempts,
          next_attempt_at: { lte: claimTime },
          OR: [{ expires_at: null }, { expires_at: { gt: claimTime } }],
        },
        data: {
          status: NOTIFICATION_STATUSES.PROCESSING,
          attempts: { increment: 1 },
          locked_at: claimTime,
          lock_owner: lockOwner,
        },
      });

      if (claimed.count === 1) {
        return {
          ...candidate,
          status: NOTIFICATION_STATUSES.PROCESSING,
          attempts: candidate.attempts + 1,
          locked_at: claimTime,
          lock_owner: lockOwner,
        };
      }
    }

    return null;
  });
}

function calculateRetryDelay(
  attempt,
  {
    baseMs = readBoundedInteger(process.env.NOTIFICATION_RETRY_BASE_MS, DEFAULT_RETRY_BASE_MS, {
      minimum: 1,
    }),
    maxMs = readBoundedInteger(process.env.NOTIFICATION_RETRY_MAX_MS, DEFAULT_RETRY_MAX_MS, {
      minimum: 1,
    }),
    random = Math.random,
  } = {}
) {
  const safeAttempt = Math.max(1, Number.isSafeInteger(attempt) ? attempt : 1);
  const boundedMax = Math.max(baseMs, maxMs);
  const ceiling = Math.min(boundedMax, baseMs * 2 ** Math.min(safeAttempt - 1, 20));
  const randomValue = Math.min(1, Math.max(0, Number(random())) || 0);
  return Math.max(1, Math.floor(ceiling * (0.5 + randomValue * 0.5)));
}

function isStopRequested(options) {
  return Boolean(options.signal?.aborted || options.isStopping?.());
}

function isProviderConnected(provider) {
  try {
    const status = provider?.getStatus?.();
    if (status) {
      return Boolean(
        (status.state === CONNECTION_STATES.CONNECTED || status.connected === true) &&
          status.connected !== false
      );
    }
    return Boolean(
      provider &&
        (provider.state === CONNECTION_STATES.CONNECTED || provider.isConnected === true)
    );
  } catch (error) {
    return false;
  }
}

async function updateOwnedJob(prismaClient, job, data) {
  return prismaClient.notificationJob.updateMany({
    where: {
      id: job.id,
      status: NOTIFICATION_STATUSES.PROCESSING,
      lock_owner: job.lock_owner,
    },
    data,
  });
}

function safeProcessingErrorCode(error) {
  if (error instanceof NotificationServiceError) return error.code;
  if (error instanceof WhatsAppServiceError) return error.code;
  return 'NOTIFICATION_PROCESSING_FAILED';
}

async function releaseClaimForStop(prismaClient, job, now) {
  await updateOwnedJob(prismaClient, job, {
    status: NOTIFICATION_STATUSES.RETRY,
    next_attempt_at: now,
    locked_at: null,
    lock_owner: null,
    last_error: 'WORKER_STOPPED',
  });
}

async function processNextJob(options = {}) {
  const prismaClient = options.prismaClient || prisma;
  const provider = options.provider || options.baileysService || whatsappService;
  const workerId = options.workerId || DEFAULT_WORKER_ID;

  if (isStopRequested(options)) return { state: 'stopping', jobId: null };
  if (!isProviderConnected(provider)) {
    return { state: 'provider_unavailable', jobId: null };
  }

  const job = await claimNextNotificationJob({
    prismaClient,
    workerId,
    now: options.now,
    staleLockMs: options.staleLockMs,
    scanLimit: options.scanLimit,
  });
  if (!job) return { state: 'idle', jobId: null };

  const currentTime = asNow(options.now);
  if (isStopRequested(options)) {
    await releaseClaimForStop(prismaClient, job, currentTime);
    return { state: 'stopping', jobId: job.id };
  }

  if (job.expires_at && new Date(job.expires_at).getTime() <= currentTime.getTime()) {
    await updateOwnedJob(prismaClient, job, {
      status: NOTIFICATION_STATUSES.EXPIRED,
      locked_at: null,
      lock_owner: null,
      last_error: 'NOTIFICATION_EXPIRED',
    });
    return { state: 'expired', jobId: job.id, attempts: job.attempts };
  }

  try {
    const payload = decryptNotificationPayload(job.payload_encrypted);
    if (!payload || typeof payload.text !== 'string' || payload.text.trim().length === 0) {
      throw new NotificationPayloadError();
    }

    if (isStopRequested(options)) {
      await releaseClaimForStop(prismaClient, job, asNow(options.now));
      return { state: 'stopping', jobId: job.id };
    }

    const providerResult = await provider.sendNow(job.recipient_phone, payload.text);
    if (!providerResult || providerResult.state !== 'accepted') {
      throw new NotificationServiceError('Provider did not accept the notification', {
        code: 'PROVIDER_NOT_ACCEPTED',
        retryable: true,
      });
    }

    const acceptedAt = asNow(options.now);
    const providerMessageId =
      providerResult.providerMessageId === undefined || providerResult.providerMessageId === null
        ? null
        : String(providerResult.providerMessageId).slice(0, 191);
    const updated = await updateOwnedJob(prismaClient, job, {
      status: NOTIFICATION_STATUSES.ACCEPTED,
      provider_message_id: providerMessageId,
      accepted_at: acceptedAt,
      locked_at: null,
      lock_owner: null,
      last_error: null,
    });

    if (updated.count !== 1) {
      return { state: 'lost_lock', jobId: job.id, providerMessageId };
    }
    return {
      state: 'accepted',
      jobId: job.id,
      attempts: job.attempts,
      providerMessageId,
    };
  } catch (error) {
    const failedAt = asNow(options.now);
    const expired =
      job.expires_at && new Date(job.expires_at).getTime() <= failedAt.getTime();
    const permanent = error?.retryable === false;
    const attemptsExhausted = job.attempts >= job.max_attempts;
    const errorCode = safeProcessingErrorCode(error);

    if (expired) {
      await updateOwnedJob(prismaClient, job, {
        status: NOTIFICATION_STATUSES.EXPIRED,
        locked_at: null,
        lock_owner: null,
        last_error: 'NOTIFICATION_EXPIRED',
      });
      return { state: 'expired', jobId: job.id, attempts: job.attempts, errorCode };
    }

    if (permanent || attemptsExhausted) {
      await updateOwnedJob(prismaClient, job, {
        status: NOTIFICATION_STATUSES.FAILED,
        locked_at: null,
        lock_owner: null,
        last_error: errorCode,
      });
      return { state: 'failed', jobId: job.id, attempts: job.attempts, errorCode };
    }

    const retryDelayMs = calculateRetryDelay(job.attempts, {
      baseMs: options.retryBaseMs,
      maxMs: options.retryMaxMs,
      random: options.random || Math.random,
    });
    let nextAttemptAt = new Date(failedAt.getTime() + retryDelayMs);
    if (job.expires_at && nextAttemptAt.getTime() > new Date(job.expires_at).getTime()) {
      nextAttemptAt = new Date(job.expires_at);
    }
    await updateOwnedJob(prismaClient, job, {
      status: NOTIFICATION_STATUSES.RETRY,
      next_attempt_at: nextAttemptAt,
      locked_at: null,
      lock_owner: null,
      last_error: errorCode,
    });
    return {
      state: 'retry_scheduled',
      jobId: job.id,
      attempts: job.attempts,
      nextAttemptAt,
      errorCode,
    };
  }
}

async function stopAwareDelay(milliseconds, options) {
  let remaining = milliseconds;
  while (remaining > 0 && !isStopRequested(options)) {
    const interval = Math.min(remaining, 100);
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, interval);
      timer.unref?.();
    });
    remaining -= interval;
  }
}

async function processAvailableJobs(options = {}) {
  const maxJobs = readBoundedInteger(options.maxJobs ?? options.limit, DEFAULT_BATCH_SIZE, {
    minimum: 1,
    maximum: 1000,
  });
  const rateLimitMs = readBoundedInteger(
    options.rateLimitMs ?? process.env.NOTIFICATION_RATE_LIMIT_MS,
    DEFAULT_RATE_LIMIT_MS,
    { minimum: 0, maximum: 60 * 60 * 1000 }
  );
  const results = [];

  for (let index = 0; index < maxJobs; index += 1) {
    if (isStopRequested(options)) break;
    const result = await processNextJob(options);
    if (result.state === 'idle' || result.state === 'provider_unavailable') {
      if (results.length === 0) return { state: result.state, processed: 0, results: [] };
      break;
    }
    if (result.state === 'stopping') break;

    results.push(result);
    if (index + 1 < maxJobs && rateLimitMs > 0 && !isStopRequested(options)) {
      await stopAwareDelay(rateLimitMs, options);
    }
  }

  const count = (state) => results.filter((result) => result.state === state).length;
  return {
    state: isStopRequested(options) ? 'stopping' : 'processed',
    processed: results.length,
    accepted: count('accepted'),
    retried: count('retry_scheduled'),
    failed: count('failed'),
    expired: count('expired'),
    lostLocks: count('lost_lock'),
    results,
  };
}

let activeWorker = null;

function waitForNextPoll(runtime, milliseconds) {
  return new Promise((resolve) => {
    const finish = () => {
      if (runtime.pollTimer !== null) clearTimeout(runtime.pollTimer);
      runtime.pollTimer = null;
      runtime.wakePoll = null;
      resolve();
    };
    runtime.wakePoll = finish;
    runtime.pollTimer = setTimeout(finish, milliseconds);
    runtime.pollTimer.unref?.();
  });
}

async function runWorker(runtime) {
  const options = runtime.options;
  try {
    while (!runtime.stopRequested) {
      try {
        await processAvailableJobs({
          ...options,
          workerId: runtime.workerId,
          isStopping: () => runtime.stopRequested,
        });
      } catch (error) {
        const logger = options.logger || console;
        if (typeof logger?.error === 'function') {
          logger.error('[NotificationWorker] Poll failed; retrying on the next interval.');
        }
      }

      if (!runtime.stopRequested) {
        await waitForNextPoll(runtime, runtime.pollIntervalMs);
      }
    }
  } finally {
    runtime.running = false;
    if (activeWorker === runtime) activeWorker = null;
  }
}

function startNotificationWorker(options = {}) {
  if (activeWorker?.running) {
    return {
      state: 'already_running',
      workerId: activeWorker.workerId,
    };
  }

  const runtime = {
    running: true,
    stopRequested: false,
    pollTimer: null,
    wakePoll: null,
    workerId: normalizeWorkerId(options.workerId || DEFAULT_WORKER_ID),
    pollIntervalMs: readBoundedInteger(
      options.pollIntervalMs ?? process.env.NOTIFICATION_POLL_INTERVAL_MS,
      DEFAULT_POLL_INTERVAL_MS,
      { minimum: 100, maximum: 60 * 60 * 1000 }
    ),
    options,
    loopPromise: null,
  };
  activeWorker = runtime;
  runtime.loopPromise = runWorker(runtime);

  return {
    state: 'started',
    workerId: runtime.workerId,
  };
}

async function stopNotificationWorker() {
  const runtime = activeWorker;
  if (!runtime) return { state: 'stopped', workerId: null };

  runtime.stopRequested = true;
  runtime.wakePoll?.();
  await runtime.loopPromise;
  return { state: 'stopped', workerId: runtime.workerId };
}

async function getNotificationQueueStats({ prismaClient = prisma, now, staleLockMs } = {}) {
  const currentTime = asNow(now);
  const staleMs = readBoundedInteger(
    staleLockMs ?? process.env.NOTIFICATION_STALE_LOCK_MS,
    DEFAULT_STALE_LOCK_MS,
    { minimum: 1000 }
  );
  const staleBefore = new Date(currentTime.getTime() - staleMs);
  const [groups, due, staleLocks] = await Promise.all([
    prismaClient.notificationJob.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prismaClient.notificationJob.count({
      where: {
        status: { in: CLAIMABLE_STATUSES },
        next_attempt_at: { lte: currentTime },
        OR: [{ expires_at: null }, { expires_at: { gt: currentTime } }],
      },
    }),
    prismaClient.notificationJob.count({
      where: {
        status: NOTIFICATION_STATUSES.PROCESSING,
        OR: [{ locked_at: null }, { locked_at: { lte: staleBefore } }],
      },
    }),
  ]);

  const byStatus = Object.fromEntries(
    Object.values(NOTIFICATION_STATUSES).map((status) => [status, 0])
  );
  for (const group of groups) byStatus[group.status] = group._count?._all ?? 0;

  return {
    total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    pending: byStatus.PENDING,
    processing: byStatus.PROCESSING,
    retry: byStatus.RETRY,
    accepted: byStatus.ACCEPTED,
    delivered: byStatus.DELIVERED,
    failed: byStatus.FAILED,
    expired: byStatus.EXPIRED,
    due,
    staleLocks,
    byStatus,
  };
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUSES,
  NotificationServiceError,
  NotificationValidationError,
  NotificationConfigurationError,
  NotificationPayloadError,
  deriveNotificationEncryptionKey,
  encryptNotificationPayload,
  decryptNotificationPayload,
  enqueueNotification,
  queuePasswordReset,
  queuePasswordChanged,
  queueReportDecision,
  queueReportResubmitted,
  queueRequestUpdate,
  queueDeadlineReminder,
  queueRevisionReminder,
  queueCustomText,
  claimNextNotificationJob,
  calculateRetryDelay,
  processNextJob,
  processAvailableJobs,
  startNotificationWorker,
  stopNotificationWorker,
  getNotificationQueueStats,
};
