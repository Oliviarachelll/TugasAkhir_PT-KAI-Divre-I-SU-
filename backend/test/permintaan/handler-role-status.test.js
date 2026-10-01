'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPermintaanController,
  unitCategoryWhere,
} = require('../../src/controllers/permintaan.controller');
const { createRequest, createResponse } = require('./test-helpers');

test('unit category filters are translated to server-side requester unit conditions', () => {
  const filter = unitCategoryWhere('KNA');
  assert.equal(filter.OR.length, 2);
  assert.deepEqual(
    filter.OR.map((entry) => entry.pengaju.is.unit.is.nama_unit.contains),
    ['KNA', 'Kontrak']
  );
  assert.deepEqual(unitCategoryWhere(undefined), {});
});

function ticket(jenis, overrides = {}) {
  return {
    id_permintaan: 61,
    jenis,
    status: 'MENUNGGU',
    id_pengguna_pengaju: 11,
    id_laporan: null,
    pengaju: {
      id_pengguna: 11,
      nama: 'User Unit',
      no_hp: '6281234567890',
      id_unit: 3,
    },
    laporan: null,
    ...overrides,
  };
}

test('handler role is rechecked against the stored ticket type', async () => {
  let currentTicket = ticket('PERMINTAAN_AKSES');
  let transactionCount = 0;
  const controller = createPermintaanController({
    prismaClient: {
      permintaanBantuan: { findUnique: async () => currentTicket },
      async $transaction() {
        transactionCount += 1;
      },
    },
  });

  const adminOnAccess = createResponse();
  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 61 },
      body: { status: 'DIPROSES' },
      pengguna: { id_pengguna: 100, peran: 'ADMIN_GLOBAL' },
    }),
    adminOnAccess
  );
  assert.equal(adminOnAccess.statusCode, 403);

  currentTicket = ticket('KLARIFIKASI_DATA', {
    id_laporan: 7,
    laporan: { id_laporan: 7, id_pengguna: 11, id_unit: 3, status: 'DISETUJUI' },
  });
  const itOnClarification = createResponse();
  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 61 },
      body: { status: 'DIPROSES' },
      pengguna: { id_pengguna: 99, peran: 'IT' },
    }),
    itOnClarification
  );
  assert.equal(itOnClarification.statusCode, 403);
  assert.equal(transactionCount, 0);
});

test('ordinary transitions queue request updates atomically when phone is valid', async () => {
  const currentTicket = ticket('BANTUAN_TEKNIS');
  const ticketUpdates = [];
  const queueCalls = [];
  const db = {
    permintaanBantuan: {
      findUnique: async () => ({ ...currentTicket }),
      async updateMany(query) {
        ticketUpdates.push(query);
        currentTicket.status = query.data.status;
        currentTicket.id_pengguna_penanganan = query.data.id_pengguna_penanganan;
        return { count: 1 };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createPermintaanController({
    prismaClient: db,
    normalizePhoneFn: () => '6281234567890',
    queueRequestUpdateFn: async (args) => {
      queueCalls.push(args);
      return { state: 'queued', jobId: 700 };
    },
  });
  const res = createResponse();

  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 61 },
      body: { status: 'DIPROSES' },
      pengguna: { id_pengguna: 99, peran: 'IT' },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(ticketUpdates[0].where.status, 'MENUNGGU');
  assert.equal(ticketUpdates[0].data.id_pengguna_penanganan, 99);
  assert.equal(queueCalls.length, 1);
  assert.strictEqual(queueCalls[0].tx, db);
  assert.equal(queueCalls[0].requestType, 'BANTUAN_TEKNIS');
  assert.equal(queueCalls[0].status, 'DIPROSES');
  assert.deepEqual(res.body.data.delivery, { state: 'queued', jobId: 700 });
});

test('invalid phones skip ordinary notifications but concurrent updates fail closed', async () => {
  const currentTicket = ticket('LAINNYA', {
    pengaju: {
      id_pengguna: 11,
      nama: 'User Unit',
      no_hp: 'invalid',
      id_unit: 3,
    },
  });
  let claimCount = 1;
  let queueCount = 0;
  const db = {
    permintaanBantuan: {
      findUnique: async () => ({ ...currentTicket }),
      async updateMany(query) {
        if (claimCount === 1) currentTicket.status = query.data.status;
        return { count: claimCount };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createPermintaanController({
    prismaClient: db,
    normalizePhoneFn: () => null,
    queueRequestUpdateFn: async () => {
      queueCount += 1;
    },
  });

  const skipped = createResponse();
  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 61 },
      body: { status: 'DIPROSES' },
      pengguna: { id_pengguna: 99, peran: 'IT' },
    }),
    skipped
  );
  assert.equal(skipped.statusCode, 200);
  assert.deepEqual(skipped.body.data.delivery, { state: 'skipped', jobId: null });
  assert.equal(queueCount, 0);

  currentTicket.status = 'MENUNGGU';
  claimCount = 0;
  const conflict = createResponse();
  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 61 },
      body: { status: 'DIPROSES' },
      pengguna: { id_pengguna: 99, peran: 'IT' },
    }),
    conflict
  );
  assert.equal(conflict.statusCode, 409);
  assert.equal(queueCount, 0);
});

test('missing tickets use sendError argument order and client tokens are rejected', async () => {
  let findCount = 0;
  const controller = createPermintaanController({
    prismaClient: {
      permintaanBantuan: {
        async findUnique() {
          findCount += 1;
          return null;
        },
      },
    },
  });

  const tokenResponse = createResponse();
  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 61 },
      body: { status: 'SELESAI', token: 'CLIENT-TOKEN' },
      pengguna: { id_pengguna: 99, peran: 'IT' },
    }),
    tokenResponse
  );
  assert.equal(tokenResponse.statusCode, 422);
  assert.equal(findCount, 0);

  const missing = createResponse();
  await controller.tanggapiPermintaan(
    createRequest({
      params: { id: 999 },
      body: { status: 'DIPROSES' },
      pengguna: { id_pengguna: 99, peran: 'IT' },
    }),
    missing
  );
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.body.message, 'Tiket tidak ditemukan');
});
