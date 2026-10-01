'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBody } = require('../../src/middlewares/validate.middleware');
const { loginSchema } = require('../../src/schemas/auth.schema');
const { createRequest, createResponse } = require('./test-helpers');

test('body validation never writes rejected secrets to console', () => {
  const originalError = console.error;
  let consoleCalls = 0;
  console.error = () => {
    consoleCalls += 1;
  };

  try {
    const req = createRequest({
      body: { email: 'invalid', kata_sandi: 'super-secret-body-value' },
    });
    const res = createResponse();
    let nextCalled = false;
    validateBody(loginSchema)(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 422);
    assert.equal(consoleCalls, 0);
    assert.equal(JSON.stringify(res.body).includes('super-secret-body-value'), false);
  } finally {
    console.error = originalError;
  }
});
