'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPermintaanController,
} = require('../../src/controllers/permintaan.controller');
const { createRequest, createResponse } = require('./test-helpers');

test('clarification creation requires the requester-owned approved report', async () => {
  let report = {
    id_laporan: 7,
    id_pengguna: 11,
    id_unit: 3,
    status: 'DISETUJUI',
  };
  const creates = [];
  let transactionOptions;
  const db = {
    laporan: { findUnique: async () => report },
    permintaanBantuan: {
      async create(query) {
        creates.push(query);
        return { id_permintaan: 1, ...query.data };
      },
    },
    async $transaction(callback, options) {
      transactionOptions = options;
      return callback(this);
    },
  };
  const controller = createPermintaanController({ prismaClient: db });
  const request = () =>
    createRequest({
      pengguna: { id_pengguna: 11, id_unit: 3, peran: 'USER_UNIT' },
      body: {
        jenis: 'KLARIFIKASI_DATA',
        deskripsi: 'Mohon klarifikasi laporan ini',
        id_laporan: 7,
      },
    });

  const success = createResponse();
  await controller.createPermintaan(request(), success);
  assert.equal(success.statusCode, 201);
  assert.equal(creates[0].data.id_laporan, 7);
  assert.equal(creates[0].data.id_pengguna_pengaju, 11);
  assert.deepEqual(transactionOptions, { isolationLevel: 'Serializable' });

  report = { ...report, id_pengguna: 99 };
  const forbidden = createResponse();
  await controller.createPermintaan(request(), forbidden);
  assert.equal(forbidden.statusCode, 403);

  report = { ...report, id_pengguna: 11, status: 'DIAJUKAN' };
  const notApproved = createResponse();
  await controller.createPermintaan(request(), notApproved);
  assert.equal(notApproved.statusCode, 409);
  assert.equal(creates.length, 1);
});

test('pending access requests are deduplicated transactionally', async () => {
  let pending = { id_permintaan: 20 };
  let createCount = 0;
  const db = {
    permintaanBantuan: {
      findFirst: async () => pending,
      async create(query) {
        createCount += 1;
        return { id_permintaan: 21, ...query.data };
      },
    },
    async $transaction(callback) {
      return callback(this);
    },
  };
  const controller = createPermintaanController({ prismaClient: db });
  const request = () =>
    createRequest({
      pengguna: { id_pengguna: 11, id_unit: 3, peran: 'USER_UNIT' },
      body: {
        jenis: 'PERMINTAAN_AKSES',
        deskripsi: 'Saya membutuhkan pemulihan akses akun',
      },
    });

  const duplicate = createResponse();
  await controller.createPermintaan(request(), duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.equal(createCount, 0);

  pending = null;
  const created = createResponse();
  await controller.createPermintaan(request(), created);
  assert.equal(created.statusCode, 201);
  assert.equal(createCount, 1);
});

test('controller rejects non-USER_UNIT creation and client token fields', async () => {
  let transactionCount = 0;
  const controller = createPermintaanController({
    prismaClient: {
      async $transaction() {
        transactionCount += 1;
      },
    },
  });

  const roleResponse = createResponse();
  await controller.createPermintaan(
    createRequest({
      pengguna: { id_pengguna: 1, peran: 'IT' },
      body: { jenis: 'LAINNYA', deskripsi: 'Deskripsi permintaan valid' },
    }),
    roleResponse
  );
  assert.equal(roleResponse.statusCode, 403);

  const tokenResponse = createResponse();
  await controller.createPermintaan(
    createRequest({
      pengguna: { id_pengguna: 1, peran: 'USER_UNIT' },
      body: {
        jenis: 'LAINNYA',
        deskripsi: 'Deskripsi permintaan valid',
        token: 'CLIENT-TOKEN',
      },
    }),
    tokenResponse
  );
  assert.equal(tokenResponse.statusCode, 422);
  assert.equal(transactionCount, 0);
});
