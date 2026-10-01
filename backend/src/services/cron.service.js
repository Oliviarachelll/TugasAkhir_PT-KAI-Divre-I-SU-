'use strict';

const cron = require('node-cron');
const prisma = require('../config/database');
const reminderService = require('./reminder.service');
const { getJakartaDateParts } = require('./business-time');

const CRON_TIMEZONE = 'Asia/Jakarta';
const activeTasks = [];

function emptyResult() {
  return reminderService.mergeQueueResults([]);
}

function filterByScope(items, scope, readJenisUnit) {
  return items.filter((item) => reminderService.scopeMatches(readJenisUnit(item), scope));
}

async function executeReminderBaileys(template, { now = new Date() } = {}) {
  if (!template || !template.tipe_notifikasi) {
    throw new reminderService.ReminderServiceError(
      'Template wajib memiliki tipe_notifikasi',
      422,
      'TEMPLATE_TYPE_REQUIRED'
    );
  }

  const scope = template.unit_penerima || 'SEMUA';
  if (template.tipe_notifikasi === 'DEADLINE') {
    const pendingUnits = await reminderService.cariUnitBelumLapor(now);
    const targets = filterByScope(pendingUnits, scope, (unit) => unit.jenis_unit);
    const results = [];
    for (const unit of targets) {
      results.push(await reminderService.kirimPengingatUnit(unit, {
        now,
        source: 'scheduled',
        messageText: template.isi_pesan,
      }));
    }
    return {
      ...reminderService.mergeQueueResults(results),
      template: template.nama_template,
      tipe_notifikasi: template.tipe_notifikasi,
      target_count: targets.length,
    };
  }

  if (template.tipe_notifikasi === 'REVISI') {
    const pendingReports = await reminderService.cariRevisiTertunda(3, now);
    const targets = filterByScope(
      pendingReports,
      scope,
      (report) => report.unit?.jenis_unit
    );
    const result = await reminderService.kirimPengingatRevisi(targets, {
      now,
      source: 'scheduled',
      messageText: template.isi_pesan,
    });
    return {
      ...result,
      template: template.nama_template,
      tipe_notifikasi: template.tipe_notifikasi,
      target_count: targets.length,
    };
  }

  if (template.tipe_notifikasi === 'BROADCAST') {
    const pendingUnits = await reminderService.cariUnitBelumLapor(now);
    const targets = filterByScope(pendingUnits, scope, (unit) => unit.jenis_unit);
    const result = await reminderService.broadcastBaileys({
      messageType: 'template',
      templateName: template.nama_template,
      template,
      source: 'scheduled',
      pendingUnitIds: targets.map((unit) => unit.id_unit),
      now,
    });
    return {
      ...result,
      template: template.nama_template,
      tipe_notifikasi: template.tipe_notifikasi,
      target_count: targets.length,
    };
  }

  throw new reminderService.ReminderServiceError(
    'Tipe notifikasi template tidak didukung',
    422,
    'UNSUPPORTED_TEMPLATE_TYPE'
  );
}

function getDailyTriggers(ref = new Date()) {
  const { year, month, day } = getJakartaDateParts(ref);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const triggers = [];
  if (dayOfWeek === 1) triggers.push('MINGGUAN');
  if (day === 1) triggers.push('BULANAN');
  if (day === lastDayOfMonth - 1) triggers.push('H_MIN_1');
  if (day === lastDayOfMonth - 3) triggers.push('H_MIN_3');
  return triggers;
}

async function cekTriggerHarian({ now = new Date() } = {}) {
  const triggers = getDailyTriggers(now);
  if (triggers.length === 0) return { ...emptyResult(), trigger_count: 0, template_count: 0 };

  const templates = await prisma.konfigurasiTemplate.findMany({
    where: { trigger_waktu: { in: triggers } },
    orderBy: { id_konfig: 'asc' },
  });
  const results = [];
  for (const template of templates) {
    try {
      results.push(await executeReminderBaileys(template, { now }));
    } catch (error) {
      results.push({
        ...emptyResult(),
        total: 1,
        failed: 1,
        errors: [{
          template_id: template.id_konfig ?? null,
          template: template.nama_template || null,
          code: typeof error?.code === 'string' ? error.code : 'TEMPLATE_EXECUTION_FAILED',
        }],
        template: template.nama_template,
        tipe_notifikasi: template.tipe_notifikasi,
        target_count: 0,
      });
    }
  }
  return {
    ...reminderService.mergeQueueResults(results),
    trigger_count: triggers.length,
    template_count: templates.length,
  };
}

async function cekRevisiTertunda({ now = new Date() } = {}) {
  const reports = await reminderService.cariRevisiTertunda(3, now);
  return reminderService.kirimPengingatRevisi(reports, {
    now,
    source: 'scheduled',
  });
}

async function runScheduledTask(name, task) {
  try {
    const result = await task();
    console.log(
      `[NotificationCron] ${name}: queued=${result.queued}, duplicate=${result.duplicate}, ` +
      `failed=${result.failed}, skipped=${result.skipped}`
    );
    return result;
  } catch (error) {
    console.error(`[NotificationCron] ${name} gagal: ${error.message}`);
    return null;
  }
}

function schedulerEnabled(env = process.env) {
  return env.ENABLE_WHATSAPP === 'true' && env.ENABLE_NOTIFICATION_SCHEDULER === 'true';
}

function publicTaskHandles() {
  return activeTasks.map(({ name, expression, task }) => ({ name, expression, task }));
}

function initCronJobs({ cronClient = cron, env = process.env } = {}) {
  if (!schedulerEnabled(env)) {
    return { state: 'disabled', tasks: [] };
  }
  if (activeTasks.length > 0) {
    return { state: 'already_running', tasks: publicTaskHandles() };
  }

  const definitions = [
    {
      name: 'notification-deadline-daily',
      expression: '0 8 * * *',
      handler: () => runScheduledTask('deadline-daily', () => cekTriggerHarian()),
    },
    {
      name: 'notification-revision-daily',
      expression: '0 16 * * *',
      handler: () => runScheduledTask('revision-daily', () => cekRevisiTertunda()),
    },
  ];

  for (const definition of definitions) {
    const task = cronClient.schedule(definition.expression, definition.handler, {
      timezone: CRON_TIMEZONE,
      noOverlap: true,
      name: definition.name,
    });
    activeTasks.push({ ...definition, task });
  }

  return { state: 'started', tasks: publicTaskHandles() };
}

function stopCronJobs() {
  const stopped = [];
  while (activeTasks.length > 0) {
    const entry = activeTasks.pop();
    entry.task?.stop?.();
    entry.task?.destroy?.();
    stopped.push(entry.name);
  }
  return { state: 'stopped', tasks: stopped.reverse() };
}

module.exports = {
  CRON_TIMEZONE,
  executeReminderBaileys,
  getDailyTriggers,
  cekTriggerHarian,
  cekRevisiTertunda,
  schedulerEnabled,
  initCronJobs,
  stopCronJobs,
  getCronTasks: publicTaskHandles,
};
