'use strict';

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const prisma = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const { sendSuccess, sendError } = require('./utils/response');
const { verifyToken } = require('./utils/jwt');

const authRoutes = require('./routes/auth.routes');
const penggunaRoutes = require('./routes/pengguna.routes');
const unitRoutes = require('./routes/unit.routes');
const laporanRoutes = require('./routes/laporan.routes');
const exportRoutes = require('./routes/export.routes');
const {
  targetRouter,
  komoditiRouter,
  permintaanRouter,
  auditRouter,
  systemRouter,
  programRouter,
} = require('./routes/misc.routes');
const waCloudRoutes = require('./routes/waCloudRoutes');

const { setupSocketEvents } = require('./whatsapp/whatsapp.events');
const whatsappService = require('./whatsapp/baileys.service');
const { initCronJobs, stopCronJobs } = require('./services/cron.service');
const {
  startNotificationWorker,
  stopNotificationWorker,
  getNotificationQueueStats,
} = require('./services/notification.service');
const { closePdfBrowser } = require('./services/export/pdf.renderer');
const { exportSemaphore } = require('./services/export/export-concurrency');

const API_PREFIX = '/api';
const DEFAULT_PORT = 5000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;

function enabled(env, name) {
  return env[name] === 'true';
}

function resolvePort(value) {
  const candidate = value === undefined || value === '' ? DEFAULT_PORT : value;
  const parsed = typeof candidate === 'number' ? candidate : Number(candidate);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new TypeError('PORT must be an integer between 0 and 65535');
  }
  return parsed;
}

function listenForSuccess(server, { port, host } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => server.removeListener?.('error', onError);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onError = (error) => finish(reject, error);
    const onListening = () => finish(resolve, server.address?.() || { port });

    server.once?.('error', onError);
    try {
      if (host) server.listen(port, host, onListening);
      else server.listen(port, onListening);
    } catch (error) {
      finish(reject, error);
    }
  });
}

function closeHttpServer(server) {
  if (!server?.listening || typeof server.close !== 'function') return Promise.resolve();
  return new Promise((resolve, reject) => {
    try {
      server.close((error) => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
        else resolve();
      });
    } catch (error) {
      if (error.code === 'ERR_SERVER_NOT_RUNNING') resolve();
      else reject(error);
    }
  });
}

function closeSocketServer(io) {
  if (!io || typeof io.close !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      const result = io.close(done);
      if (result && typeof result.then === 'function') result.then(done, done);
    } catch (error) {
      done();
    }
  });
}

function createApplication(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const prismaClient = options.prismaClient || prisma;
  const whatsApp = options.whatsappService || whatsappService;
  const cronLifecycle = options.cronService || { initCronJobs, stopCronJobs };
  const notificationLifecycle = options.notificationService || {
    startNotificationWorker,
    stopNotificationWorker,
    getNotificationQueueStats,
  };
  const exportQueue = options.exportSemaphore || exportSemaphore;
  const closePdf = options.closePdfBrowserFn || closePdfBrowser;
  const createHttpServer = options.createHttpServerFn || createServer;
  const SocketServer = options.SocketServerClass || Server;
  const socketFactory = options.setupSocketEventsFn || setupSocketEvents;

  const app = express();
  const httpServer = options.httpServer || createHttpServer(app);
  const io =
    options.io ||
    new SocketServer(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

  const socketEvents = socketFactory(io, {
    prismaClient,
    verifyTokenFn: options.verifyTokenFn || verifyToken,
    getWhatsAppStatus: () => whatsApp.getStatus(),
    getNotificationQueueStats: () =>
      notificationLifecycle.getNotificationQueueStats({ prismaClient }),
  });

  app.set('io', io);
  app.set('socketEvents', socketEvents);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
      exposedHeaders: ['Content-Disposition', 'X-Export-Record-Count'],
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/pengguna`, penggunaRoutes);
  app.use(`${API_PREFIX}/unit`, unitRoutes);
  app.use(`${API_PREFIX}/laporan`, laporanRoutes);
  app.use(`${API_PREFIX}/exports`, exportRoutes);
  app.use(`${API_PREFIX}/target`, targetRouter);
  app.use(`${API_PREFIX}/komoditi`, komoditiRouter);
  app.use(`${API_PREFIX}/program`, programRouter);
  app.use(`${API_PREFIX}/permintaan`, permintaanRouter);
  app.use(`${API_PREFIX}/audit`, auditRouter);
  app.use(`${API_PREFIX}/system`, systemRouter);
  app.use(`${API_PREFIX}/wacloud`, waCloudRoutes);

  const healthHandler = async (req, res) => {
    try {
      await prismaClient.$queryRaw`SELECT 1`;
      return sendSuccess(
        res,
        {
          status: 'ok',
          database: 'connected',
          timestamp: new Date().toISOString(),
        },
        'Server sehat'
      );
    } catch (error) {
      return sendError(res, 'Database tidak terhubung', 503);
    }
  };

  app.get('/health', healthHandler);
  app.get(`${API_PREFIX}/health`, healthHandler);
  app.use((req, res) => sendError(res, `Route ${req.method} ${req.path} tidak ditemukan`, 404));
  app.use(errorHandler);

  const lifecycle = {
    state: 'idle',
    databaseConnected: false,
    listening: false,
    whatsappEnabled: false,
    workerStarted: false,
    cronStarted: false,
  };
  let startPromise = null;
  let shutdownPromise = null;
  let stopRequested = false;
  let relaysAttached = false;

  const assertStartupActive = () => {
    if (!stopRequested) return;
    const error = new Error('Server startup was cancelled by shutdown');
    error.code = 'STARTUP_ABORTED';
    throw error;
  };

  const relayWhatsAppState = (status) => socketEvents.emitWAStatus(status);
  const relayPairingRequired = () => socketEvents.emitPairingRequired();

  const attachWhatsAppRelays = () => {
    if (relaysAttached || typeof whatsApp.on !== 'function') return;
    whatsApp.on('state', relayWhatsAppState);
    whatsApp.on('pairing-required', relayPairingRequired);
    relaysAttached = true;
  };

  const detachWhatsAppRelays = () => {
    if (!relaysAttached) return;
    const remove = whatsApp.off || whatsApp.removeListener;
    if (typeof remove === 'function') {
      remove.call(whatsApp, 'state', relayWhatsAppState);
      remove.call(whatsApp, 'pairing-required', relayPairingRequired);
    }
    relaysAttached = false;
  };

  const disconnectDatabase = async () => {
    if (!lifecycle.databaseConnected) return;
    lifecycle.databaseConnected = false;
    await prismaClient.$disconnect();
  };

  const stopOptionalServices = async () => {
    try {
      cronLifecycle.stopCronJobs();
    } catch (error) {
      // Continue shutdown; scheduler cleanup must not block other resources.
    }
    lifecycle.cronStarted = false;

    await Promise.allSettled([
      Promise.resolve().then(() => notificationLifecycle.stopNotificationWorker()),
      Promise.resolve().then(() => whatsApp.stop()),
    ]);
    lifecycle.workerStarted = false;
    lifecycle.whatsappEnabled = false;
    detachWhatsAppRelays();
  };

  const cleanupFailedStartup = async () => {
    await stopOptionalServices();
    if (lifecycle.listening) {
      await Promise.allSettled([closeSocketServer(io), closeHttpServer(httpServer)]);
      lifecycle.listening = false;
    }
    await disconnectDatabase().catch(() => {});
  };

  const startServer = (startOptions = {}) => {
    if (
      stopRequested ||
      shutdownPromise ||
      lifecycle.state === 'stopped' ||
      lifecycle.state === 'stopping'
    ) {
      return Promise.reject(new Error('Server runtime has already been stopped'));
    }
    if (startPromise) return startPromise;

    lifecycle.state = 'starting';
    const port = resolvePort(startOptions.port ?? env.PORT);
    const host = startOptions.host ?? env.HOST;

    const operation = (async () => {
      try {
        await prismaClient.$connect();
        lifecycle.databaseConnected = true;
        assertStartupActive();

        const address = await listenForSuccess(httpServer, { port, host });
        lifecycle.listening = true;
        assertStartupActive();

        if (enabled(env, 'ENABLE_WHATSAPP')) {
          lifecycle.whatsappEnabled = true;
          attachWhatsAppRelays();
          try {
            await whatsApp.connect();
          } catch (error) {
            if (typeof logger.warn === 'function') {
              logger.warn('[App] WhatsApp transport is in backoff; startup will continue.');
            }
          }
          assertStartupActive();
          socketEvents.emitWAStatus(whatsApp.getStatus());

          if (enabled(env, 'ENABLE_NOTIFICATION_WORKER')) {
            const worker = notificationLifecycle.startNotificationWorker({
              provider: whatsApp,
              prismaClient,
            });
            lifecycle.workerStarted = ['started', 'already_running'].includes(worker?.state);
          }
          if (enabled(env, 'ENABLE_NOTIFICATION_SCHEDULER')) {
            const scheduler = cronLifecycle.initCronJobs({ env });
            lifecycle.cronStarted = ['started', 'already_running'].includes(scheduler?.state);
          }
        }

        assertStartupActive();
        lifecycle.state = 'started';
        if (typeof logger.info === 'function') logger.info('[App] Server started.');
        return { state: 'started', address };
      } catch (error) {
        if (!stopRequested) lifecycle.state = 'failed';
        await cleanupFailedStartup();
        startPromise = null;
        throw error;
      }
    })();

    startPromise = operation;
    return operation;
  };

  const forceCloseTransports = () => {
    try {
      io.disconnectSockets?.(true);
    } catch (error) {
      // Best effort after the graceful deadline.
    }
    try {
      httpServer.closeAllConnections?.();
    } catch (error) {
      // Best effort after the graceful deadline.
    }
  };

  const shutdown = (signal = 'shutdown', shutdownOptions = {}) => {
    if (shutdownPromise) return shutdownPromise;

    const timeoutMs = Number.isInteger(shutdownOptions.timeoutMs)
      ? Math.max(1, shutdownOptions.timeoutMs)
      : DEFAULT_SHUTDOWN_TIMEOUT_MS;
    stopRequested = true;
    lifecycle.state = 'stopping';

    shutdownPromise = (async () => {
      let timeoutId;
      const cleanup = (async () => {
        try {
          cronLifecycle.stopCronJobs();
        } catch (error) {
          // Continue with remaining cleanup.
        }
        lifecycle.cronStarted = false;

        const startupSettled = startPromise
          ? Promise.resolve(startPromise).catch(() => undefined)
          : Promise.resolve();
        const workerStop = Promise.resolve().then(() =>
          notificationLifecycle.stopNotificationWorker()
        );
        const whatsappStop = Promise.resolve().then(() => whatsApp.stop());

        try {
          exportQueue.close();
        } catch (error) {
          // Continue with active export drainage.
        }

        const transportClose = (async () => {
          await closeSocketServer(io);
          await closeHttpServer(httpServer);
          lifecycle.listening = false;
        })();
        const exportsIdle = Promise.resolve().then(() => exportQueue.onIdle());

        await Promise.allSettled([
          startupSettled,
          workerStop,
          whatsappStop,
          transportClose,
          exportsIdle,
        ]);
        lifecycle.workerStarted = false;
        lifecycle.whatsappEnabled = false;
        detachWhatsAppRelays();

        await Promise.allSettled([closePdf(), disconnectDatabase()]);
        lifecycle.state = 'stopped';
        return { state: 'stopped', signal, timedOut: false };
      })();

      const timeout = new Promise((resolve) => {
        timeoutId = setTimeout(
          () => resolve({ state: 'stopped', signal, timedOut: true }),
          timeoutMs
        );
      });

      const result = await Promise.race([cleanup, timeout]);
      clearTimeout(timeoutId);

      if (result.timedOut) {
        forceCloseTransports();
        detachWhatsAppRelays();
        lifecycle.listening = false;
        lifecycle.state = 'stopped';
        void Promise.allSettled([closePdf(), disconnectDatabase()]);
        if (typeof logger.warn === 'function') {
          logger.warn('[App] Graceful shutdown deadline reached.');
        }
      }

      return result;
    })();

    return shutdownPromise;
  };

  return {
    app,
    io,
    httpServer,
    socketEvents,
    startServer,
    shutdown,
    getLifecycleState: () => ({ ...lifecycle }),
  };
}

function installSignalHandlers(runtime, processObject = process) {
  const handle = (signal) => {
    void runtime.shutdown(signal).then(
      (result) => processObject.exit(result.timedOut ? 1 : 0),
      () => processObject.exit(1)
    );
  };
  processObject.once('SIGINT', handle);
  processObject.once('SIGTERM', handle);
  return () => {
    processObject.removeListener('SIGINT', handle);
    processObject.removeListener('SIGTERM', handle);
  };
}

let defaultRuntime = null;

function getDefaultRuntime() {
  if (!defaultRuntime) defaultRuntime = createApplication();
  return defaultRuntime;
}

if (require.main === module) {
  const runtime = getDefaultRuntime();
  installSignalHandlers(runtime);
  runtime.startServer().catch((error) => {
    const code = error?.code ? ` (${error.code})` : '';
    console.error(`[App] Server startup failed${code}.`);
    process.exitCode = 1;
  });
}

const exported = {
  API_PREFIX,
  DEFAULT_PORT,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  enabled,
  resolvePort,
  listenForSuccess,
  closeHttpServer,
  closeSocketServer,
  createApplication,
  getDefaultRuntime,
  installSignalHandlers,
};

for (const property of [
  'app',
  'io',
  'httpServer',
  'socketEvents',
  'startServer',
  'shutdown',
  'getLifecycleState',
]) {
  Object.defineProperty(exported, property, {
    enumerable: true,
    get: () => getDefaultRuntime()[property],
  });
}

module.exports = exported;
