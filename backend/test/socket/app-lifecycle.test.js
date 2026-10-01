'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createApplication } = require('../../src/app');

class FakeHttpServer extends EventEmitter {
  constructor(events) {
    super();
    this.events = events;
    this.listening = false;
    this.closedConnections = false;
    this.currentAddress = null;
  }

  listen(port, hostOrCallback, maybeCallback) {
    const callback = typeof hostOrCallback === 'function' ? hostOrCallback : maybeCallback;
    const host = typeof hostOrCallback === 'string' ? hostOrCallback : '127.0.0.1';
    this.listening = true;
    this.currentAddress = { address: host, family: 'IPv4', port: port || 43123 };
    setImmediate(() => {
      this.events.push('http:listening');
      callback?.();
    });
    return this;
  }

  address() {
    return this.currentAddress;
  }

  close(callback) {
    this.events.push('http:close');
    this.listening = false;
    setImmediate(() => callback?.());
    return this;
  }

  closeAllConnections() {
    this.closedConnections = true;
  }
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

test('application startup is idempotent and graceful shutdown drains every managed resource', async () => {
  const events = [];
  const httpServer = new FakeHttpServer(events);
  const io = {
    close(callback) {
      events.push('socket:close');
      setImmediate(callback);
    },
    disconnectSockets() {
      events.push('socket:force-disconnect');
    },
  };
  const socketEvents = {
    emitWAStatus(status) {
      events.push(`socket:wa:${status.state}`);
    },
    emitPairingRequired() {
      events.push('socket:pairing-required');
    },
  };
  const whatsApp = Object.assign(new EventEmitter(), {
    async connect() {
      events.push('wa:connect');
      return { state: 'connected' };
    },
    async stop() {
      events.push('wa:stop');
    },
    getStatus() {
      return { state: 'connected', connected: true };
    },
  });
  const prismaClient = {
    async $connect() {
      events.push('db:connect');
    },
    async $disconnect() {
      events.push('db:disconnect');
    },
    async $queryRaw() {
      events.push('db:health');
      return [{ ok: 1 }];
    },
  };
  const notificationService = {
    startNotificationWorker(options) {
      assert.strictEqual(options.provider, whatsApp);
      assert.strictEqual(options.prismaClient, prismaClient);
      events.push('worker:start');
      return { state: 'started' };
    },
    async stopNotificationWorker() {
      events.push('worker:stop');
    },
    async getNotificationQueueStats() {
      return { pending: 0 };
    },
  };
  const cronService = {
    initCronJobs({ env }) {
      assert.equal(env.ENABLE_NOTIFICATION_SCHEDULER, 'true');
      events.push('cron:start');
      return { state: 'started' };
    },
    stopCronJobs() {
      events.push('cron:stop');
      return { state: 'stopped' };
    },
  };
  const exportSemaphore = {
    close() {
      events.push('exports:close');
    },
    async onIdle() {
      events.push('exports:idle');
    },
  };

  const runtime = createApplication({
    env: {
      NODE_ENV: 'test',
      PORT: '0',
      ENABLE_WHATSAPP: 'true',
      ENABLE_NOTIFICATION_WORKER: 'true',
      ENABLE_NOTIFICATION_SCHEDULER: 'true',
    },
    logger: { info() {}, warn() {} },
    prismaClient,
    whatsappService: whatsApp,
    notificationService,
    cronService,
    exportSemaphore,
    closePdfBrowserFn: async () => events.push('pdf:close'),
    httpServer,
    io,
    setupSocketEventsFn: (_io, options) => {
      assert.strictEqual(_io, io);
      assert.strictEqual(options.prismaClient, prismaClient);
      return socketEvents;
    },
  });

  assert.strictEqual(runtime.app.get('socketEvents'), socketEvents);
  const firstStart = runtime.startServer();
  const secondStart = runtime.startServer();
  assert.strictEqual(firstStart, secondStart);
  const started = await firstStart;

  assert.equal(started.state, 'started');
  assert.ok(events.indexOf('http:listening') < events.indexOf('wa:connect'));
  assert.equal(events.filter((event) => event === 'db:connect').length, 1);
  assert.equal(events.filter((event) => event === 'wa:connect').length, 1);
  assert.equal(events.filter((event) => event === 'worker:start').length, 1);
  assert.equal(events.filter((event) => event === 'cron:start').length, 1);

  const healthLayer = runtime.app._router.stack.find((layer) => layer.route?.path === '/health');
  assert.ok(healthLayer);
  const healthResponse = createResponse();
  await healthLayer.route.stack[0].handle({}, healthResponse);
  assert.equal(healthResponse.statusCode, 200);
  assert.deepEqual(Object.keys(healthResponse.body.data).sort(), [
    'database',
    'status',
    'timestamp',
  ]);
  assert.equal('transport' in healthResponse.body.data, false);
  assert.equal('queue' in healthResponse.body.data, false);

  const firstShutdown = runtime.shutdown('test');
  const secondShutdown = runtime.shutdown('test');
  assert.strictEqual(firstShutdown, secondShutdown);
  const stopped = await firstShutdown;

  assert.deepEqual(stopped, { state: 'stopped', signal: 'test', timedOut: false });
  for (const requiredEvent of [
    'cron:stop',
    'worker:stop',
    'wa:stop',
    'exports:close',
    'exports:idle',
    'socket:close',
    'http:close',
    'pdf:close',
    'db:disconnect',
  ]) {
    assert.ok(events.includes(requiredEvent), `missing lifecycle event ${requiredEvent}`);
  }
  assert.deepEqual(runtime.getLifecycleState(), {
    state: 'stopped',
    databaseConnected: false,
    listening: false,
    whatsappEnabled: false,
    workerStarted: false,
    cronStarted: false,
  });
});

test('shutdown cancels an in-progress startup and cannot be overwritten by it', async () => {
  let releaseConnect;
  let markConnectStarted;
  const connectGate = new Promise((resolve) => {
    releaseConnect = resolve;
  });
  const connectStarted = new Promise((resolve) => {
    markConnectStarted = resolve;
  });
  const events = [];
  const httpServer = new FakeHttpServer(events);
  const io = {
    close(callback) {
      callback?.();
    },
    disconnectSockets() {},
  };
  const prismaClient = {
    async $connect() {
      markConnectStarted();
      await connectGate;
    },
    async $disconnect() {
      events.push('db:disconnect');
    },
    async $queryRaw() {
      return [{ ok: 1 }];
    },
  };
  const runtime = createApplication({
    env: { NODE_ENV: 'test', PORT: '0', ENABLE_WHATSAPP: 'false' },
    logger: { info() {}, warn() {} },
    prismaClient,
    whatsappService: {
      getStatus: () => ({ state: 'disabled' }),
      stop: async () => undefined,
    },
    notificationService: {
      startNotificationWorker: () => ({ state: 'disabled' }),
      stopNotificationWorker: async () => undefined,
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
    httpServer,
    io,
    setupSocketEventsFn: () => ({
      emitWAStatus() {},
      emitPairingRequired() {},
    }),
  });

  const startup = runtime.startServer();
  await connectStarted;
  const startupRejected = assert.rejects(startup, { code: 'STARTUP_ABORTED' });
  const stopping = runtime.shutdown('startup-race');
  releaseConnect();

  await startupRejected;
  const result = await stopping;
  assert.equal(result.timedOut, false);
  assert.equal(httpServer.listening, false);
  assert.equal(events.includes('http:listening'), false);
  assert.equal(events.filter((event) => event === 'db:disconnect').length, 1);
  assert.equal(runtime.getLifecycleState().state, 'stopped');
});
