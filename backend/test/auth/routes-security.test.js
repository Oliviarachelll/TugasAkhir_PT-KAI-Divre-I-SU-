'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../../src/routes/auth.routes');
const { authenticate } = require('../../src/middlewares/auth.middleware');
const {
  loginRateLimiter,
  recoveryRateLimiter,
  redemptionRateLimiter,
  contactUpdateRateLimiter,
} = require('../../src/middlewares/rate-limit.middleware');

function routeHandler(path, index) {
  const layer = router.stack.find((candidate) => candidate.route?.path === path);
  assert.ok(layer, `route ${path} must exist`);
  return layer.route.stack[index].handle;
}

test('auth routes mount IP rate limits before validation and controllers', () => {
  assert.strictEqual(routeHandler('/login', 0), loginRateLimiter);
  assert.strictEqual(routeHandler('/reset-password/request', 0), recoveryRateLimiter);
  assert.strictEqual(routeHandler('/request-unlock-ticket', 0), recoveryRateLimiter);
  assert.strictEqual(routeHandler('/reset-password', 0), redemptionRateLimiter);
});

test('WhatsApp contact updates require authentication before rate limiting', () => {
  assert.strictEqual(routeHandler('/profile/whatsapp', 0), authenticate);
  assert.strictEqual(routeHandler('/profile/whatsapp', 1), contactUpdateRateLimiter);
});
