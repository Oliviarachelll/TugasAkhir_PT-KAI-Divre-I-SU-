'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAuthMiddleware,
  SESSION_INVALID_MESSAGE,
} = require('../../src/middlewares/auth.middleware');
const { createRequest, createResponse } = require('./test-helpers');

test('authentication rejects JWTs whose session_version is stale or missing', async () => {
  const prismaClient = {
    pengguna: {
      findUnique: async () => ({
        id_pengguna: 1,
        nama: 'User',
        email: 'user@example.com',
        peran: 'USER_UNIT',
        terkunci: false,
        terkunci_sampai: null,
        session_version: 3,
        id_unit: 1,
      }),
    },
  };

  for (const decoded of [
    { id_pengguna: 1, session_version: 2 },
    { id_pengguna: 1 },
  ]) {
    const { authenticate } = createAuthMiddleware({
      prismaClient,
      verifyTokenFn: () => decoded,
    });
    const req = createRequest({ headers: { authorization: 'Bearer valid.jwt.token' } });
    const res = createResponse();
    let nextCalled = false;

    await authenticate(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, SESSION_INVALID_MESSAGE);
  }
});

test('expired temporary locks are cleared before authentication continues', async () => {
  const updates = [];
  const prismaClient = {
    pengguna: {
      findUnique: async () => ({
        id_pengguna: 1,
        nama: 'User',
        email: 'user@example.com',
        peran: 'USER_UNIT',
        terkunci: true,
        terkunci_sampai: new Date('2026-09-30T00:59:59.000Z'),
        session_version: 3,
        id_unit: 1,
      }),
      async updateMany(query) {
        updates.push(query);
        return { count: 1 };
      },
    },
  };
  const { authenticate } = createAuthMiddleware({
    prismaClient,
    verifyTokenFn: () => ({ id_pengguna: 1, session_version: 3 }),
    clock: () => new Date('2026-09-30T01:00:00.000Z'),
  });
  const req = createRequest({ headers: { authorization: 'Bearer valid.jwt.token' } });
  const res = createResponse();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
  assert.equal(updates.length, 1);
  assert.equal(req.pengguna.terkunci, false);
  assert.equal(req.pengguna.terkunci_sampai, null);
});

test('active and permanent locks block otherwise valid sessions', async () => {
  for (const terkunciSampai of [new Date('2026-09-30T02:00:00.000Z'), null]) {
    const { authenticate } = createAuthMiddleware({
      prismaClient: {
        pengguna: {
          findUnique: async () => ({
            id_pengguna: 1,
            nama: 'User',
            email: 'user@example.com',
            peran: 'USER_UNIT',
            terkunci: true,
            terkunci_sampai: terkunciSampai,
            session_version: 3,
            id_unit: 1,
          }),
        },
      },
      verifyTokenFn: () => ({ id_pengguna: 1, session_version: 3 }),
      clock: () => new Date('2026-09-30T01:00:00.000Z'),
    });
    const res = createResponse();
    let nextCalls = 0;
    let nextError;

    await authenticate(
      createRequest({ headers: { authorization: 'Bearer valid.jwt.token' } }),
      res,
      (error) => {
        nextCalls += 1;
        nextError = error;
      }
    );

    assert.equal(nextCalls, 0, nextError?.stack);
    assert.equal(res.statusCode, 403);
  }
});
