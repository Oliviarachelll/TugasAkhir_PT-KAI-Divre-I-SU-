'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const originalEncryptionKey = process.env.NOTIFICATION_ENCRYPTION_KEY;
const originalJwtSecret = process.env.JWT_SECRET;
process.env.NOTIFICATION_ENCRYPTION_KEY = 'test-only-notification-encryption-key';

const {
  NOTIFICATION_TYPES,
  NotificationPayloadError,
  encryptNotificationPayload,
  decryptNotificationPayload,
  enqueueNotification,
  processNextJob,
} = require('../../src/services/notification.service');

function restoreEnvironment() {
  if (originalEncryptionKey === undefined) delete process.env.NOTIFICATION_ENCRYPTION_KEY;
  else process.env.NOTIFICATION_ENCRYPTION_KEY = originalEncryptionKey;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
}

test.after(restoreEnvironment);

test('AES-256-GCM payload roundtrip does not expose plaintext', () => {
  const payload = {
    version: 1,
    text: 'Token rahasia ABCD-EFGH-JKMP-QRST',
    metadata: { resetToken: 'ABCD-EFGH-JKMP-QRST', reportId: 42 },
  };
  const encrypted = encryptNotificationPayload(payload);

  assert.match(encrypted, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(encrypted.includes(payload.text), false);
  assert.equal(encrypted.includes(payload.metadata.resetToken), false);
  assert.deepEqual(decryptNotificationPayload(encrypted), payload);

  const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;
  assert.throws(() => decryptNotificationPayload(tampered), NotificationPayloadError);
});

test('enqueue encrypts persisted payload, canonicalizes phone, and handles P2002', async () => {
  const rows = new Map();
  const writes = [];
  const fakeTx = {
    notificationJob: {
      async create(query) {
        writes.push(query.data);
        if (rows.has(query.data.dedupe_key)) {
          const error = new Error('Unique constraint');
          error.code = 'P2002';
          throw error;
        }
        const row = { id: rows.size + 1, ...query.data };
        rows.set(query.data.dedupe_key, row);
        return { id: row.id };
      },
      async findUnique(query) {
        const row = rows.get(query.where.dedupe_key);
        return row ? { id: row.id, status: row.status } : null;
      },
      async updateMany(query) {
        const row = [...rows.values()].find((candidate) => candidate.id === query.where.id);
        if (!row || row.status !== query.where.status) return { count: 0 };
        Object.assign(row, query.data);
        return { count: 1 };
      },
    },
  };

  const input = {
    tx: fakeTx,
    dedupeKey: 'password-reset:user-7:request-9',
    jenis: NOTIFICATION_TYPES.PASSWORD_RESET,
    recipientName: 'Budi',
    recipientPhone: '0812-3456-7890',
    text: 'Gunakan token ABCD-EFGH-JKMP-QRST',
    metadata: { token: 'ABCD-EFGH-JKMP-QRST' },
    expiresAt: new Date(Date.now() + 60_000),
    maxAttempts: 3,
  };

  const queued = await enqueueNotification(input);
  const duplicate = await enqueueNotification(input);

  assert.deepEqual(queued, {
    state: 'queued',
    duplicate: false,
    jobId: 1,
    dedupeKey: input.dedupeKey,
  });
  assert.deepEqual(duplicate, {
    state: 'duplicate',
    duplicate: true,
    terminalConflict: false,
    jobId: 1,
    existingStatus: 'PENDING',
    dedupeKey: input.dedupeKey,
  });
  assert.equal(writes[0].recipient_phone, '6281234567890');
  assert.equal(writes[0].status, 'PENDING');
  assert.equal(writes[0].payload_encrypted.includes(input.text), false);
  assert.equal(writes[0].payload_encrypted.includes(input.metadata.token), false);
  assert.equal(JSON.stringify(writes[0]).includes(input.text), false);
  assert.equal(JSON.stringify(writes[0]).includes(input.metadata.token), false);
  assert.deepEqual(decryptNotificationPayload(writes[0].payload_encrypted), {
    version: 1,
    text: input.text,
    metadata: input.metadata,
  });

  rows.get(input.dedupeKey).status = 'FAILED';
  rows.get(input.dedupeKey).attempts = 3;
  const requeued = await enqueueNotification(input);
  assert.deepEqual(requeued, {
    state: 'requeued',
    duplicate: false,
    terminalConflict: false,
    jobId: 1,
    previousStatus: 'FAILED',
    dedupeKey: input.dedupeKey,
  });
  assert.equal(rows.get(input.dedupeKey).status, 'PENDING');
  assert.equal(rows.get(input.dedupeKey).attempts, 0);
});

test('worker does not touch the outbox while Baileys is disconnected', async () => {
  let transactionCount = 0;
  const fakePrisma = {
    async $transaction() {
      transactionCount += 1;
      throw new Error('The outbox must not be queried');
    },
  };
  const provider = {
    getStatus: () => ({ state: 'backoff', connected: false }),
  };

  assert.deepEqual(await processNextJob({ prismaClient: fakePrisma, provider }), {
    state: 'provider_unavailable',
    jobId: null,
  });
  assert.equal(transactionCount, 0);
});

test('worker atomically claims and records provider acceptance as ACCEPTED', async () => {
  const now = new Date('2026-09-30T01:00:00.000Z');
  const job = {
    id: 77,
    dedupe_key: 'custom:77',
    jenis: NOTIFICATION_TYPES.CUSTOM_BROADCAST,
    recipient_name: 'Budi',
    recipient_phone: '6281234567890',
    payload_encrypted: encryptNotificationPayload({
      version: 1,
      text: 'Pesan terenkripsi',
      metadata: null,
    }),
    status: 'PENDING',
    attempts: 0,
    max_attempts: 3,
    next_attempt_at: new Date('2026-09-30T00:00:00.000Z'),
    expires_at: null,
    locked_at: null,
    lock_owner: null,
  };
  let transactionCount = 0;
  const fakePrisma = {
    notificationJob: {
      async findFirst() {
        return job.status === 'PENDING' || job.status === 'RETRY' ? { ...job } : null;
      },
      async updateMany(query) {
        if (query.data.status === 'PROCESSING') {
          if (job.status !== 'PENDING' && job.status !== 'RETRY') return { count: 0 };
          job.status = 'PROCESSING';
          job.attempts += 1;
          job.locked_at = query.data.locked_at;
          job.lock_owner = query.data.lock_owner;
          return { count: 1 };
        }
        if (query.data.status === 'ACCEPTED' && job.status === 'PROCESSING') {
          Object.assign(job, query.data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    async $transaction(callback) {
      transactionCount += 1;
      return callback(this);
    },
  };
  const provider = {
    getStatus: () => ({ state: 'connected', connected: true }),
    async sendNow(phone, text) {
      assert.equal(phone, job.recipient_phone);
      assert.equal(text, 'Pesan terenkripsi');
      return { state: 'accepted', providerMessageId: 'wa-provider-77' };
    },
  };

  const result = await processNextJob({
    prismaClient: fakePrisma,
    provider,
    workerId: 'test-worker',
    now,
  });

  assert.equal(transactionCount, 1);
  assert.equal(result.state, 'accepted');
  assert.equal(result.providerMessageId, 'wa-provider-77');
  assert.equal(job.status, 'ACCEPTED');
  assert.notEqual(job.status, 'DELIVERED');
  assert.equal(job.provider_message_id, 'wa-provider-77');
  assert.equal(job.attempts, 1);
  assert.equal(job.lock_owner, null);
});
