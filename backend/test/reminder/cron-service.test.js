'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fakePrisma = {};
globalThis.prisma = fakePrisma;
const reminderService = require('../../src/services/reminder.service');
const cronService = require('../../src/services/cron.service');

const originalReminderMethods = {
  cariUnitBelumLapor: reminderService.cariUnitBelumLapor,
  cariRevisiTertunda: reminderService.cariRevisiTertunda,
  kirimPengingatUnit: reminderService.kirimPengingatUnit,
  kirimPengingatRevisi: reminderService.kirimPengingatRevisi,
  broadcastBaileys: reminderService.broadcastBaileys,
};

function restoreReminderMethods() {
  Object.assign(reminderService, originalReminderMethods);
}

test.beforeEach(() => {
  cronService.stopCronJobs();
  restoreReminderMethods();
  for (const key of Object.keys(fakePrisma)) delete fakePrisma[key];
});

test.after(() => {
  cronService.stopCronJobs();
  restoreReminderMethods();
  delete globalThis.prisma;
});

test('scheduler is gated by both flags and creates only 17:00/16:00 no-overlap tasks', () => {
  const scheduled = [];
  const fakeCron = {
    schedule(expression, handler, options) {
      const task = {
        stopped: 0,
        destroyed: 0,
        stop() { this.stopped += 1; },
        destroy() { this.destroyed += 1; },
      };
      scheduled.push({ expression, handler, options, task });
      return task;
    },
  };

  assert.equal(cronService.initCronJobs({
    cronClient: fakeCron,
    env: { ENABLE_WHATSAPP: 'false', ENABLE_NOTIFICATION_SCHEDULER: 'true' },
  }).state, 'disabled');
  assert.equal(cronService.initCronJobs({
    cronClient: fakeCron,
    env: { ENABLE_WHATSAPP: 'true', ENABLE_NOTIFICATION_SCHEDULER: 'false' },
  }).state, 'disabled');
  assert.equal(scheduled.length, 0);

  const started = cronService.initCronJobs({
    cronClient: fakeCron,
    env: { ENABLE_WHATSAPP: 'true', ENABLE_NOTIFICATION_SCHEDULER: 'true' },
  });
  assert.equal(started.state, 'started');
  assert.deepEqual(scheduled.map((entry) => entry.expression), ['0 17 * * *', '0 16 * * *']);
  assert.equal(scheduled.some((entry) => entry.expression === '0 9 * * *'), false);
  for (const entry of scheduled) {
    assert.equal(entry.options.timezone, 'Asia/Jakarta');
    assert.equal(entry.options.noOverlap, true);
  }

  const second = cronService.initCronJobs({
    cronClient: fakeCron,
    env: { ENABLE_WHATSAPP: 'true', ENABLE_NOTIFICATION_SCHEDULER: 'true' },
  });
  assert.equal(second.state, 'already_running');
  assert.equal(scheduled.length, 2);

  const stopped = cronService.stopCronJobs();
  assert.equal(stopped.state, 'stopped');
  assert.equal(stopped.tasks.length, 2);
  for (const entry of scheduled) {
    assert.equal(entry.task.stopped, 1);
    assert.equal(entry.task.destroyed, 1);
  }
});

test('scheduled BROADCAST targets only pending units of template jenis_unit', async () => {
  let broadcastArgs;
  reminderService.cariUnitBelumLapor = async () => [
    { id_unit: 1, jenis_unit: 'CABANG' },
    { id_unit: 2, jenis_unit: 'PUSAT' },
    { id_unit: 3, jenis_unit: 'CABANG' },
  ];
  reminderService.broadcastBaileys = async (args) => {
    broadcastArgs = args;
    return {
      total: 2,
      queued: 2,
      duplicate: 0,
      failed: 0,
      skipped: 0,
      skip_reasons: {},
      errors: [],
    };
  };

  const template = {
    id_konfig: 5,
    nama_template: 'broadcast_cabang',
    isi_pesan: 'Pesan terjadwal',
    trigger_waktu: 'MINGGUAN',
    unit_penerima: 'CABANG',
    tipe_notifikasi: 'BROADCAST',
  };
  const result = await cronService.executeReminderBaileys(template, {
    now: new Date('2026-09-28T01:00:00.000Z'),
  });

  assert.equal(result.target_count, 2);
  assert.equal(broadcastArgs.source, 'scheduled');
  assert.deepEqual(broadcastArgs.pendingUnitIds, [1, 3]);
  assert.strictEqual(broadcastArgs.template, template);
});

test('one broken daily template does not prevent later templates from running', async () => {
  fakePrisma.konfigurasiTemplate = {
    findMany: async () => [
      {
        id_konfig: 1,
        nama_template: 'rusak',
        unit_penerima: 'SEMUA',
        tipe_notifikasi: 'DEADLINE',
      },
      {
        id_konfig: 2,
        nama_template: 'tetap-diproses',
        unit_penerima: 'SEMUA',
        tipe_notifikasi: 'DEADLINE',
      },
    ],
  };

  let lookupCount = 0;
  let reminderCount = 0;
  reminderService.cariUnitBelumLapor = async () => {
    lookupCount += 1;
    if (lookupCount === 1) {
      const error = new Error('detail internal tidak boleh menghentikan batch');
      error.code = 'BROKEN_TEMPLATE';
      throw error;
    }
    return [{ id_unit: 9, jenis_unit: 'CABANG' }];
  };
  reminderService.kirimPengingatUnit = async () => {
    reminderCount += 1;
    return {
      total: 1,
      queued: 1,
      duplicate: 0,
      failed: 0,
      skipped: 0,
      skip_reasons: {},
      errors: [],
    };
  };

  const result = await cronService.cekTriggerHarian({
    now: new Date('2026-09-28T01:00:00.000Z'),
  });

  assert.equal(lookupCount, 2);
  assert.equal(reminderCount, 1);
  assert.equal(result.template_count, 2);
  assert.equal(result.queued, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.errors, [{
    template_id: 1,
    template: 'rusak',
    code: 'BROKEN_TEMPLATE',
  }]);
  assert.equal(JSON.stringify(result).includes('detail internal'), false);
});

test('scheduled DEADLINE and REVISI filter scope by jenis_unit, not unit name', async () => {
  const remindedUnits = [];
  let revisionTargets;
  reminderService.cariUnitBelumLapor = async () => [
    { id_unit: 1, nama_unit: 'CABANG', jenis_unit: 'PUSAT' },
    { id_unit: 2, nama_unit: 'Bukan Cabang', jenis_unit: 'CABANG' },
  ];
  reminderService.kirimPengingatUnit = async (unit) => {
    remindedUnits.push(unit.id_unit);
    return {
      total: 1,
      queued: 1,
      duplicate: 0,
      failed: 0,
      skipped: 0,
      skip_reasons: {},
      errors: [],
    };
  };
  reminderService.cariRevisiTertunda = async () => [
    { id_laporan: 10, unit: { nama_unit: 'CABANG', jenis_unit: 'PUSAT' } },
    { id_laporan: 11, unit: { nama_unit: 'Lain', jenis_unit: 'CABANG' } },
  ];
  reminderService.kirimPengingatRevisi = async (reports) => {
    revisionTargets = reports.map((report) => report.id_laporan);
    return {
      total: reports.length,
      queued: reports.length,
      duplicate: 0,
      failed: 0,
      skipped: 0,
      skip_reasons: {},
      errors: [],
    };
  };

  await cronService.executeReminderBaileys({
    nama_template: 'deadline',
    unit_penerima: 'CABANG',
    tipe_notifikasi: 'DEADLINE',
  });
  await cronService.executeReminderBaileys({
    nama_template: 'revisi',
    unit_penerima: 'CABANG',
    tipe_notifikasi: 'REVISI',
  });

  assert.deepEqual(remindedUnits, [2]);
  assert.deepEqual(revisionTargets, [11]);
});
