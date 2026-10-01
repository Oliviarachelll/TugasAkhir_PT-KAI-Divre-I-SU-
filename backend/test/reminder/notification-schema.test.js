'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  broadcastMessageSchema,
  createNotificationTemplateSchema,
  notificationUnitParamsSchema,
  queueUnitReminderSchema,
  notificationLogsQuerySchema,
} = require('../../src/schemas/notification.schema');

test('broadcast schema strictly validates text/template payloads and force keys', () => {
  assert.equal(broadcastMessageSchema.safeParse({
    messageType: 'text',
    messageText: 'Pesan uji',
    unitPenerima: 'CABANG',
  }).success, true);
  assert.equal(broadcastMessageSchema.safeParse({
    messageType: 'template',
    templateName: 'deadline_unit',
  }).success, true);

  assert.equal(broadcastMessageSchema.safeParse({ messageType: 'text' }).success, false);
  assert.equal(broadcastMessageSchema.safeParse({ messageType: 'template' }).success, false);
  assert.equal(broadcastMessageSchema.safeParse({
    messageType: 'text',
    messageText: 'Pesan',
    force: true,
  }).success, false);
  assert.equal(broadcastMessageSchema.safeParse({
    messageType: 'text',
    messageText: 'Pesan',
    force: true,
    requestKey: 'manual-0001',
  }).success, true);
  assert.equal(broadcastMessageSchema.safeParse({
    messageType: 'text',
    messageText: 'Pesan',
    unexpected: true,
  }).success, false);
});

test('template schema requires explicit type and authoritative enum scope', () => {
  const base = {
    name: 'Deadline Cabang',
    body: 'Segera kirim laporan',
    trigger: 'H_MIN_1',
    unit: 'CABANG',
  };
  assert.equal(createNotificationTemplateSchema.safeParse(base).success, false);
  const parsed = createNotificationTemplateSchema.parse({
    ...base,
    tipe_notifikasi: 'DEADLINE',
  });
  assert.equal(parsed.tipe_notifikasi, 'DEADLINE');
  assert.equal(createNotificationTemplateSchema.safeParse({
    ...base,
    trigger: 'MANUAL',
    tipe_notifikasi: 'DEADLINE',
  }).success, false);
  assert.equal(createNotificationTemplateSchema.safeParse({
    ...base,
    trigger: 'MANUAL',
    tipe_notifikasi: 'BROADCAST',
  }).success, true);
  assert.equal(createNotificationTemplateSchema.safeParse({
    ...base,
    unit: 'Unit Medan',
    tipe_notifikasi: 'BROADCAST',
  }).success, false);
});

test('unit params and deadline reject partial IDs and ambiguous dates', () => {
  assert.deepEqual(notificationUnitParamsSchema.parse({ id_unit: '17' }), { id_unit: 17 });
  for (const id of ['17x', '0', '-1', '01', ' 17']) {
    assert.equal(notificationUnitParamsSchema.safeParse({ id_unit: id }).success, false);
  }

  assert.equal(queueUnitReminderSchema.safeParse({ tenggat: '2026-09-30' }).success, true);
  for (const tenggat of ['2026-09-31', '2026/09/30', '2026-09-30T00:00:00Z']) {
    assert.equal(queueUnitReminderSchema.safeParse({ tenggat }).success, false);
  }
  assert.equal(queueUnitReminderSchema.safeParse({ force: true }).success, false);
  assert.equal(queueUnitReminderSchema.safeParse({
    force: true,
    requestKey: 'unit-force-0001',
  }).success, true);
});

test('log filters are bounded, typed, and strict', () => {
  assert.deepEqual(notificationLogsQuerySchema.parse({
    page: '2',
    limit: '25',
    status: 'RETRY',
    jenis: 'DEADLINE_REMINDER',
  }), {
    page: 2,
    limit: 25,
    status: 'RETRY',
    jenis: 'DEADLINE_REMINDER',
  });
  assert.equal(notificationLogsQuerySchema.safeParse({ limit: '101' }).success, false);
  assert.equal(notificationLogsQuerySchema.safeParse({ status: 'SENT' }).success, false);
  assert.equal(notificationLogsQuerySchema.safeParse({ unknown: 'value' }).success, false);
});
