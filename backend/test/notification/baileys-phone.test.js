'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');
const {
  WhatsAppService,
  WhatsAppInvalidPhoneError,
  WhatsAppDisconnectedError,
  CONNECTION_STATES,
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  parseWhatsAppWebVersion,
} = require('../../src/whatsapp/baileys.service');

test('Indonesian phone normalization produces strict canonical 62 numbers', () => {
  assert.equal(normalizeIndonesianPhone('0812 3456-7890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('+62 (812) 3456-7890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('6281234567890'), '6281234567890');
  assert.equal(isValidIndonesianPhone('021-555-0123'), true);
});

test('WhatsApp Web version override accepts only three safe numeric parts', () => {
  assert.deepEqual(parseWhatsAppWebVersion('2.3000.1043857760'), [2, 3000, 1043857760]);
  assert.deepEqual(parseWhatsAppWebVersion([2, 3000, 1043857760]), [2, 3000, 1043857760]);
  assert.equal(parseWhatsAppWebVersion('2.3000'), null);
  assert.equal(parseWhatsAppWebVersion('2.3000.latest'), null);
  assert.equal(parseWhatsAppWebVersion([2, -1, 3]), null);
});

test('web pairing QR is disabled by default and retains no credential', () => {
  const service = new WhatsAppService({ enabled: false, webQrEnabled: false });
  assert.equal(service.getStatus().webPairingEnabled, false);
  assert.equal(service.getStatus().pairingQrAvailable, false);
  assert.equal(service.getPairingQr(), null);
});

test('phone normalization rejects unsafe or non-Indonesian input', () => {
  const invalidValues = [
    '81234567890',
    '+63 8123456789',
    '0812.3456.7890',
    '0812abc3456',
    '6201234567',
    '62812',
    '6281234567890123',
    6281234567890,
  ];

  for (const value of invalidValues) {
    assert.equal(isValidIndonesianPhone(value), false);
    assert.throws(() => normalizeIndonesianPhone(value), WhatsAppInvalidPhoneError);
  }
});

test('connection state machine uses one socket and redacts QR events by default', async () => {
  const socketEvents = new EventEmitter();
  let socketCount = 0;
  let endCount = 0;
  let logoutCount = 0;
  let versionLookups = 0;
  let socketOptions;
  const baileysLogger = { level: 'silent' };
  const socket = {
    ev: socketEvents,
    end() {
      endCount += 1;
    },
    logout() {
      logoutCount += 1;
    },
  };
  const service = new WhatsAppService({
    enabled: true,
    webQrEnabled: true,
    webQrTtlMs: 60000,
    baileysLogger,
    baileysLoader: async () => ({
      makeWASocket: (options) => {
        socketCount += 1;
        socketOptions = options;
        return socket;
      },
      useMultiFileAuthState: async () => ({ state: {}, saveCreds: async () => {} }),
      fetchLatestBaileysVersion: async () => {
        versionLookups += 1;
        return { version: [2, 3000, 1043857760], isLatest: true };
      },
      DisconnectReason: { loggedOut: 401, badSession: 500, connectionReplaced: 440 },
    }),
  });

  let pairingEvent;
  let rawQrCount = 0;
  service.on('pairing-required', (event) => {
    pairingEvent = event;
  });
  service.on('qr', () => {
    rawQrCount += 1;
  });

  const firstConnect = service.connect();
  const secondConnect = service.connect();
  assert.strictEqual(firstConnect, secondConnect);
  await firstConnect;
  await service.connect();
  assert.equal(socketCount, 1);
  assert.equal(versionLookups, 1);
  assert.deepEqual(socketOptions.version, [2, 3000, 1043857760]);
  assert.strictEqual(socketOptions.logger, baileysLogger);
  assert.equal(socketOptions.markOnlineOnConnect, false);
  assert.equal(socketOptions.syncFullHistory, false);
  assert.equal(service.getStatus().state, CONNECTION_STATES.CONNECTING);

  socketEvents.emit('connection.update', { qr: 'raw-secret-qr-value' });
  assert.deepEqual(pairingEvent, { required: true });
  assert.equal(JSON.stringify(pairingEvent).includes('raw-secret-qr-value'), false);
  assert.equal(rawQrCount, 0);
  assert.equal(service.getStatus().webPairingEnabled, true);
  assert.equal(service.getStatus().pairingQrAvailable, true);
  assert.equal(service.getPairingQr().value, 'raw-secret-qr-value');
  assert.ok(service.getPairingQr().expiresAt instanceof Date);

  socketEvents.emit('connection.update', { connection: 'open' });
  assert.equal(service.getStatus().state, CONNECTION_STATES.CONNECTED);
  assert.equal(service.getStatus().pairingQrAvailable, false);
  assert.equal(service.getPairingQr(), null);

  await service.stop();
  assert.equal(service.getStatus().state, CONNECTION_STATES.STOPPING);
  assert.equal(endCount, 1);
  assert.equal(logoutCount, 0);

  socketEvents.emit('connection.update', { connection: 'open' });
  assert.equal(service.getStatus().state, CONNECTION_STATES.STOPPING);
});

test('logged-out sockets are terminal and do not schedule reconnects', async () => {
  const socketEvents = new EventEmitter();
  let scheduledRetries = 0;
  const service = new WhatsAppService({
    enabled: true,
    setTimeout: () => {
      scheduledRetries += 1;
      return { unref() {} };
    },
    clearTimeout: () => {},
    baileysLoader: async () => ({
      makeWASocket: () => ({ ev: socketEvents }),
      useMultiFileAuthState: async () => ({ state: {}, saveCreds: async () => {} }),
      DisconnectReason: { loggedOut: 401, badSession: 500, connectionReplaced: 440 },
    }),
  });

  await service.connect();
  socketEvents.emit('connection.update', {
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 401 } } },
  });

  assert.equal(service.getStatus().state, CONNECTION_STATES.LOGGED_OUT);
  assert.equal(service.getStatus().terminalReason, 'loggedOut');
  assert.equal(scheduledRetries, 0);
});

test('405 registration failures are sanitized and retried with backoff', async () => {
  const socketEvents = new EventEmitter();
  const errors = [];
  let scheduledRetries = 0;
  const service = new WhatsAppService({
    enabled: true,
    logger: { error: (message) => errors.push(message) },
    setTimeout: () => {
      scheduledRetries += 1;
      return { unref() {} };
    },
    clearTimeout: () => {},
    baileysLoader: async () => ({
      makeWASocket: () => ({ ev: socketEvents }),
      useMultiFileAuthState: async () => ({ state: {}, saveCreds: async () => {} }),
      DisconnectReason: { loggedOut: 401, badSession: 500, connectionReplaced: 440 },
    }),
  });

  await service.connect();
  socketEvents.emit('connection.update', {
    connection: 'close',
    lastDisconnect: {
      error: {
        output: { statusCode: 405 },
        data: { devicePairingData: 'must-not-be-logged' },
      },
    },
  });

  assert.equal(scheduledRetries, 1);
  assert.deepEqual(errors, [
    '[WA] Registration rejected (code 405); verify the Baileys package and WhatsApp Web version.',
  ]);
  assert.equal(JSON.stringify(errors).includes('devicePairingData'), false);
});

test('sendNow returns provider acceptance and never queues while disconnected', async () => {
  const service = new WhatsAppService({ enabled: true });
  service.state = CONNECTION_STATES.CONNECTED;
  service.isConnected = true;
  service._ready = true;
  service.sock = {
    sendMessage: async (jid, body) => {
      assert.equal(jid, '6281234567890@s.whatsapp.net');
      assert.deepEqual(body, { text: 'Pesan uji' });
      return { key: { id: 'provider-123' } };
    },
  };

  assert.deepEqual(await service.sendNow('081234567890', 'Pesan uji'), {
    state: 'accepted',
    providerMessageId: 'provider-123',
  });
  assert.equal(service.getStatus().queued, 0);

  service.state = CONNECTION_STATES.BACKOFF;
  service.isConnected = false;
  service._ready = false;
  await assert.rejects(
    service.sendNow('081234567890', 'Tidak boleh diantrikan'),
    WhatsAppDisconnectedError
  );
  assert.equal(service.getStatus().queued, 0);
});
