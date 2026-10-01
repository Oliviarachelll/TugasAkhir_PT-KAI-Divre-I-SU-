'use strict';

const router = require('express').Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validate.middleware');
const {
  loginRateLimiter,
  recoveryRateLimiter,
  redemptionRateLimiter,
  contactUpdateRateLimiter,
} = require('../middlewares/rate-limit.middleware');
const {
  loginSchema,
  resetPasswordRequestSchema,
  unlockRequestSchema,
  resetPasswordSchema,
  gantiPasswordSchema,
  updateWhatsappContactSchema,
} = require('../schemas/auth.schema');
const {
  login,
  getProfile,
  requestResetPassword,
  requestUnlockTicket,
  resetPassword,
  gantiPassword,
  updateWhatsappContact,
} = require('../controllers/auth.controller');

router.post('/login', loginRateLimiter, validateBody(loginSchema), login);
router.get('/profile', authenticate, getProfile);
router.patch(
  '/profile/whatsapp',
  authenticate,
  contactUpdateRateLimiter,
  validateBody(updateWhatsappContactSchema),
  updateWhatsappContact
);
router.post(
  '/reset-password/request',
  recoveryRateLimiter,
  validateBody(resetPasswordRequestSchema),
  requestResetPassword
);
router.post(
  '/request-unlock-ticket',
  recoveryRateLimiter,
  validateBody(unlockRequestSchema),
  requestUnlockTicket
);
router.post(
  '/reset-password',
  redemptionRateLimiter,
  validateBody(resetPasswordSchema),
  resetPassword
);
router.post('/ganti-password', authenticate, validateBody(gantiPasswordSchema), gantiPassword);

module.exports = router;
