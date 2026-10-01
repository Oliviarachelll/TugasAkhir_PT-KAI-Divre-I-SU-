'use strict';

const express = require('express');
const router = express.Router();
const waCloudController = require('../controllers/waCloudController');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateBody, validateQuery } = require('../middlewares/validate.middleware');
const { sendError } = require('../utils/response');
const {
  broadcastMessageSchema,
  createNotificationTemplateSchema,
  notificationUnitParamsSchema,
  queueUnitReminderSchema,
  notificationLogsQuerySchema,
} = require('../schemas/notification.schema');

const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const errors = result.error.errors.map((error) => ({
      field: error.path.join('.'),
      message: error.message,
    }));
    return sendError(res, 'Parameter URL tidak valid', 422, errors);
  }
  req.params = result.data;
  return next();
};

const adminOnly = [authenticate, authorize('ADMIN_GLOBAL', 'IT')];

router.post(
  '/broadcast',
  ...adminOnly,
  validateBody(broadcastMessageSchema),
  waCloudController.sendBroadcast
);
router.get('/status', ...adminOnly, waCloudController.getWaStatus);
router.get('/pairing-qr', ...adminOnly, waCloudController.getPairingQr);
router.get('/metrics', ...adminOnly, waCloudController.getNotificationMetrics);
router.get('/belum-lapor', ...adminOnly, waCloudController.getUnitBelumLapor);
router.post(
  '/kirim-unit/:id_unit',
  ...adminOnly,
  validateParams(notificationUnitParamsSchema),
  validateBody(queueUnitReminderSchema),
  waCloudController.kirimPerUnit
);
router.post(
  '/templates',
  ...adminOnly,
  validateBody(createNotificationTemplateSchema),
  waCloudController.createTemplate
);
router.get('/templates', ...adminOnly, waCloudController.getTemplates);
router.get(
  '/logs',
  ...adminOnly,
  validateQuery(notificationLogsQuerySchema),
  waCloudController.getLogs
);

// Meta webhook is intentionally retired and returns an explicit 410 response.
router.get('/webhook', waCloudController.verifyWebhook);
router.post('/webhook', waCloudController.handleWebhook);

module.exports = router;
