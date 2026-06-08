/**
 * Routes: Auth
 */
const router = require('express').Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validate.middleware');
const {
  loginSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  gantiPasswordSchema,
} = require('../schemas/auth.schema');
const {
  login,
  getProfile,
  requestResetPassword,
  resetPassword,
  gantiPassword,
} = require('../controllers/auth.controller');

router.post('/login', validateBody(loginSchema), login);
router.get('/profile', authenticate, getProfile);
router.post('/reset-password/request', validateBody(resetPasswordRequestSchema), requestResetPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);
router.post('/ganti-password', authenticate, validateBody(gantiPasswordSchema), gantiPassword);

module.exports = router;
