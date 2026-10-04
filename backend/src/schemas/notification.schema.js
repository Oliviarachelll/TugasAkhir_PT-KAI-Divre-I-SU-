'use strict';

const { z } = require('zod');
const { getBusinessDate } = require('../services/business-time');

const NotificationScopeEnum = z.enum(['SEMUA', 'PUSAT', 'DAERAH', 'CABANG']);
const NotificationTemplateTypeEnum = z.enum(['DEADLINE', 'REVISI', 'BROADCAST']);
const NotificationTriggerEnum = z.enum(['MANUAL', 'HARIAN', 'MINGGUAN', 'BULANAN', 'H_MIN_1', 'H_MIN_3']);
const NotificationStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'RETRY',
  'ACCEPTED',
  'DELIVERED',
  'FAILED',
  'EXPIRED',
]);
const NotificationKindEnum = z.enum([
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'REPORT_APPROVED',
  'REPORT_REJECTED',
  'REPORT_REVISION_REQUESTED',
  'REPORT_RESUBMITTED',
  'REQUEST_STATUS',
  'DEADLINE_REMINDER',
  'REVISION_REMINDER',
  'CUSTOM_BROADCAST',
]);

const positiveIdSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return Number(value);
    return value;
  },
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
);

const boundedIntegerSchema = (minimum, maximum) => z.preprocess(
  (value) => {
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
    return value;
  },
  z.number().int().min(minimum).max(maximum)
);

const optionalQueryValue = (schema) => z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  schema.optional()
);

const optionalTrimmedString = (maximum) => z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).max(maximum).optional()
);

const requestKeySchema = z
  .string()
  .trim()
  .min(8, 'requestKey minimal 8 karakter')
  .max(100, 'requestKey maksimal 100 karakter')
  .regex(/^[A-Za-z0-9:_-]+$/, 'requestKey hanya boleh berisi huruf, angka, titik dua, garis bawah, atau tanda hubung');

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tenggat harus berformat YYYY-MM-DD')
  .transform((value, context) => {
    try {
      return getBusinessDate(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tanggal tenggat tidak valid',
      });
      return z.NEVER;
    }
  });

const forceFields = {
  force: z.boolean().optional().default(false),
  requestKey: requestKeySchema.optional(),
};

const requireForceRequestKey = (value, context) => {
  if (value.force && !value.requestKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requestKey'],
      message: 'requestKey wajib untuk pengiriman force',
    });
  }
};

const broadcastMessageSchema = z.object({
  messageType: z.enum(['text', 'template']),
  messageText: optionalTrimmedString(100000),
  templateName: optionalTrimmedString(100),
  unitPenerima: NotificationScopeEnum.optional().default('SEMUA'),
  ...forceFields,
}).strict().superRefine((value, context) => {
  if (value.messageType === 'text' && !value.messageText) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['messageText'],
      message: 'messageText wajib untuk pesan teks',
    });
  }
  if (value.messageType === 'text' && value.templateName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['templateName'],
      message: 'templateName tidak boleh dikirim untuk pesan teks',
    });
  }
  if (value.messageType === 'template' && !value.templateName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['templateName'],
      message: 'templateName wajib untuk pesan template',
    });
  }
  if (value.messageType === 'template' && value.messageText) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['messageText'],
      message: 'messageText tidak boleh dikirim untuk pesan template',
    });
  }
  requireForceRequestKey(value, context);
});

const createNotificationTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[\p{L}\p{N} _-]+$/u, 'Nama template hanya boleh berisi huruf, angka, spasi, garis bawah, atau tanda hubung'),
  body: z.string().trim().min(1).max(100000),
  trigger: NotificationTriggerEnum.optional().default('MANUAL'),
  unit: NotificationScopeEnum.optional().default('SEMUA'),
  tipe_notifikasi: NotificationTemplateTypeEnum,
}).strict().superRefine((value, context) => {
  if (value.tipe_notifikasi !== 'BROADCAST' && value.trigger === 'MANUAL') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['trigger'],
      message: 'Template DEADLINE dan REVISI wajib memiliki trigger terjadwal',
    });
  }
});

const notificationUnitParamsSchema = z.object({
  id_unit: positiveIdSchema,
}).strict();

const queueUnitReminderSchema = z.object({
  tenggat: dateOnlySchema.optional(),
  messageText: optionalTrimmedString(100000),
  pesan: optionalTrimmedString(100000),
  ...forceFields,
}).strict().superRefine(requireForceRequestKey);

const notificationLogsQuerySchema = z.object({
  page: optionalQueryValue(boundedIntegerSchema(1, Number.MAX_SAFE_INTEGER)),
  limit: optionalQueryValue(boundedIntegerSchema(1, 100)),
  status: optionalQueryValue(NotificationStatusEnum),
  jenis: optionalQueryValue(NotificationKindEnum),
}).strict();

module.exports = {
  NotificationScopeEnum,
  NotificationTemplateTypeEnum,
  NotificationTriggerEnum,
  NotificationStatusEnum,
  NotificationKindEnum,
  positiveIdSchema,
  requestKeySchema,
  dateOnlySchema,
  broadcastMessageSchema,
  createNotificationTemplateSchema,
  notificationUnitParamsSchema,
  queueUnitReminderSchema,
  notificationLogsQuerySchema,
};
