'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPenggunaController,
} = require('../../src/controllers/pengguna.controller');
const { createRequest, createResponse } = require('./test-helpers');

test('admin password update increments session, invalidates tokens, and queues notice', async () => {
  const updateQueries = [];
  const tokenQueries = [];
  const queueCalls = [];
  const existing = {
    id_pengguna: 7,
    nama: 'Target User',
    email: 'target@example.com',
    no_hp: '6281234567890',
    terkunci: false,
  };
  const db = {
    pengguna: {
      findUnique: async () => existing,
      async update(query) {
        updateQueries.push(query);
        return {
          id_pengguna: 7,
          nama: 'Target User',
          email: 'target@example.com',
          peran: 'USER_UNIT',
          no_hp: '6281234567890',
          terkunci: false,
          session_version: 6,
          updated_at: new Date('2026-09-30T01:00:00.000Z'),
        };
      },
    },
    tokenReset: {
      async updateMany(query) {
        tokenQueries.push(query);
        return { count: 2 };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createPenggunaController({
    prismaClient: db,
    bcryptService: { hash: async () => 'admin-password-hash' },
    queuePasswordChangedFn: async (args) => {
      queueCalls.push(args);
      return { state: 'queued' };
    },
    isValidPhoneFn: () => true,
    clock: () => new Date('2026-09-30T01:00:00.000Z'),
  });
  const res = createResponse();

  await controller.updatePengguna(
    createRequest({
      params: { id: '7' },
      body: { kata_sandi: 'new-password-123' },
      pengguna: { id_pengguna: 99 },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(updateQueries[0].data.kata_sandi, 'admin-password-hash');
  assert.deepEqual(updateQueries[0].data.session_version, { increment: 1 });
  assert.deepEqual(tokenQueries[0].where, {
    id_pengguna: 7,
    sudah_dipakai: false,
  });
  assert.equal(queueCalls.length, 1);
  assert.strictEqual(queueCalls[0].tx, db);
  assert.equal(queueCalls[0].dedupeKey, 'password-changed:admin:7:session:6');
  assert.equal(res.body.data.session_version, undefined);
});

test('admin unlock resets lock, rotates session, invalidates tokens, closes tickets, and audits', async () => {
  const updates = [];
  const tokenInvalidations = [];
  const ticketUpdates = [];
  const auditWrites = [];
  const db = {
    pengguna: {
      findUnique: async () => ({
        id_pengguna: 7,
        terkunci: true,
        terkunci_sampai: new Date('2026-09-30T02:00:00.000Z'),
      }),
      async update(query) {
        updates.push(query);
        return { session_version: 10 };
      },
    },
    tokenReset: {
      async updateMany(query) {
        tokenInvalidations.push(query);
        return { count: 3 };
      },
    },
    permintaanBantuan: {
      async updateMany(query) {
        ticketUpdates.push(query);
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
  const controller = createPenggunaController({
    prismaClient: db,
    clock: () => new Date('2026-09-30T01:00:00.000Z'),
  });
  const res = createResponse();

  await controller.unlockPengguna(
    createRequest({
      params: { id: '7' },
      pengguna: { id_pengguna: 99 },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(updates[0].data, {
    terkunci: false,
    terkunci_sampai: null,
    percobaan_login: 0,
    session_version: { increment: 1 },
  });
  assert.equal(tokenInvalidations.length, 1);
  assert.equal(ticketUpdates[0].data.status, 'SELESAI');
  assert.equal(ticketUpdates[0].data.id_pengguna_penanganan, 99);
  assert.equal(auditWrites[0].data.aksi, 'UNLOCK_PENGGUNA');
  assert.equal(auditWrites[0].data.id_pengguna, 99);
  assert.equal(auditWrites[0].data.id_record_terkait, 7);
});
