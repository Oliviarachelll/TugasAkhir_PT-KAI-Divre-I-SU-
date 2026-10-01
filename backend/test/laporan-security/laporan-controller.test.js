'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const originalEncryptionKey = process.env.NOTIFICATION_ENCRYPTION_KEY;
const originalTokenPepper = process.env.TOKEN_PEPPER;
process.env.NOTIFICATION_ENCRYPTION_KEY = 'laporan-controller-test-encryption-key';
process.env.TOKEN_PEPPER = 'laporan-controller-test-token-pepper';

const fakePrisma = {};
globalThis.prisma = fakePrisma;

const {
  updateLaporan,
  updateLaporanPenumpang,
  getLaporanPenumpang,
  resubmitLaporan,
  unlockLaporan,
  redactLaporanSecrets,
} = require('../../src/controllers/laporan.controller');
const { hashHumanToken } = require('../../src/utils/security-token');
const {
  NOTIFICATION_TYPES,
  decryptNotificationPayload,
} = require('../../src/services/notification.service');
const { LaporanAccessError } = require('../../src/services/laporan-access.service');

function resetPrisma() {
  for (const key of Object.keys(fakePrisma)) delete fakePrisma[key];
}

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createApp(socketEvents = null) {
  return {
    get(name) {
      assert.equal(name, 'socketEvents');
      return socketEvents;
    },
  };
}

function restoreEnvironment() {
  if (originalEncryptionKey === undefined) delete process.env.NOTIFICATION_ENCRYPTION_KEY;
  else process.env.NOTIFICATION_ENCRYPTION_KEY = originalEncryptionKey;
  if (originalTokenPepper === undefined) delete process.env.TOKEN_PEPPER;
  else process.env.TOKEN_PEPPER = originalTokenPepper;
  delete globalThis.prisma;
}

test.after(restoreEnvironment);
test.beforeEach(resetPrisma);

test('public report serialization removes revision-token digests and expiry', () => {
  const source = {
    id_laporan: 10,
    status: 'DISETUJUI',
    token_revisi: 'a'.repeat(64),
    token_revisi_exp: new Date('2026-09-30T03:00:00.000Z'),
    unit: { nama_unit: 'Unit Tiga' },
  };

  assert.deepEqual(redactLaporanSecrets(source), {
    id_laporan: 10,
    status: 'DISETUJUI',
    unit: { nama_unit: 'Unit Tiga' },
  });
  assert.equal(source.token_revisi, 'a'.repeat(64), 'redaction must not mutate Prisma rows');
  assert.deepEqual(redactLaporanSecrets([source]), [{
    id_laporan: 10,
    status: 'DISETUJUI',
    unit: { nama_unit: 'Unit Tiga' },
  }]);
});

test('review CAS writes status, audit, and encrypted outbox in one transaction', async () => {
  const report = {
    id_laporan: 10,
    id_unit: 3,
    id_pengguna: 7,
    tanggal: new Date('2026-09-30T00:00:00.000Z'),
    status: 'DIAJUKAN',
    kotak_detail: 'Metadata asli',
    updated_at: new Date('2026-09-30T01:00:00.000Z'),
    pengguna: { id_pengguna: 7, nama: 'Budi', no_hp: '0812-3456-7890' },
    unit: { id_unit: 3, nama_unit: 'Unit Tiga' },
  };
  const audits = [];
  const jobs = [];
  let transactionCount = 0;
  const tx = {
    laporan: {
      async findUnique() {
        return { ...report };
      },
      async updateMany(query) {
        assert.deepEqual(query.where, { id_laporan: 10, status: 'DIAJUKAN' });
        if (report.status !== 'DIAJUKAN') return { count: 0 };
        report.status = query.data.status;
        return { count: 1 };
      },
    },
    notificationJob: {
      async create(query) {
        jobs.push(query.data);
        return { id: 91 };
      },
    },
    logAudit: {
      async create(query) {
        audits.push(query.data);
        return query.data;
      },
    },
  };
  fakePrisma.$transaction = async (callback) => {
    transactionCount += 1;
    return callback(tx);
  };

  const emitted = [];
  const req = {
    params: { id: 10 },
    body: { status: 'DISETUJUI', kotak_detail: 'Data telah diverifikasi' },
    pengguna: { id_pengguna: 1, id_unit: 1, peran: 'ADMIN_GLOBAL' },
    app: createApp({ emitStatusLaporanUpdate: (value) => emitted.push(value) }),
  };
  const res = createResponse();

  await updateLaporan(req, res);

  assert.equal(transactionCount, 1);
  assert.equal(report.status, 'DISETUJUI');
  assert.equal(report.kotak_detail, 'Metadata asli', 'review note must not mutate metadata');
  assert.equal(audits.length, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jenis, NOTIFICATION_TYPES.REPORT_APPROVED);
  assert.equal(jobs[0].recipient_phone, '6281234567890');
  assert.equal(jobs[0].payload_encrypted.includes('Data telah diverifikasi'), false);
  assert.equal(
    decryptNotificationPayload(jobs[0].payload_encrypted).metadata.reportId,
    10
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.status, 'DISETUJUI');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].status, 'DISETUJUI');
});

test('review CAS conflict creates neither audit nor outbox', async () => {
  let auditCount = 0;
  let outboxCount = 0;
  const tx = {
    laporan: {
      findUnique: async () => ({
        id_laporan: 10,
        id_unit: 3,
        id_pengguna: 7,
        tanggal: new Date('2026-09-30T00:00:00.000Z'),
        status: 'DIAJUKAN',
        updated_at: new Date('2026-09-30T01:00:00.000Z'),
        pengguna: { id_pengguna: 7, nama: 'Budi', no_hp: '081234567890' },
        unit: { id_unit: 3, nama_unit: 'Unit Tiga' },
      }),
      updateMany: async () => ({ count: 0 }),
    },
    notificationJob: { create: async () => { outboxCount += 1; } },
    logAudit: { create: async () => { auditCount += 1; } },
  };
  fakePrisma.$transaction = async (callback) => callback(tx);

  await assert.rejects(
    updateLaporan({
      params: { id: 10 },
      body: { status: 'REVISI' },
      pengguna: { id_pengguna: 1, id_unit: 1, peran: 'IT' },
      app: createApp(),
    }, createResponse()),
    (error) => error instanceof LaporanAccessError &&
      error.code === 'LAPORAN_REVIEW_CAS_FAILED'
  );
  assert.equal(auditCount, 0);
  assert.equal(outboxCount, 0);
});

test('unlock hashes a 16-character token and atomically consumes digest with audit', async () => {
  const plainToken = '0123-4567-89AB-CDEF';
  const digest = hashHumanToken(plainToken);
  const report = {
    id_laporan: 12,
    id_unit: 3,
    id_pengguna: 7,
    status: 'DISETUJUI',
    token_revisi: digest,
    token_revisi_exp: new Date(Date.now() + 60_000),
  };
  const audits = [];
  let transactionCount = 0;
  const tx = {
    laporan: {
      async findUnique() {
        return { ...report };
      },
      async updateMany(query) {
        assert.equal(query.where.token_revisi, digest);
        assert.equal(query.where.id_pengguna, 7);
        assert.ok(query.where.token_revisi_exp.gt instanceof Date);
        report.status = query.data.status;
        report.token_revisi = query.data.token_revisi;
        report.token_revisi_exp = query.data.token_revisi_exp;
        return { count: 1 };
      },
    },
    logAudit: {
      async create(query) {
        audits.push(query.data);
        return query.data;
      },
    },
  };
  fakePrisma.$transaction = async (callback) => {
    transactionCount += 1;
    return callback(tx);
  };

  const emitted = [];
  const res = createResponse();
  await unlockLaporan({
    params: { id: 12 },
    body: { token: plainToken },
    pengguna: { id_pengguna: 7, id_unit: 3, peran: 'USER_UNIT' },
    app: createApp({ emitStatusLaporanUpdate: (value) => emitted.push(value) }),
  }, res);

  assert.equal(transactionCount, 1);
  assert.equal(report.status, 'REVISI');
  assert.equal(report.token_revisi, null);
  assert.equal(report.token_revisi_exp, null);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].aksi, 'UNLOCK_LAPORAN');
  assert.equal(res.body.data.status, 'REVISI');
  assert.equal(emitted.length, 1);
});

test('unlock fails closed when digest expiry is null', async () => {
  let updateCount = 0;
  let auditCount = 0;
  const tx = {
    laporan: {
      findUnique: async () => ({
        id_laporan: 12,
        id_unit: 3,
        id_pengguna: 7,
        status: 'DISETUJUI',
        token_revisi: hashHumanToken('0123-4567-89AB-CDEF'),
        token_revisi_exp: null,
      }),
      updateMany: async () => {
        updateCount += 1;
        return { count: 1 };
      },
    },
    logAudit: { create: async () => { auditCount += 1; } },
  };
  fakePrisma.$transaction = async (callback) => callback(tx);

  await assert.rejects(
    unlockLaporan({
      params: { id: 12 },
      body: { token: '0123-4567-89AB-CDEF' },
      pengguna: { id_pengguna: 7, id_unit: 3, peran: 'USER_UNIT' },
      app: createApp(),
    }, createResponse()),
    (error) => error instanceof LaporanAccessError &&
      error.code === 'LAPORAN_INVALID_REVISION_TOKEN'
  );
  assert.equal(updateCount, 0);
  assert.equal(auditCount, 0);
});

test('child update rejects an item belonging to a different URL report', async () => {
  let updateCount = 0;
  const tx = {
    laporan: {
      findUnique: async () => ({
        id_laporan: 10,
        id_unit: 3,
        id_pengguna: 7,
        status: 'DRAFT',
      }),
      updateMany: async () => ({ count: 1 }),
    },
    laporanPenumpang: {
      findUnique: async () => ({ id_laporan_penumpang: 55, id_laporan: 99 }),
      update: async () => {
        updateCount += 1;
        return {};
      },
    },
  };
  fakePrisma.$transaction = async (callback) => callback(tx);

  await assert.rejects(
    updateLaporanPenumpang({
      params: { id: 10, itemId: 55 },
      body: { nama_ka: 'UJI', jml_penumpang: 1, pendapatan: 1 },
      pengguna: { id_pengguna: 7, id_unit: 3, peran: 'USER_UNIT' },
    }, createResponse()),
    (error) => error instanceof LaporanAccessError &&
      error.code === 'LAPORAN_CHILD_NOT_FOUND'
  );
  assert.equal(updateCount, 0);
});

test('subreport GET checks parent unit before loading children', async () => {
  let childQueryCount = 0;
  fakePrisma.laporan = {
    findUnique: async () => ({
      id_laporan: 10,
      id_unit: 99,
      id_pengguna: 8,
      status: 'DRAFT',
    }),
  };
  fakePrisma.laporanPenumpang = {
    findMany: async () => {
      childQueryCount += 1;
      return [];
    },
  };

  await assert.rejects(
    getLaporanPenumpang({
      params: { id: 10 },
      pengguna: { id_pengguna: 7, id_unit: 3, peran: 'USER_UNIT' },
    }, createResponse()),
    (error) => error instanceof LaporanAccessError &&
      error.code === 'LAPORAN_UNIT_FORBIDDEN'
  );
  assert.equal(childQueryCount, 0);
});

test('resubmit CAS queues only unique valid reviewer contacts inside transaction', async () => {
  const existing = {
    id_laporan: 20,
    id_unit: 3,
    id_pengguna: 7,
    tanggal: new Date('2026-09-30T00:00:00.000Z'),
    status: 'REVISI',
    kotak_detail: null,
    laporan_kna: { jml_kontrak_row: 1 },
    laporan_penumpang: [],
    laporan_barang: [],
    laporan_keuangan: null,
    unit: { id_unit: 3, nama_unit: 'Unit Tiga' },
  };
  fakePrisma.laporan = { findUnique: async () => existing };

  const jobs = [];
  const audits = [];
  let transactionCount = 0;
  const tx = {
    laporan: { updateMany: async () => ({ count: 1 }) },
    laporanKNA: {
      upsert: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    laporanPenumpang: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
    },
    laporanBarang: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
    },
    laporanKeuangan: {
      upsert: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    revisiLaporan: {
      findFirst: async () => null,
      create: async (query) => ({ ...query.data }),
    },
    pengguna: {
      findMany: async () => [
        { id_pengguna: 1, nama: 'Admin', no_hp: '0812-3456-7890' },
        { id_pengguna: 2, nama: 'IT duplikat', no_hp: '+62 812 3456 7890' },
        { id_pengguna: 3, nama: 'Tidak valid', no_hp: '0812.invalid' },
      ],
    },
    notificationJob: {
      create: async (query) => {
        jobs.push(query.data);
        return { id: jobs.length };
      },
    },
    logAudit: {
      create: async (query) => {
        audits.push(query.data);
        return query.data;
      },
    },
  };
  fakePrisma.$transaction = async (callback) => {
    transactionCount += 1;
    return callback(tx);
  };

  const emitted = [];
  const res = createResponse();
  await resubmitLaporan({
    params: { id: 20 },
    body: {
      tanggal: new Date('2026-09-30T00:00:00.000Z'),
      kotak_detail: null,
      status_internal: 'PENDING',
      kna: { jml_kontrak_row: 2 },
      penumpangItems: [],
      barangItems: [],
      keuangan: null,
    },
    pengguna: { id_pengguna: 7, id_unit: 3, peran: 'USER_UNIT' },
    app: createApp({ emitStatusLaporanUpdate: (value) => emitted.push(value) }),
  }, res);

  assert.equal(transactionCount, 1);
  assert.equal(jobs.length, 1, 'duplicate and invalid admin phones must not be queued');
  assert.equal(jobs[0].jenis, NOTIFICATION_TYPES.REPORT_RESUBMITTED);
  assert.equal(jobs[0].recipient_phone, '6281234567890');
  assert.equal(audits.length, 1);
  assert.equal(JSON.parse(audits[0].detail).notifikasi_diantrekan, 1);
  assert.equal(res.body.data.status, 'DIAJUKAN');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].status, 'DIAJUKAN');
});
