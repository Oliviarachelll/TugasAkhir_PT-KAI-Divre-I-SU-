'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const originalEncryptionKey = process.env.NOTIFICATION_ENCRYPTION_KEY;
process.env.NOTIFICATION_ENCRYPTION_KEY = 'reminder-service-test-encryption-key';

const fakePrisma = {};
globalThis.prisma = fakePrisma;
const reminderService = require('../../src/services/reminder.service');
const { NOTIFICATION_TYPES } = require('../../src/services/notification.service');

function resetPrisma() {
  for (const key of Object.keys(fakePrisma)) delete fakePrisma[key];
}

function installOutbox() {
  const jobs = new Map();
  fakePrisma.notificationJob = {
    async create(query) {
      if (jobs.has(query.data.dedupe_key)) {
        const error = new Error('Unique constraint');
        error.code = 'P2002';
        throw error;
      }
      const row = { id: jobs.size + 1, ...query.data };
      jobs.set(row.dedupe_key, row);
      return { id: row.id };
    },
    async findUnique(query) {
      const row = jobs.get(query.where.dedupe_key);
      return row ? { id: row.id, status: row.status } : null;
    },
    async updateMany(query) {
      const row = [...jobs.values()].find((candidate) => candidate.id === query.where.id);
      if (!row || row.status !== query.where.status) return { count: 0 };
      Object.assign(row, query.data);
      return { count: 1 };
    },
  };
  return jobs;
}

test.beforeEach(resetPrisma);
test.after(() => {
  if (originalEncryptionKey === undefined) delete process.env.NOTIFICATION_ENCRYPTION_KEY;
  else process.env.NOTIFICATION_ENCRYPTION_KEY = originalEncryptionKey;
  delete globalThis.prisma;
});

test('cariUnitBelumLapor uses a Jakarta half-open month and keeps uncontactable units', async () => {
  let laporanQuery;
  let unitQuery;
  fakePrisma.unit = {
    async findMany(query) {
      unitQuery = query;
      return [
        {
          id_unit: 1,
          nama_unit: 'Cabang Satu',
          jenis_unit: 'CABANG',
          pengguna: [
            { id_pengguna: 11, nama: 'A', no_hp: '0812-3456-7890' },
            { id_pengguna: 12, nama: 'Duplikat', no_hp: '+62 812 3456 7890' },
            { id_pengguna: 13, nama: 'Rusak', no_hp: '0812.invalid' },
          ],
        },
        {
          id_unit: 2,
          nama_unit: 'Sudah Lapor',
          jenis_unit: 'PUSAT',
          pengguna: [],
        },
        {
          id_unit: 3,
          nama_unit: 'Tanpa Kontak',
          jenis_unit: 'DAERAH',
          pengguna: [{ id_pengguna: 31, nama: 'Kosong', no_hp: null }],
        },
      ];
    },
  };
  fakePrisma.laporan = {
    async findMany(query) {
      laporanQuery = query;
      return [{ id_unit: 2 }];
    },
  };

  const result = await reminderService.cariUnitBelumLapor(
    new Date('2026-09-30T17:00:00.000Z')
  );

  assert.equal(laporanQuery.where.tanggal.gte.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(laporanQuery.where.tanggal.lt.toISOString(), '2026-10-31T17:00:00.000Z');
  assert.deepEqual(laporanQuery.where.status.in, [
    'DIAJUKAN',
    'DISETUJUI',
    'DITOLAK',
    'REVISI',
  ]);
  assert.equal(Object.hasOwn(laporanQuery.where.tanggal, 'lte'), false);
  assert.deepEqual(unitQuery.include.pengguna.where, { peran: 'USER_UNIT' });
  assert.equal(result.length, 2);
  assert.equal(result[0].jenis_unit, 'CABANG');
  assert.equal(result[0].contacts.length, 1);
  assert.equal(result[0].contacts[0].no_hp, '6281234567890');
  assert.equal(result[0].contactable, true);
  assert.equal(result[0].contact_count, 1);
  assert.equal(result[0].skipped_contact_count, 2);
  assert.equal(result[1].contactable, false);
  assert.equal(result[1].contact_count, 0);
});

test('cariRevisiTertunda has deterministic ordering without an oldest-100 cap', async () => {
  let query;
  fakePrisma.laporan = {
    async findMany(value) {
      query = value;
      return [];
    },
  };

  await reminderService.cariRevisiTertunda(
    3,
    new Date('2026-09-30T09:00:00.000Z')
  );

  assert.equal(query.take, undefined);
  assert.deepEqual(query.orderBy, [{ updated_at: 'asc' }, { id_laporan: 'asc' }]);
  assert.deepEqual(query.where.status.in, ['DITOLAK', 'REVISI']);
  assert.equal(query.select.unit.select.jenis_unit, true);
  assert.equal(query.select.token_revisi, undefined);
  assert.equal(query.select.token_revisi_exp, undefined);
  assert.equal(query.include, undefined);
  assert.ok(query.where.updated_at.lt instanceof Date);
});

test('deadline reminders normalize recipients and use stable daily and force keys', async () => {
  const jobs = installOutbox();
  const unit = {
    id_unit: 4,
    nama_unit: 'Unit Empat',
    contacts: [
      { id_pengguna: 41, nama: 'Kontak', no_hp: '0812-3456-7890' },
      { id_pengguna: 42, nama: 'Duplikat', no_hp: '+62 812 3456 7890' },
      { id_pengguna: 43, nama: 'Invalid', no_hp: '0812.invalid' },
    ],
  };
  const now = new Date('2026-09-15T01:00:00.000Z');

  const first = await reminderService.kirimPengingatUnit(unit, { now, source: 'scheduled' });
  const retry = await reminderService.kirimPengingatUnit(unit, { now, source: 'manual' });
  const forced = await reminderService.kirimPengingatUnit(unit, {
    now,
    force: true,
    requestKey: 'manual-force-0001',
  });
  const forcedRetry = await reminderService.kirimPengingatUnit(unit, {
    now,
    force: true,
    requestKey: 'manual-force-0001',
  });
  const secondForce = await reminderService.kirimPengingatUnit(unit, {
    now,
    force: true,
    requestKey: 'manual-force-0002',
  });

  assert.deepEqual(
    { total: first.total, queued: first.queued, duplicate: first.duplicate, skipped: first.skipped },
    { total: 3, queued: 1, duplicate: 0, skipped: 2 }
  );
  assert.equal(retry.duplicate, 1, 'normal HTTP retries share the scheduled daily key');
  assert.equal(forced.queued, 1);
  assert.equal(forcedRetry.duplicate, 1);
  assert.equal(secondForce.queued, 1);
  assert.equal(jobs.size, 3);
  for (const job of jobs.values()) {
    assert.equal(job.jenis, NOTIFICATION_TYPES.DEADLINE_REMINDER);
    assert.equal(job.recipient_phone, '6281234567890');
  }
});

test('template broadcasts enforce persisted scope and scheduled pending targets', async () => {
  const jobs = installOutbox();
  let userQuery;
  let userQueryCount = 0;
  fakePrisma.konfigurasiTemplate = {
    findUnique: async () => ({
      id_konfig: 9,
      nama_template: 'info_cabang',
      isi_pesan: 'Pesan khusus cabang',
      unit_penerima: 'CABANG',
      tipe_notifikasi: 'BROADCAST',
    }),
  };
  fakePrisma.pengguna = {
    async findMany(query) {
      userQuery = query;
      userQueryCount += 1;
      return [
        {
          id_pengguna: 1,
          nama: 'Satu',
          no_hp: '0812-3456-7890',
          unit: { id_unit: 5, nama_unit: 'Cabang Lima', jenis_unit: 'CABANG' },
        },
        {
          id_pengguna: 2,
          nama: 'Duplikat',
          no_hp: '+62 812 3456 7890',
          unit: { id_unit: 5, nama_unit: 'Cabang Lima', jenis_unit: 'CABANG' },
        },
        {
          id_pengguna: 3,
          nama: 'Invalid',
          no_hp: 'nomor-rusak',
          unit: { id_unit: 5, nama_unit: 'Cabang Lima', jenis_unit: 'CABANG' },
        },
      ];
    },
  };

  const result = await reminderService.broadcastBaileys({
    messageType: 'template',
    templateName: 'info_cabang',
    unitPenerima: 'PUSAT',
    source: 'scheduled',
    pendingUnitIds: [5, 5, -1],
    now: new Date('2026-09-15T01:00:00.000Z'),
  });

  assert.equal(userQueryCount, 1);
  assert.equal(userQuery.where.unit.jenis_unit, 'CABANG');
  assert.deepEqual(userQuery.where.unit.id_unit.in, [5]);
  assert.equal(result.scope, 'CABANG');
  assert.equal(result.queued, 1);
  assert.equal(result.skipped, 2);
  assert.equal(jobs.size, 1);
  assert.equal([...jobs.values()][0].jenis, NOTIFICATION_TYPES.CUSTOM_BROADCAST);

  await assert.rejects(
    reminderService.broadcastBaileys({
      messageType: 'template',
      templateName: 'info_cabang',
      source: 'scheduled',
    }),
    (error) => error.code === 'SCHEDULED_PENDING_TARGET_REQUIRED'
  );
});
