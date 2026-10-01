'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApplication } = require('../../src/app');

test('public smoke routes do not connect WhatsApp or expose protected operations', async () => {
  let whatsappConnectCalls = 0;
  const runtime = createApplication({
    env: {
      NODE_ENV: 'test',
      ENABLE_WHATSAPP: 'false',
      ENABLE_NOTIFICATION_WORKER: 'false',
      ENABLE_NOTIFICATION_SCHEDULER: 'false',
      CORS_ORIGIN: 'http://localhost:3000',
    },
    logger: { info() {}, warn() {} },
    prismaClient: {
      async $connect() {},
      async $disconnect() {},
      async $queryRaw() {
        return [{ ok: 1 }];
      },
    },
    whatsappService: {
      async connect() {
        whatsappConnectCalls += 1;
      },
      async stop() {},
      getStatus() {
        return { state: 'disabled', connected: false };
      },
    },
    notificationService: {
      startNotificationWorker: () => ({ state: 'disabled' }),
      stopNotificationWorker: async () => ({ state: 'stopped' }),
      getNotificationQueueStats: async () => ({}),
    },
    cronService: {
      initCronJobs: () => ({ state: 'disabled' }),
      stopCronJobs: () => ({ state: 'stopped' }),
    },
    exportSemaphore: {
      close() {},
      async onIdle() {},
    },
    closePdfBrowserFn: async () => undefined,
  });

  try {
    const started = await runtime.startServer({ port: 0, host: '127.0.0.1' });
    const baseUrl = `http://127.0.0.1:${started.address.port}`;
    const [health, waStatus, pairingQr, requests, profile, retiredWebhook] = await Promise.all([
      fetch(`${baseUrl}/health`),
      fetch(`${baseUrl}/api/wacloud/status`),
      fetch(`${baseUrl}/api/wacloud/pairing-qr`),
      fetch(`${baseUrl}/api/permintaan`),
      fetch(`${baseUrl}/api/auth/profile`),
      fetch(`${baseUrl}/api/wacloud/webhook`),
    ]);

    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.data.status, 'ok');
    assert.equal('transport' in healthBody.data, false);
    assert.equal('queue' in healthBody.data, false);
    assert.equal(waStatus.status, 401);
    assert.equal(pairingQr.status, 401);
    assert.equal(requests.status, 401);
    assert.equal(profile.status, 401);
    assert.equal(retiredWebhook.status, 410);
    assert.equal(whatsappConnectCalls, 0);
  } finally {
    await runtime.shutdown('smoke-test');
  }
});
