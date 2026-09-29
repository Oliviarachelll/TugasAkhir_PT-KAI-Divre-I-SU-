const express = require('express');
const router = express.Router();
const waCloudController = require('../controllers/waCloudController');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Protect route to ensure only logged in global admins can send broadcasts (via Baileys)
router.post(
  '/broadcast',
  authenticate,
  authorize('ADMIN_GLOBAL', 'IT'),
  waCloudController.sendBroadcast
);

// Pengingat kondisional Baileys
router.get(
  '/status',
  authenticate,
  authorize('ADMIN_GLOBAL', 'IT'),
  waCloudController.getWaStatus
);
router.get(
  '/belum-lapor',
  authenticate,
  authorize('ADMIN_GLOBAL', 'IT'),
  waCloudController.getUnitBelumLapor
);
router.post(
  '/kirim-unit/:id_unit',
  authenticate,
  authorize('ADMIN_GLOBAL', 'IT'),
  waCloudController.kirimPerUnit
);
router.post(
  '/templates',
  authenticate,
  authorize('ADMIN_GLOBAL', 'IT'),
  waCloudController.createTemplate
);

router.get(
  '/templates',
  authenticate,
  authorize('ADMIN_GLOBAL', 'IT'),
  waCloudController.getTemplates
);

router.get(
  '/logs',
  authenticate,
  authorize('ADMIN_GLOBAL', 'IT'),
  waCloudController.getLogs
);

// Webhook Meta DEPRECATED — dipertahankan agar URL lama mengembalikan 410 yang jelas
router.get('/webhook', waCloudController.verifyWebhook);
router.post('/webhook', waCloudController.handleWebhook);

module.exports = router;
