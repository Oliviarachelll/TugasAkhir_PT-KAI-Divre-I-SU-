'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPermintaanController,
  TOKEN_TTL_MS,
} = require('../../src/controllers/permintaan.controller');
const { createRequest, createResponse } = require('./test-helpers');

const TOKEN_BUNDLE = {
  plainToken: '0123-4567-89AB-CDEF',
  normalizedToken: '0123456789ABCDEF',
  tokenDigest: 'd'.repeat(64),
};

test('access completion atomically stores digest and queues encrypted reset token', async () => {
  const ticket = {
    id_permintaan: 41,
    jenis: 'PERMINTAAN_AKSES',
    status: 'MENUNGGU',
    id_pengguna_pengaju: 11,
    id_laporan: null,
    pengaju: {
      id_pengguna: 11,
      nama: 'Budi',
      no_hp: '081234567890',
      id_unit: 3,
    },
    laporan: null,
  };
  const ticketUpdates = [];
  const tokenInvalidations = [];
  const tokenCreates = [];
  const queueCalls = [];
  let transactionCount = 0;
  const db = {
    permintaanBantuan: {
      findUnique: async () => ({ ...ticket }),
      async updateMany(query) {
        ticketUpdates.push(query);
        ticket.status = query.data.status;
        ticket.id_pengguna_penanganan = query.data.id_pengguna_penanganan;
        return { count: 1 };
      },
    },
    tokenReset: {
      async updateMany(query) {
        tokenInvalidations.push(query);
        return { count: 2 };
      },
      async create(query) {
        tokenCreates.push(query);
        return { id_token_reset: 88 };
      },
    },
    async $transaction(callback) {
      transactionCount += 1;
      return callback(this);
    },
  };
  const controller = createPermintaanController({
    prismaClient: db,
    generateHumanTokenFn: () => TOKEN_BUNDLE,
    normalizePhoneFn: () => '6281234567890',
    queuePasswordResetFn: async (args) => {
      queueCalls.push(args);
      return { state: 'queued', jobId: 501, dedupeKey: args.dedupeKey };
    },
    clock: () => new Date('2026-09-30T01:00:00.000Z'),
  });
  const res = createResponse();

  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 41 },
      body: { status: 'SELESAI' },
      pengguna: { id_pengguna: 99, peran: 'IT' },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(transactionCount, 1);
  assert.equal(ticketUpdates[0].data.status, 'SELESAI');
  assert.equal(ticketUpdates[0].data.id_pengguna_penanganan, 99);
  assert.deepEqual(tokenInvalidations[0].where, {
    id_pengguna: 11,
    sudah_dipakai: false,
  });
  assert.equal(tokenCreates[0].data.token, TOKEN_BUNDLE.tokenDigest);
  assert.equal(tokenCreates[0].data.tujuan, 'RESET_PASSWORD');
  assert.equal(
    tokenCreates[0].data.kedaluwarsa_pada.getTime(),
    Date.parse('2026-09-30T01:00:00.000Z') + TOKEN_TTL_MS
  );
  assert.equal(JSON.stringify(tokenCreates[0]).includes(TOKEN_BUNDLE.plainToken), false);
  assert.equal(queueCalls.length, 1);
  assert.strictEqual(queueCalls[0].tx, db);
  assert.equal(queueCalls[0].token, TOKEN_BUNDLE.plainToken);
  assert.equal(queueCalls[0].recipientPhone, '6281234567890');
  assert.deepEqual(res.body.data.delivery, { state: 'queued', jobId: 501 });
  assert.equal(JSON.stringify(res.body).includes(TOKEN_BUNDLE.plainToken), false);
  assert.equal(JSON.stringify(res.body).includes(TOKEN_BUNDLE.tokenDigest), false);
});

test('access completion fails before transaction when recipient phone is invalid', async () => {
  let transactionCount = 0;
  let tokenGenerationCount = 0;
  const controller = createPermintaanController({
    prismaClient: {
      permintaanBantuan: {
        findUnique: async () => ({
          id_permintaan: 41,
          jenis: 'PERMINTAAN_AKSES',
          status: 'MENUNGGU',
          id_pengguna_pengaju: 11,
          id_laporan: null,
          pengaju: {
            id_pengguna: 11,
            nama: 'Budi',
            no_hp: 'invalid',
            id_unit: 3,
          },
          laporan: null,
        }),
      },
      async $transaction() {
        transactionCount += 1;
      },
    },
    normalizePhoneFn: () => null,
    generateHumanTokenFn: () => {
      tokenGenerationCount += 1;
      return TOKEN_BUNDLE;
    },
  });
  const res = createResponse();

  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 41 },
      body: { status: 'SELESAI' },
      pengguna: { id_pengguna: 99, peran: 'IT' },
    }),
    res
  );

  assert.equal(res.statusCode, 422);
  assert.equal(transactionCount, 0);
  assert.equal(tokenGenerationCount, 0);
});

test('clarification completion stores only report digest and queues token payload', async () => {
  const ticket = {
    id_permintaan: 52,
    jenis: 'KLARIFIKASI_DATA',
    status: 'DIPROSES',
    id_pengguna_pengaju: 11,
    id_laporan: 7,
    pengaju: {
      id_pengguna: 11,
      nama: 'Siti',
      no_hp: '6281234567890',
      id_unit: 3,
    },
    laporan: {
      id_laporan: 7,
      id_pengguna: 11,
      id_unit: 3,
      status: 'DISETUJUI',
    },
  };
  const reportUpdates = [];
  const queueCalls = [];
  const db = {
    permintaanBantuan: {
      findUnique: async () => ({ ...ticket }),
      async updateMany(query) {
        ticket.status = query.data.status;
        ticket.id_pengguna_penanganan = query.data.id_pengguna_penanganan;
        return { count: 1 };
      },
    },
    laporan: {
      async updateMany(query) {
        reportUpdates.push(query);
        return { count: 1 };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createPermintaanController({
    prismaClient: db,
    generateHumanTokenFn: () => TOKEN_BUNDLE,
    normalizePhoneFn: () => '6281234567890',
    enqueueNotificationFn: async (args) => {
      queueCalls.push(args);
      return { state: 'queued', jobId: 502 };
    },
    clock: () => new Date('2026-09-30T01:00:00.000Z'),
  });
  const res = createResponse();

  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 52 },
      body: { status: 'SELESAI' },
      pengguna: { id_pengguna: 100, peran: 'ADMIN_GLOBAL' },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(reportUpdates[0].data.token_revisi, TOKEN_BUNDLE.tokenDigest);
  assert.equal(JSON.stringify(reportUpdates[0]).includes(TOKEN_BUNDLE.plainToken), false);
  assert.equal(reportUpdates[0].where.id_pengguna, 11);
  assert.equal(reportUpdates[0].where.status, 'DISETUJUI');
  assert.equal(queueCalls.length, 1);
  assert.strictEqual(queueCalls[0].tx, db);
  assert.equal(queueCalls[0].jenis, 'REPORT_REVISION_REQUESTED');
  assert.equal(queueCalls[0].text.includes(TOKEN_BUNDLE.plainToken), true);
  assert.equal(JSON.stringify(queueCalls[0].metadata).includes(TOKEN_BUNDLE.plainToken), false);
  assert.deepEqual(res.body.data.delivery, { state: 'queued', jobId: 502 });
  assert.equal(JSON.stringify(res.body).includes(TOKEN_BUNDLE.plainToken), false);
  assert.equal(JSON.stringify(res.body).includes(TOKEN_BUNDLE.tokenDigest), false);
});
