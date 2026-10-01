'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fakePrisma = {};
globalThis.prisma = fakePrisma;
const reminderService = require('../../src/services/reminder.service');
const whatsappService = require('../../src/whatsapp/baileys.service');
const controller = require('../../src/controllers/waCloudController');

const originalBroadcast = reminderService.broadcastBaileys;
const originalGetPairingQr = whatsappService.getPairingQr;

function resetPrisma() {
  for (const key of Object.keys(fakePrisma)) delete fakePrisma[key];
  reminderService.broadcastBaileys = originalBroadcast;
  whatsappService.getPairingQr = originalGetPairingQr;
}

function createResponse() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
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

test.beforeEach(resetPrisma);
test.after(() => {
  reminderService.broadcastBaileys = originalBroadcast;
  whatsappService.getPairingQr = originalGetPairingQr;
  delete globalThis.prisma;
});

test('queue outcomes use 202, 207, and an error when every enqueue fails', () => {
  const accepted = createResponse();
  controller.sendQueueOutcome(accepted, {
    queued: 2,
    duplicate: 0,
    failed: 0,
    skipped: 0,
  }, 'Diantrikan');
  assert.equal(accepted.statusCode, 202);
  assert.equal(accepted.body.success, true);

  const partial = createResponse();
  controller.sendQueueOutcome(partial, {
    queued: 1,
    duplicate: 0,
    failed: 1,
    skipped: 0,
  }, 'Diantrikan');
  assert.equal(partial.statusCode, 207);
  assert.equal(partial.body.success, true);

  const failed = createResponse();
  controller.sendQueueOutcome(failed, {
    queued: 0,
    duplicate: 0,
    failed: 2,
    skipped: 0,
  }, 'Diantrikan');
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body.success, false);
});

test('broadcast controller returns an accepted outbox result without transport sends', async () => {
  let args;
  reminderService.broadcastBaileys = async (value) => {
    args = value;
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
  const res = createResponse();
  await controller.sendBroadcast({
    body: { messageType: 'text', messageText: 'Pesan', unitPenerima: 'SEMUA' },
  }, res);

  assert.equal(args.source, 'manual');
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.data.queued, 1);
});

test('notification logs are paginated, omit payloads, redact phones, and structure status', async () => {
  let findQuery;
  let countQuery;
  fakePrisma.notificationJob = {
    async findMany(query) {
      findQuery = query;
      return [{
        id: 7,
        dedupe_key: 'deadline:2026-09-30:unit-1:user-2',
        jenis: 'DEADLINE_REMINDER',
        recipient_name: 'Budi',
        recipient_phone: '6281234567890',
        status: 'RETRY',
        attempts: 2,
        max_attempts: 5,
        next_attempt_at: new Date('2026-09-30T02:00:00.000Z'),
        provider_message_id: null,
        last_error: 'PROVIDER_UNAVAILABLE',
        accepted_at: null,
        delivered_at: null,
        created_at: new Date('2026-09-30T01:00:00.000Z'),
        updated_at: new Date('2026-09-30T01:30:00.000Z'),
      }];
    },
    async count(query) {
      countQuery = query;
      return 21;
    },
  };
  fakePrisma.$transaction = async (operations) => Promise.all(operations);

  const res = createResponse();
  await controller.getLogs({
    query: { page: 2, limit: 10, status: 'RETRY', jenis: 'DEADLINE_REMINDER' },
  }, res);

  assert.equal(findQuery.skip, 10);
  assert.equal(findQuery.take, 10);
  assert.deepEqual(countQuery.where, {
    status: 'RETRY',
    jenis: 'DEADLINE_REMINDER',
  });
  assert.equal(findQuery.select.payload_encrypted, undefined);
  const item = res.body.data.items[0];
  assert.notEqual(item.recipient.phone, '6281234567890');
  assert.match(item.recipient.phone, /^62\*+7890$/);
  assert.deepEqual(item.status, {
    code: 'RETRY',
    terminal: false,
    attempts: 2,
    max_attempts: 5,
    next_attempt_at: new Date('2026-09-30T02:00:00.000Z'),
    accepted_at: null,
    delivered_at: null,
    provider_message_id: null,
    last_error: 'PROVIDER_UNAVAILABLE',
  });
  assert.equal(res.body.data.pagination.page, 2);
  assert.equal(res.body.data.pagination.total, 21);
});

test('admin pairing endpoint returns a no-store PNG without exposing raw QR text', async () => {
  const rawQr = 'https://wa.me/settings/linked_devices#secret-pairing-value';
  const expiresAt = new Date(Date.now() + 60_000);
  whatsappService.getPairingQr = () => ({ value: rawQr, expiresAt });

  const res = createResponse();
  await controller.getPairingQr({}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.available, true);
  assert.match(res.body.data.image_data_url, /^data:image\/png;base64,/);
  assert.equal(JSON.stringify(res.body).includes(rawQr), false);
  assert.equal(res.body.data.expires_at, expiresAt.toISOString());
  assert.match(res.headers['cache-control'], /no-store/);
  assert.equal(res.headers.pragma, 'no-cache');

  whatsappService.getPairingQr = () => null;
  const unavailable = createResponse();
  await controller.getPairingQr({}, unavailable);
  assert.equal(unavailable.statusCode, 200);
  assert.deepEqual(unavailable.body.data, {
    available: false,
    image_data_url: null,
    expires_at: null,
  });
});

test('metrics use one half-open Jakarta day and status exposes transport plus queue', async () => {
  const metricQueries = [];
  fakePrisma.notificationJob = {
    async groupBy(query) {
      metricQueries.push(query);
      if (query.by[0] === 'status') return [{ status: 'PENDING', _count: { _all: 3 } }];
      return [{ jenis: 'CUSTOM_BROADCAST', _count: { _all: 3 } }];
    },
    async count(query) {
      if (query.where.accepted_at) return 2;
      if (query.where.delivered_at) return 1;
      if (query.where.next_attempt_at) return 3;
      return 0;
    },
  };

  const metricsRes = createResponse();
  await controller.getNotificationMetrics({}, metricsRes);
  const range = metricsRes.body.data.range;
  assert.equal(range.end.getTime() - range.start.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(range.start.getUTCHours(), 17);
  assert.equal(metricQueries[0].where.created_at.gte.getTime(), range.start.getTime());
  assert.equal(metricQueries[0].where.created_at.lt.getTime(), range.end.getTime());
  assert.equal(metricsRes.body.data.created, 3);
  assert.equal(metricsRes.body.data.accepted, 2);
  assert.equal(metricsRes.body.data.delivered, 1);

  fakePrisma.notificationJob.groupBy = async () => [
    { status: 'PENDING', _count: { _all: 2 } },
    { status: 'RETRY', _count: { _all: 1 } },
  ];
  fakePrisma.notificationJob.count = async (query) => (
    query.where.status === 'PROCESSING' ? 0 : 3
  );
  const statusRes = createResponse();
  await controller.getWaStatus({}, statusRes);
  assert.ok(statusRes.body.data.transport);
  assert.equal(statusRes.body.data.queue.pending, 2);
  assert.equal(statusRes.body.data.queue.retry, 1);
  assert.equal(statusRes.body.data.queued, 3);
});
