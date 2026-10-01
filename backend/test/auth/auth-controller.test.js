'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAuthController,
  DUMMY_PASSWORD_HASH,
  GENERIC_LOGIN_MESSAGE,
  GENERIC_RESET_REQUEST_MESSAGE,
  GENERIC_UNLOCK_REQUEST_MESSAGE,
  GENERIC_RESET_TOKEN_MESSAGE,
  LOGIN_LOCK_MS,
} = require('../../src/controllers/auth.controller');
const { createRequest, createResponse } = require('./test-helpers');

test('unknown login performs dummy bcrypt and returns the generic failure', async () => {
  const compareCalls = [];
  const controller = createAuthController({
    prismaClient: {
      pengguna: { findUnique: async () => null },
    },
    bcryptService: {
      async compare(password, hash) {
        compareCalls.push({ password, hash });
        return false;
      },
    },
  });
  const res = createResponse();

  await controller.login(
    createRequest({ body: { email: 'missing@example.com', kata_sandi: 'candidate' } }),
    res
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, GENERIC_LOGIN_MESSAGE);
  assert.deepEqual(compareCalls, [
    { password: 'candidate', hash: DUMMY_PASSWORD_HASH },
  ]);
});

test('three failed logins create a 15-minute lock with generic responses', async () => {
  const initialTime = Date.parse('2026-09-30T01:00:00.000Z');
  let currentTime = initialTime;
  let passwordMatches = false;
  let jwtPayload;
  const user = {
    id_pengguna: 9,
    nama: 'Budi',
    email: 'budi@example.com',
    kata_sandi: 'stored-hash',
    peran: 'USER_UNIT',
    no_hp: '6281234567890',
    id_unit: 2,
    unit: { nama_unit: 'Unit Dua' },
    percobaan_login: 0,
    terkunci: false,
    terkunci_sampai: null,
    session_version: 4,
  };

  const db = {
    pengguna: {
      async findUnique(query) {
        if (query.where.email) return { ...user };
        if (query.where.id_pengguna === user.id_pengguna) {
          return { session_version: user.session_version };
        }
        return null;
      },
      async update(query) {
        if (query.data.percobaan_login?.increment) {
          user.percobaan_login += query.data.percobaan_login.increment;
          return { percobaan_login: user.percobaan_login };
        }
        if (query.data.terkunci === true) {
          user.terkunci = true;
          user.terkunci_sampai = query.data.terkunci_sampai;
        }
        return { ...user };
      },
      async updateMany(query) {
        if (query.where.terkunci === true) {
          const cutoff = query.where.terkunci_sampai.lte.getTime();
          if (!user.terkunci || !user.terkunci_sampai || user.terkunci_sampai.getTime() > cutoff) {
            return { count: 0 };
          }
        } else if (query.where.OR) {
          const lockActive =
            user.terkunci &&
            (!user.terkunci_sampai || user.terkunci_sampai.getTime() > currentTime);
          if (lockActive) return { count: 0 };
        }
        Object.assign(user, {
          percobaan_login: query.data.percobaan_login,
          terkunci: query.data.terkunci,
          terkunci_sampai: query.data.terkunci_sampai,
        });
        return { count: 1 };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createAuthController({
    prismaClient: db,
    bcryptService: {
      compare: async () => passwordMatches,
    },
    generateTokenFn(payload) {
      jwtPayload = payload;
      return 'signed-jwt';
    },
    clock: () => new Date(currentTime),
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = createResponse();
    await controller.login(
      createRequest({ body: { email: user.email, kata_sandi: 'wrong' } }),
      res
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, GENERIC_LOGIN_MESSAGE);
  }

  assert.equal(user.percobaan_login, 3);
  assert.equal(user.terkunci, true);
  assert.equal(user.terkunci_sampai.getTime(), initialTime + LOGIN_LOCK_MS);

  const lockedResponse = createResponse();
  await controller.login(
    createRequest({ body: { email: user.email, kata_sandi: 'wrong' } }),
    lockedResponse
  );
  assert.equal(lockedResponse.body.message, GENERIC_LOGIN_MESSAGE);
  assert.equal(user.percobaan_login, 3);

  currentTime = initialTime + LOGIN_LOCK_MS + 1;
  passwordMatches = true;
  const successResponse = createResponse();
  await controller.login(
    createRequest({ body: { email: user.email, kata_sandi: 'correct' } }),
    successResponse
  );

  assert.equal(successResponse.statusCode, 200);
  assert.equal(successResponse.body.data.token, 'signed-jwt');
  assert.equal(user.terkunci, false);
  assert.equal(user.terkunci_sampai, null);
  assert.equal(user.percobaan_login, 0);
  assert.equal(jwtPayload.session_version, 4);
});

test('reset request stores only a digest and queues plaintext inside the transaction', async () => {
  const tokenWrites = [];
  const queueCalls = [];
  const user = {
    id_pengguna: 12,
    nama: 'Siti',
    no_hp: '081234567890',
  };
  const db = {
    pengguna: {
      findUnique: async (query) =>
        query.where.email === 'known@example.com' ? user : null,
    },
    tokenReset: {
      async updateMany(query) {
        tokenWrites.push({ operation: 'invalidate', query });
        return { count: 0 };
      },
      async create(query) {
        tokenWrites.push({ operation: 'create', query });
        return { id_token_reset: 44 };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createAuthController({
    prismaClient: db,
    generateHumanTokenFn: () => ({
      plainToken: '0123-4567-89AB-CDEF',
      normalizedToken: '0123456789ABCDEF',
      tokenDigest: 'd'.repeat(64),
    }),
    queuePasswordResetFn: async (args) => {
      queueCalls.push(args);
      return { state: 'queued', jobId: 1 };
    },
    isValidPhoneFn: () => true,
    clock: () => new Date('2026-09-30T01:00:00.000Z'),
  });

  const knownResponse = createResponse();
  await controller.requestResetPassword(
    createRequest({ body: { email: 'known@example.com' } }),
    knownResponse
  );
  const unknownResponse = createResponse();
  await controller.requestResetPassword(
    createRequest({ body: { email: 'unknown@example.com' } }),
    unknownResponse
  );

  assert.equal(knownResponse.body.message, GENERIC_RESET_REQUEST_MESSAGE);
  assert.equal(unknownResponse.body.message, GENERIC_RESET_REQUEST_MESSAGE);
  assert.equal(knownResponse.statusCode, unknownResponse.statusCode);

  const createWrite = tokenWrites.find((entry) => entry.operation === 'create').query.data;
  assert.equal(createWrite.token, 'd'.repeat(64));
  assert.equal(JSON.stringify(createWrite).includes('0123-4567-89AB-CDEF'), false);
  assert.equal(queueCalls.length, 1);
  assert.strictEqual(queueCalls[0].tx, db);
  assert.equal(queueCalls[0].token, '0123-4567-89AB-CDEF');
  assert.equal(queueCalls[0].dedupeKey, 'password-reset:44');
});

test('recovery failures are logged without email, token, or internal error details', async () => {
  const logs = [];
  const sensitiveEmail = 'private-user@example.com';
  const sensitiveToken = '0123-4567-89AB-CDEF';
  const db = {
    pengguna: {
      findUnique: async () => {
        throw new Error(`database failure for ${sensitiveEmail} and ${sensitiveToken}`);
      },
    },
    async $transaction() {
      throw new Error(`transaction failure for ${sensitiveEmail}`);
    },
  };
  const controller = createAuthController({
    prismaClient: db,
    generateHumanTokenFn: () => ({
      plainToken: sensitiveToken,
      normalizedToken: sensitiveToken.replaceAll('-', ''),
      tokenDigest: 'd'.repeat(64),
    }),
    logger: {
      error(...args) {
        logs.push(args);
      },
    },
  });

  const resetResponse = createResponse();
  await controller.requestResetPassword(
    createRequest({ body: { email: sensitiveEmail } }),
    resetResponse
  );
  const unlockResponse = createResponse();
  await controller.requestUnlockTicket(
    createRequest({ body: { email: sensitiveEmail } }),
    unlockResponse
  );

  assert.equal(resetResponse.body.message, GENERIC_RESET_REQUEST_MESSAGE);
  assert.equal(unlockResponse.body.message, GENERIC_UNLOCK_REQUEST_MESSAGE);
  assert.deepEqual(logs, [
    ['[Auth] Password reset request could not be queued.'],
    ['[Auth] Unlock request could not be processed.'],
  ]);
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes(sensitiveEmail), false);
  assert.equal(serializedLogs.includes(sensitiveToken), false);
  assert.equal(serializedLogs.includes('database failure'), false);
  assert.equal(serializedLogs.includes('transaction failure'), false);
});

test('reset redemption atomically consumes once, rotates session, and queues notification', async () => {
  let consumeCount = 1;
  let userUpdateCount = 0;
  const tokenUpdates = [];
  const queueCalls = [];
  const tokenRecord = {
    id_token_reset: 55,
    id_pengguna: 12,
    tujuan: 'RESET_PASSWORD',
    sudah_dipakai: false,
    kedaluwarsa_pada: new Date('2026-09-30T02:00:00.000Z'),
    pengguna: { id_pengguna: 12, nama: 'Siti', no_hp: '6281234567890' },
  };
  const db = {
    tokenReset: {
      findUnique: async () => tokenRecord,
      async updateMany(query) {
        tokenUpdates.push(query);
        if (query.where.id_token_reset === tokenRecord.id_token_reset && query.where.token) {
          return { count: consumeCount };
        }
        return { count: 2 };
      },
    },
    pengguna: {
      async update(query) {
        userUpdateCount += 1;
        assert.deepEqual(query.data.session_version, { increment: 1 });
        return {
          id_pengguna: 12,
          nama: 'Siti',
          no_hp: '6281234567890',
          session_version: 8,
        };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createAuthController({
    prismaClient: db,
    hashHumanTokenFn: () => 'h'.repeat(64),
    bcryptService: { hash: async () => 'new-password-hash' },
    queuePasswordChangedFn: async (args) => {
      queueCalls.push(args);
      return { state: 'queued' };
    },
    isValidPhoneFn: () => true,
    clock: () => new Date('2026-09-30T01:00:00.000Z'),
  });

  const successResponse = createResponse();
  await controller.resetPassword(
    createRequest({
      body: { token: '0123456789ABCDEF', kata_sandi_baru: 'new-password-123' },
    }),
    successResponse
  );

  assert.equal(successResponse.statusCode, 200);
  assert.equal(userUpdateCount, 1);
  assert.equal(tokenUpdates[0].where.sudah_dipakai, false);
  assert.deepEqual(tokenUpdates[0].data.attempt_count, { increment: 1 });
  assert.equal(queueCalls.length, 1);
  assert.strictEqual(queueCalls[0].tx, db);
  assert.equal(queueCalls[0].dedupeKey, 'password-changed:reset:55');

  consumeCount = 0;
  userUpdateCount = 0;
  queueCalls.length = 0;
  const racedResponse = createResponse();
  await controller.resetPassword(
    createRequest({
      body: { token: '0123456789ABCDEF', kata_sandi_baru: 'new-password-123' },
    }),
    racedResponse
  );
  assert.equal(racedResponse.statusCode, 400);
  assert.equal(racedResponse.body.message, GENERIC_RESET_TOKEN_MESSAGE);
  assert.equal(userUpdateCount, 0);
  assert.equal(queueCalls.length, 0);
});

test('unlock requests create only one pending ticket for an actively locked account', async () => {
  const tickets = [];
  const users = {
    'locked@example.com': {
      id_pengguna: 1,
      terkunci: true,
      terkunci_sampai: new Date('2026-09-30T02:00:00.000Z'),
    },
    'open@example.com': {
      id_pengguna: 2,
      terkunci: false,
      terkunci_sampai: null,
    },
  };
  let transactionOptions;
  const db = {
    pengguna: {
      findUnique: async (query) => users[query.where.email] || null,
      updateMany: async () => ({ count: 0 }),
    },
    permintaanBantuan: {
      findFirst: async (query) =>
        tickets.find(
          (ticket) => ticket.id_pengguna_pengaju === query.where.id_pengguna_pengaju
        ) || null,
      async create(query) {
        const ticket = { id_permintaan: tickets.length + 1, ...query.data };
        tickets.push(ticket);
        return ticket;
      },
    },
    async $transaction(callback, options) {
      transactionOptions = options;
      return callback(this);
    },
  };
  const controller = createAuthController({
    prismaClient: db,
    clock: () => new Date('2026-09-30T01:00:00.000Z'),
  });

  const messages = [];
  for (const email of [
    'locked@example.com',
    'locked@example.com',
    'open@example.com',
    'missing@example.com',
  ]) {
    const res = createResponse();
    await controller.requestUnlockTicket(createRequest({ body: { email } }), res);
    messages.push(res.body.message);
  }

  assert.equal(tickets.length, 1);
  assert.deepEqual(new Set(messages), new Set([GENERIC_UNLOCK_REQUEST_MESSAGE]));
  assert.deepEqual(transactionOptions, { isolationLevel: 'Serializable' });
});

test('authenticated users update only their WhatsApp contact after password confirmation', async () => {
  const updates = [];
  const tokenInvalidations = [];
  const auditWrites = [];
  let passwordMatches = true;
  const user = {
    id_pengguna: 31,
    kata_sandi: 'stored-password-hash',
    no_hp: '628111111111',
  };
  const db = {
    pengguna: {
      findUnique: async () => user,
      async update(query) {
        updates.push(query);
        return {
          id_pengguna: 31,
          nama: 'Admin Unit KNA',
          email: 'unit@example.com',
          peran: 'USER_UNIT',
          no_hp: query.data.no_hp,
          id_unit: 4,
          unit: { id_unit: 4, nama_unit: 'Unit KNA', jenis_unit: 'KNA' },
        };
      },
    },
    tokenReset: {
      async updateMany(query) {
        tokenInvalidations.push(query);
        return { count: 1 };
      },
    },
    logAudit: {
      async create(query) {
        auditWrites.push(query);
        return { id_log_audit: 1 };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createAuthController({
    prismaClient: db,
    bcryptService: {
      async compare(candidate, hash) {
        assert.equal(candidate, 'current-password');
        assert.equal(hash, user.kata_sandi);
        return passwordMatches;
      },
    },
    clock: () => new Date('2026-10-01T08:00:00.000Z'),
  });

  const successResponse = createResponse();
  await controller.updateWhatsappContact(
    createRequest({
      body: { no_hp: '6281234567890', kata_sandi: 'current-password' },
      pengguna: { id_pengguna: 31 },
    }),
    successResponse
  );

  assert.equal(successResponse.statusCode, 200);
  assert.equal(successResponse.body.data.no_hp, '6281234567890');
  assert.equal(successResponse.body.data.kata_sandi, undefined);
  assert.deepEqual(updates[0].data, { no_hp: '6281234567890' });
  assert.deepEqual(tokenInvalidations[0].where, {
    id_pengguna: 31,
    sudah_dipakai: false,
  });
  assert.equal(auditWrites[0].data.aksi, 'UPDATE_WHATSAPP_CONTACT');
  const serializedAudit = JSON.stringify(auditWrites[0]);
  assert.equal(serializedAudit.includes('6281234567890'), false);
  assert.equal(serializedAudit.includes('628111111111'), false);
  assert.equal(serializedAudit.includes('current-password'), false);

  passwordMatches = false;
  const rejectedResponse = createResponse();
  await controller.updateWhatsappContact(
    createRequest({
      body: { no_hp: '628999999999', kata_sandi: 'current-password' },
      pengguna: { id_pengguna: 31 },
    }),
    rejectedResponse
  );

  assert.equal(rejectedResponse.statusCode, 400);
  assert.equal(rejectedResponse.body.message, 'Kata sandi tidak sesuai');
  assert.equal(updates.length, 1);
  assert.equal(auditWrites.length, 1);
});
