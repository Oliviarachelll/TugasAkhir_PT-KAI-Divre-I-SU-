'use strict';

const rateLimitPackage = require('express-rate-limit');
const { sendError } = require('../utils/response');

const rateLimit =
  rateLimitPackage.rateLimit || rateLimitPackage.default || rateLimitPackage;

function boundedInteger(value, fallback, minimum = 1, maximum = 1000000) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function createAuthRateLimiter({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => sendError(res, message, 429),
  });
}

const loginRateLimiter = createAuthRateLimiter({
  windowMs: boundedInteger(process.env.AUTH_LOGIN_RATE_WINDOW_MS, 15 * 60 * 1000),
  limit: boundedInteger(process.env.AUTH_LOGIN_RATE_LIMIT, 100),
  skipSuccessfulRequests: true,
  message: 'Terlalu banyak percobaan login. Silakan coba lagi nanti.',
});

const recoveryRateLimiter = createAuthRateLimiter({
  windowMs: boundedInteger(process.env.AUTH_RECOVERY_RATE_WINDOW_MS, 60 * 60 * 1000),
  limit: boundedInteger(process.env.AUTH_RECOVERY_RATE_LIMIT, 5),
  message: 'Terlalu banyak permintaan pemulihan. Silakan coba lagi nanti.',
});

const redemptionRateLimiter = createAuthRateLimiter({
  windowMs: boundedInteger(process.env.AUTH_REDEMPTION_RATE_WINDOW_MS, 15 * 60 * 1000),
  limit: boundedInteger(process.env.AUTH_REDEMPTION_RATE_LIMIT, 10),
  message: 'Terlalu banyak percobaan token. Silakan coba lagi nanti.',
});

const contactUpdateRateLimiter = createAuthRateLimiter({
  windowMs: boundedInteger(process.env.AUTH_CONTACT_RATE_WINDOW_MS, 15 * 60 * 1000),
  limit: boundedInteger(process.env.AUTH_CONTACT_RATE_LIMIT, 10),
  skipSuccessfulRequests: true,
  message: 'Terlalu banyak percobaan perubahan kontak. Silakan coba lagi nanti.',
});

module.exports = {
  createAuthRateLimiter,
  loginRateLimiter,
  recoveryRateLimiter,
  redemptionRateLimiter,
  contactUpdateRateLimiter,
};
