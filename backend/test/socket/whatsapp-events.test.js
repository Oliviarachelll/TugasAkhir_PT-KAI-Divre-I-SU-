'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SocketAuthenticationError,
  createSocketAuthMiddleware,
  extractSocketToken,
  sanitizeWhatsAppStatus,
  setupSocketEvents,
} = require('../../src/whatsapp/whatsapp.events');

function runMiddleware(middleware, socket) {
  return new Promise((resolve) => middleware(socket, resolve));
}

function waitForAsyncHandlers() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createNamespace() {
  return {
    middleware: null,
    connectionHandler: null,
    roomEvents: [],
    disconnectedRooms: [],
    use(handler) {
      this.middleware = handler;
    },
    on(event, handler) {
      if (event === 'connection') this.connectionHandler = handler;
    },
    to(room) {
      return {
        emit: (event, payload) => {
          this.roomEvents.push({ room, event, payload });
        },
      };
    },
    in(room) {
      return {
        disconnectSockets: (close) => {
          this.disconnectedRooms.push({ room, close });
        },
      };
    },
  };
}

function createSocket(handshake = {}) {
  return {
    handshake,
    data: {},
    joinedRooms: [],
    emitted: [],
    clientHandlers: [],
    disconnected: false,
    async join(room) {
      this.joinedRooms.push(room);
    },
    emit(event, payload) {
      this.emitted.push({ event, payload });
    },
    on(event, handler) {
      this.clientHandlers.push({ event, handler });
    },
    disconnect(force) {
      this.disconnected = force;
    },
  };
}

function jwtPayload(overrides = {}) {
  return {
    id_pengguna: 1,
    session_version: 4,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function user(overrides = {}) {
  return {
    id_pengguna: 1,
    nama: 'Operator',
    email: 'operator@example.com',
    peran: 'USER_UNIT',
    id_unit: 7,
    terkunci: false,
    terkunci_sampai: null,
    session_version: 4,
    ...overrides,
  };
}

test('socket token extraction accepts auth or Bearer header without query-string tokens', () => {
  assert.equal(extractSocketToken({ auth: { token: 'plain.jwt.token' } }), 'plain.jwt.token');
  assert.equal(
    extractSocketToken({ headers: { authorization: 'Bearer header.jwt.token' } }),
    'header.jwt.token'
  );
  assert.equal(extractSocketToken({ query: { token: 'leaky.jwt.token' } }), null);
  assert.equal(extractSocketToken({ auth: { token: 'contains whitespace' } }), null);
});

test('socket authentication reloads the account and rejects stale sessions or active locks', async () => {
  const records = [
    user({ session_version: 5 }),
    user({ terkunci: true, terkunci_sampai: new Date(Date.now() + 60_000) }),
  ];

  for (const record of records) {
    const middleware = createSocketAuthMiddleware({
      prismaClient: {
        pengguna: {
          findUnique: async () => record,
        },
      },
      verifyTokenFn: () => jwtPayload(),
    });
    const socket = createSocket({ auth: { token: 'valid.jwt.token' } });
    const error = await runMiddleware(middleware, socket);

    assert.ok(error instanceof SocketAuthenticationError);
    assert.equal(error.message, 'Unauthorized');
    assert.deepEqual(error.data, { code: 'SOCKET_UNAUTHORIZED' });
    assert.equal(socket.data.pengguna, undefined);
  }
});

test('socket authentication rejects tokens without a bounded expiry', async () => {
  const middleware = createSocketAuthMiddleware({
    prismaClient: {
      pengguna: {
        findUnique: async () => user(),
      },
    },
    verifyTokenFn: () => ({ id_pengguna: 1, session_version: 4 }),
  });
  const error = await runMiddleware(
    middleware,
    createSocket({ auth: { token: 'valid.jwt.token' } })
  );

  assert.ok(error instanceof SocketAuthenticationError);
});

test('socket authentication clears an expired temporary lock before allowing access', async () => {
  const updates = [];
  const record = user({
    terkunci: true,
    terkunci_sampai: new Date(Date.now() - 60_000),
  });
  const middleware = createSocketAuthMiddleware({
    prismaClient: {
      pengguna: {
        findUnique: async () => record,
        updateMany: async (query) => {
          updates.push(query);
          return { count: 1 };
        },
      },
    },
    verifyTokenFn: () => jwtPayload(),
  });
  const socket = createSocket({ auth: { token: 'valid.jwt.token' } });
  const error = await runMiddleware(middleware, socket);

  assert.equal(error, undefined);
  assert.equal(updates.length, 1);
  assert.equal(socket.data.pengguna.terkunci, false);
  assert.equal(socket.data.pengguna.terkunci_sampai, null);
});

test('dashboard namespace auto-joins trusted rooms and exposes no client-controlled join events', async () => {
  const dashboard = createNamespace();
  const io = {
    of(name) {
      assert.equal(name, '/dashboard');
      return dashboard;
    },
  };
  const prismaClient = {
    pengguna: {
      findUnique: async () => user(),
    },
  };
  setupSocketEvents(io, {
    prismaClient,
    verifyTokenFn: () => jwtPayload(),
    getWhatsAppStatus: () => ({ state: 'connected', connected: true }),
    getNotificationQueueStats: async () => ({ pending: 2 }),
  });

  const socket = createSocket({ auth: { token: 'valid.jwt.token' } });
  assert.equal(await runMiddleware(dashboard.middleware, socket), undefined);
  dashboard.connectionHandler(socket);
  await waitForAsyncHandlers();

  assert.deepEqual(socket.joinedRooms, ['user:1', 'unit:7']);
  assert.deepEqual(socket.clientHandlers.map(({ event }) => event), ['disconnect']);
  assert.equal(socket.emitted.some(({ event }) => event === 'wa:status'), false);
});

test('connected sockets are disconnected after session revocation', async () => {
  const dashboard = createNamespace();
  let currentUser = user();
  let revalidate;
  setupSocketEvents({ of: () => dashboard }, {
    prismaClient: {
      pengguna: {
        findUnique: async () => ({ ...currentUser }),
      },
    },
    verifyTokenFn: () => jwtPayload(),
    getWhatsAppStatus: () => ({ state: 'connected' }),
    getNotificationQueueStats: async () => ({}),
    setTimeoutFn: () => ({ unref() {} }),
    clearTimeoutFn() {},
    setIntervalFn: (handler) => {
      revalidate = handler;
      return { unref() {} };
    },
    clearIntervalFn() {},
    sessionRevalidateMs: 1000,
  });

  const socket = createSocket({ auth: { token: 'valid.jwt.token' } });
  assert.equal(await runMiddleware(dashboard.middleware, socket), undefined);
  dashboard.connectionHandler(socket);
  await waitForAsyncHandlers();
  assert.equal(socket.disconnected, false);

  currentUser = user({ session_version: 5 });
  revalidate();
  await waitForAsyncHandlers();
  assert.equal(socket.disconnected, true);
});

test('admin status events are sanitized and never expose a raw QR value', async () => {
  const dashboard = createNamespace();
  const io = { of: () => dashboard };
  const helpers = setupSocketEvents(io, {
    prismaClient: {
      pengguna: {
        findUnique: async () => user({ peran: 'IT', id_unit: null }),
      },
    },
    verifyTokenFn: () => jwtPayload(),
    getWhatsAppStatus: () => ({
      state: 'connecting',
      pairingRequired: true,
      qr: 'raw-secret-qr',
      retryDelayMs: 5000,
    }),
    getNotificationQueueStats: async () => ({ pending: 2, retry: 1, staleLocks: 1 }),
  });

  const socket = createSocket({ auth: { token: 'valid.jwt.token' } });
  assert.equal(await runMiddleware(dashboard.middleware, socket), undefined);
  dashboard.connectionHandler(socket);
  await waitForAsyncHandlers();

  assert.deepEqual(socket.joinedRooms, ['user:1', 'admin']);
  const initialStatus = socket.emitted.find(({ event }) => event === 'wa:status');
  assert.deepEqual(initialStatus.payload, {
    state: 'connecting',
    pairingRequired: true,
  });
  assert.equal('qr' in initialStatus.payload, false);

  helpers.emitWAStatus({ state: 'connected', pairingRequired: false, qr: 'another-secret' });
  helpers.emitPairingRequired();
  assert.equal(helpers.disconnectUserSessions(1), true);
  assert.deepEqual(dashboard.disconnectedRooms, [{ room: 'user:1', close: true }]);
  for (const emitted of dashboard.roomEvents) {
    assert.equal(emitted.room, 'admin');
    assert.equal('qr' in emitted.payload, false);
  }
});

test('unknown transport fields are reduced to the public status contract', () => {
  assert.deepEqual(
    sanitizeWhatsAppStatus({ state: 'unexpected', pairingRequired: 1, qr: 'secret' }),
    { state: 'disabled', pairingRequired: true }
  );
});
