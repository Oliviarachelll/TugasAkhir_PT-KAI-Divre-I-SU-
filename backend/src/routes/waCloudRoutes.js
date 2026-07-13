const express = require('express');
const router = express.Router();
const waCloudController = require('../controllers/waCloudController');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Protect route to ensure only logged in global admins can send broadcasts
router.post(
  '/broadcast',
  authenticate,
  authorize('ADMIN_GLOBAL'), // adjust if the role is different, e.g. 'ADMIN'
  waCloudController.sendBroadcast
);
router.post(
  '/templates',
  authenticate,
  authorize('ADMIN_GLOBAL'),
  waCloudController.createTemplate
);

router.get(
  '/templates',
  authenticate,
  authorize('ADMIN_GLOBAL'),
  waCloudController.getTemplates
);

router.get(
  '/logs',
  authenticate,
  authorize('ADMIN_GLOBAL'),
  waCloudController.getLogs
);

// Route untuk Webhook Meta
router.get('/webhook', waCloudController.verifyWebhook);
router.post('/webhook', waCloudController.handleWebhook);

module.exports = router;
