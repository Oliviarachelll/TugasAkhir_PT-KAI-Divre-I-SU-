'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  HUMAN_TOKEN_ALPHABET,
  generateHumanToken,
  normalizeHumanToken,
  hashHumanToken,
  HumanTokenValidationError,
} = require('../../src/utils/security-token');

const originalPepper = process.env.TOKEN_PEPPER;
const originalJwtSecret = process.env.JWT_SECRET;

function restoreEnvironment() {
  if (originalPepper === undefined) delete process.env.TOKEN_PEPPER;
  else process.env.TOKEN_PEPPER = originalPepper;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
}

test.after(restoreEnvironment);

test('generateHumanToken returns a formatted Crockford token and HMAC digest', () => {
  process.env.TOKEN_PEPPER = 'test-only-token-pepper';
  const result = generateHumanToken();

  assert.match(result.plainToken, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.equal(result.normalizedToken, result.plainToken.replace(/-/g, ''));
  assert.equal(result.normalizedToken.length, 16);
  assert.match(result.tokenDigest, /^[a-f0-9]{64}$/);
  for (const character of result.normalizedToken) {
    assert.ok(HUMAN_TOKEN_ALPHABET.includes(character));
  }
});

test('normalization removes only ASCII spaces and hyphens', () => {
  assert.equal(normalizeHumanToken('0123-4567 89AB-CDEF'), '0123456789ABCDEF');

  for (const invalid of [
    '0123_4567-89AB-CDEF',
    '0123\t4567-89AB-CDEF',
    '0123-4567-89ab-cdef',
    '0123-4567-89AO-CDEF',
    '0123-4567-89AB-CDE',
  ]) {
    assert.throws(() => normalizeHumanToken(invalid), HumanTokenValidationError);
  }
});

test('hashHumanToken normalizes input and uses TOKEN_PEPPER before JWT_SECRET', () => {
  process.env.TOKEN_PEPPER = 'preferred-pepper';
  process.env.JWT_SECRET = 'fallback-secret';
  const normalized = '0123456789ABCDEF';
  const expected = crypto
    .createHmac('sha256', 'preferred-pepper')
    .update(normalized, 'ascii')
    .digest('hex');

  assert.equal(hashHumanToken('0123-4567-89AB-CDEF'), expected);

  delete process.env.TOKEN_PEPPER;
  const fallbackExpected = crypto
    .createHmac('sha256', 'fallback-secret')
    .update(normalized, 'ascii')
    .digest('hex');
  assert.equal(hashHumanToken(normalized), fallbackExpected);
});
