'use strict';

const path = require('path');
const EventEmitter = require('events');
const pino = require('pino');

const silentBaileysLogger = pino({ level: 'silent' });

const CONNECTION_STATES = Object.freeze({
  DISABLED: 'disabled',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  BACKOFF: 'backoff',
  LOGGED_OUT: 'logged_out',
  STOPPING: 'stopping',
});

const ERROR_CODES = Object.freeze({
  DISABLED: 'WA_DISABLED',
  DISCONNECTED: 'WA_DISCONNECTED',
  INVALID_PHONE: 'WA_INVALID_PHONE',
  SEND_FAILED: 'WA_SEND_FAILED',
  CONNECTION_FAILED: 'WA_CONNECTION_FAILED',
});

function envFlag(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function positiveInteger(value, fallback, minimum = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function parseWhatsAppWebVersion(value) {
  const parts = Array.isArray(value)
    ? value
    : typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value.trim())
      ? value.trim().split('.')
      : null;
  if (!parts || parts.length !== 3) return null;

  const version = parts.map((part) => Number(part));
  if (version.some((part) => !Number.isSafeInteger(part) || part < 0)) return null;
  return version;
}

function withTimeout(operation, timeoutMs) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error('WhatsApp Web version lookup timed out');
      error.code = 'WA_VERSION_LOOKUP_TIMEOUT';
      reject(error);
    }, timeoutMs);
    timer.unref?.();
  });

  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

class WhatsAppServiceError extends Error {
  constructor(message, { code, retryable = false, cause } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || 'WA_ERROR';
    this.retryable = Boolean(retryable);
    if (cause !== undefined) this.cause = cause;
  }
}

class WhatsAppDisabledError extends WhatsAppServiceError {
  constructor() {
    super('WhatsApp service is disabled', { code: ERROR_CODES.DISABLED, retryable: false });
  }
}

class WhatsAppDisconnectedError extends WhatsAppServiceError {
  constructor(state) {
    super('WhatsApp service is not connected', {
      code: ERROR_CODES.DISCONNECTED,
      retryable: true,
    });
    this.connectionState = state;
  }
}

class WhatsAppInvalidPhoneError extends WhatsAppServiceError {
  constructor() {
    super('Invalid Indonesian phone number', {
      code: ERROR_CODES.INVALID_PHONE,
      retryable: false,
    });
  }
}

class WhatsAppSendError extends WhatsAppServiceError {
  constructor({ retryable = true, cause } = {}) {
    super('WhatsApp provider rejected the send operation', {
      code: ERROR_CODES.SEND_FAILED,
      retryable,
      cause,
    });
  }
}

class WhatsAppConnectionError extends WhatsAppServiceError {
  constructor(cause) {
    super('Unable to initialize the WhatsApp transport', {
      code: ERROR_CODES.CONNECTION_FAILED,
      retryable: true,
      cause,
    });
  }
}

/**
 * Normalize common human formatting while rejecting arbitrary punctuation,
 * letters, non-Indonesian prefixes, and unsafe numeric input.
 */
function normalizeIndonesianPhone(phone) {
  if (typeof phone !== 'string') throw new WhatsAppInvalidPhoneError();

  const input = phone.trim();
  if (input.length === 0 || input.length > 40 || !/^\+?[0-9 ()-]+$/.test(input)) {
    throw new WhatsAppInvalidPhoneError();
  }

  if (input.includes('+') && !input.startsWith('+')) {
    throw new WhatsAppInvalidPhoneError();
  }

  let compact = input.replace(/[ ()-]/g, '');
  if (compact.startsWith('+')) {
    if (!compact.startsWith('+62')) throw new WhatsAppInvalidPhoneError();
    compact = compact.slice(1);
  } else if (compact.startsWith('0')) {
    compact = `62${compact.slice(1)}`;
  } else if (!compact.startsWith('62')) {
    throw new WhatsAppInvalidPhoneError();
  }

  // Canonical Indonesian E.164-like form: country code 62, a non-zero area or
  // network digit, and 10-15 digits in total.
  if (!/^62[1-9]\d{7,12}$/.test(compact)) {
    throw new WhatsAppInvalidPhoneError();
  }

  return compact;
}

function isValidIndonesianPhone(phone) {
  try {
    normalizeIndonesianPhone(phone);
    return true;
  } catch (error) {
    if (error instanceof WhatsAppInvalidPhoneError) return false;
    throw error;
  }
}

let baileysModulePromise;

async function defaultBaileysLoader() {
  if (!baileysModulePromise) {
    baileysModulePromise = import('@whiskeysockets/baileys').catch((error) => {
      baileysModulePromise = undefined;
      throw error;
    });
  }
  return baileysModulePromise;
}

function resolveBaileysModule(moduleValue) {
  const candidate = moduleValue || {};
  const defaultExport = candidate.default;
  const makeWASocket =
    candidate.makeWASocket ||
    (typeof defaultExport === 'function' ? defaultExport : defaultExport?.makeWASocket);
  const useMultiFileAuthState =
    candidate.useMultiFileAuthState || defaultExport?.useMultiFileAuthState;
  const DisconnectReason = candidate.DisconnectReason || defaultExport?.DisconnectReason || {};
  const Browsers = candidate.Browsers || defaultExport?.Browsers;
  const fetchLatestBaileysVersion =
    candidate.fetchLatestBaileysVersion || defaultExport?.fetchLatestBaileysVersion;

  if (typeof makeWASocket !== 'function' || typeof useMultiFileAuthState !== 'function') {
    throw new WhatsAppConnectionError();
  }

  return {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion,
  };
}

function extractDisconnectCode(error) {
  const candidates = [
    error?.output?.statusCode,
    error?.statusCode,
    error?.data?.statusCode,
    error?.cause?.output?.statusCode,
    error?.cause?.statusCode,
  ];
  return candidates.find((value) => value !== undefined && value !== null) ?? null;
}

function terminalDisconnectReason(code, disconnectReason = {}) {
  const reasons = [
    ['loggedOut', disconnectReason.loggedOut],
    ['badSession', disconnectReason.badSession],
    ['connectionReplaced', disconnectReason.connectionReplaced],
  ];

  for (const [name, value] of reasons) {
    if (value !== undefined && value !== null && String(value) === String(code)) return name;
  }

  if (['loggedOut', 'badSession', 'connectionReplaced'].includes(code)) return code;
  return null;
}

class WhatsAppService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.enabled =
      options.enabled === undefined ? envFlag('ENABLE_WHATSAPP', false) : Boolean(options.enabled);
    this.sessionPath = options.sessionPath || process.env.WA_SESSION_PATH || './whatsapp-session';
    this.state = this.enabled ? CONNECTION_STATES.BACKOFF : CONNECTION_STATES.DISABLED;
    this.sock = null;
    this.isConnected = false;
    this._ready = false;

    this._loader = options.baileysLoader || defaultBaileysLoader;
    this._baileysLogger = options.baileysLogger || silentBaileysLogger;
    this._configuredWebVersion = options.webVersion ?? process.env.WA_WEB_VERSION;
    this._versionLookupTimeoutMs = positiveInteger(
      options.versionLookupTimeoutMs ?? process.env.WA_VERSION_LOOKUP_TIMEOUT_MS,
      5000,
      1000
    );
    this._random = options.random || Math.random;
    this._setTimeout = options.setTimeout || setTimeout;
    this._clearTimeout = options.clearTimeout || clearTimeout;
    this._logger = options.logger || console;
    this._showQrInTerminal =
      options.showQrInTerminal === undefined
        ? envFlag('WA_SHOW_QR_IN_TERMINAL', false)
        : Boolean(options.showQrInTerminal);
    this._emitRawQr =
      options.emitRawQr === undefined
        ? envFlag('WA_EMIT_RAW_QR', false)
        : Boolean(options.emitRawQr);
    this._webQrEnabled =
      options.webQrEnabled === undefined
        ? envFlag('WA_WEB_QR_ENABLED', false)
        : Boolean(options.webQrEnabled);
    this._webQrTtlMs = Math.min(
      120000,
      positiveInteger(options.webQrTtlMs ?? process.env.WA_WEB_QR_TTL_MS, 60000, 10000)
    );
    this._backoffBaseMs = positiveInteger(
      options.backoffBaseMs ?? process.env.WA_RECONNECT_BASE_MS,
      1000
    );
    this._backoffMaxMs = Math.max(
      this._backoffBaseMs,
      positiveInteger(options.backoffMaxMs ?? process.env.WA_RECONNECT_MAX_MS, 30000)
    );

    this._baileys = null;
    this._webVersion = null;
    this._webVersionSource = 'bundled';
    this._webVersionResolved = false;
    this._webVersionPromise = null;
    this._connectPromise = null;
    this._retryTimer = null;
    this._retryAttempt = 0;
    this._retryDelayMs = null;
    this._generation = 0;
    this._closedGeneration = null;
    this._stopRequested = false;
    this._pairingRequired = false;
    this._pairingQr = null;
    this._pairingQrExpiresAt = null;
    this._pairingQrTimer = null;
    this._terminalReason = null;
  }

  static normalizeIndonesianPhone(phone) {
    return normalizeIndonesianPhone(phone);
  }

  static isValidIndonesianPhone(phone) {
    return isValidIndonesianPhone(phone);
  }

  static formatNomor62(phone) {
    return normalizeIndonesianPhone(phone);
  }

  getStatus() {
    const pairingQrAvailable = this.getPairingQr() !== null;
    return {
      state: this.state,
      connected: this.state === CONNECTION_STATES.CONNECTED && this.isConnected && this._ready,
      enabled: this.enabled,
      queued: 0,
      retryAttempt: this._retryAttempt,
      retryScheduled: this._retryTimer !== null,
      retryDelayMs: this._retryDelayMs,
      pairingRequired: this._pairingRequired,
      webPairingEnabled: this._webQrEnabled,
      pairingQrAvailable,
      terminalReason: this._terminalReason,
    };
  }

  getPairingQr() {
    if (!this._webQrEnabled || typeof this._pairingQr !== 'string') return null;
    if (!Number.isFinite(this._pairingQrExpiresAt) || this._pairingQrExpiresAt <= Date.now()) {
      this._clearPairingQr();
      return null;
    }
    return {
      value: this._pairingQr,
      expiresAt: new Date(this._pairingQrExpiresAt),
    };
  }

  _setPairingQr(value) {
    this._clearPairingQr();
    this._pairingQr = value;
    this._pairingQrExpiresAt = Date.now() + this._webQrTtlMs;
    this._pairingQrTimer = this._setTimeout(() => {
      this._pairingQrTimer = null;
      this._pairingQr = null;
      this._pairingQrExpiresAt = null;
    }, this._webQrTtlMs);
    this._pairingQrTimer?.unref?.();
  }

  _clearPairingQr() {
    if (this._pairingQrTimer !== null) {
      this._clearTimeout(this._pairingQrTimer);
      this._pairingQrTimer = null;
    }
    this._pairingQr = null;
    this._pairingQrExpiresAt = null;
  }

  _transition(nextState) {
    this.state = nextState;
    this.isConnected = nextState === CONNECTION_STATES.CONNECTED;
    this._ready = this.isConnected;
    this.emit('state', this.getStatus());
  }

  _clearRetryTimer() {
    if (this._retryTimer !== null) {
      this._clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    this._retryDelayMs = null;
  }

  _calculateBackoffDelay() {
    const exponent = Math.min(this._retryAttempt, 20);
    const ceiling = Math.min(this._backoffMaxMs, this._backoffBaseMs * 2 ** exponent);
    const randomValue = Math.min(1, Math.max(0, Number(this._random())) || 0);
    return Math.max(1, Math.floor(ceiling * (0.5 + randomValue * 0.5)));
  }

  _scheduleReconnect() {
    if (
      !this.enabled ||
      this._stopRequested ||
      this.state === CONNECTION_STATES.LOGGED_OUT ||
      this._retryTimer !== null
    ) {
      return;
    }

    const delayMs = this._calculateBackoffDelay();
    this._retryAttempt += 1;
    this._retryDelayMs = delayMs;
    this._transition(CONNECTION_STATES.BACKOFF);

    this._retryTimer = this._setTimeout(() => {
      this._retryTimer = null;
      this._retryDelayMs = null;
      this.connect().catch(() => {
        this._log('warn', '[WA] Reconnect attempt failed; another retry is scheduled.');
      });
    }, delayMs);
    this._retryTimer?.unref?.();
  }

  _log(level, message) {
    const writer = this._logger?.[level];
    if (typeof writer === 'function') writer.call(this._logger, message);
  }

  connect() {
    if (!this.enabled) {
      this._transition(CONNECTION_STATES.DISABLED);
      this.emit('unavailable');
      return Promise.resolve(this.getStatus());
    }

    if (
      (this.state === CONNECTION_STATES.CONNECTED ||
        this.state === CONNECTION_STATES.CONNECTING) &&
      this.sock
    ) {
      return Promise.resolve(this.getStatus());
    }

    if (this._connectPromise) return this._connectPromise;

    this._stopRequested = false;
    this._terminalReason = null;
    this._pairingRequired = false;
    this._clearPairingQr();
    this._clearRetryTimer();
    const generation = ++this._generation;
    this._closedGeneration = null;
    this._transition(CONNECTION_STATES.CONNECTING);

    const operation = this._connectGeneration(generation).catch((error) => {
      const wrapped =
        error instanceof WhatsAppServiceError ? error : new WhatsAppConnectionError(error);
      if (generation === this._generation && !this._stopRequested) {
        this.emit('connection-failed', wrapped);
        this._scheduleReconnect();
      }
      throw wrapped;
    });

    this._connectPromise = operation;
    const clearPromise = () => {
      if (this._connectPromise === operation) this._connectPromise = null;
    };
    operation.then(clearPromise, clearPromise);
    return operation;
  }

  async _resolveWebVersion(baileys) {
    if (this._webVersionResolved) return this._webVersion;
    if (this._webVersionPromise) return this._webVersionPromise;

    const operation = (async () => {
      const configured = parseWhatsAppWebVersion(this._configuredWebVersion);
      if (configured) {
        this._webVersion = configured;
        this._webVersionSource = 'environment';
      } else {
        if (this._configuredWebVersion !== undefined && this._configuredWebVersion !== '') {
          this._log('warn', '[WA] Ignoring invalid WA_WEB_VERSION; expected three numeric parts.');
        }

        if (typeof baileys.fetchLatestBaileysVersion === 'function') {
          try {
            const result = await withTimeout(
              Promise.resolve(baileys.fetchLatestBaileysVersion()),
              this._versionLookupTimeoutMs
            );
            const fetched = parseWhatsAppWebVersion(result?.version);
            if (fetched && result?.isLatest !== false && !result?.error) {
              this._webVersion = fetched;
              this._webVersionSource = 'maintainer';
            } else {
              this._log('warn', '[WA] Unable to refresh the recommended web version; using bundled defaults.');
            }
          } catch {
            this._log('warn', '[WA] Web version lookup failed; using bundled defaults.');
          }
        }
      }

      this._webVersionResolved = true;
      if (this._webVersion) {
        this._log(
          'info',
          `[WA] Using WhatsApp Web version ${this._webVersion.join('.')} (${this._webVersionSource}).`
        );
      }
      return this._webVersion;
    })();

    this._webVersionPromise = operation;
    try {
      return await operation;
    } finally {
      if (this._webVersionPromise === operation) this._webVersionPromise = null;
    }
  }

  async _connectGeneration(generation) {
    const loadedModule = await this._loader();
    const baileys = resolveBaileysModule(loadedModule);
    if (generation !== this._generation || this._stopRequested) return this.getStatus();

    this._baileys = baileys;
    const webVersion = await this._resolveWebVersion(baileys);
    if (generation !== this._generation || this._stopRequested) return this.getStatus();
    const { state: auth, saveCreds } = await baileys.useMultiFileAuthState(
      path.resolve(this.sessionPath)
    );
    if (generation !== this._generation || this._stopRequested) return this.getStatus();

    const socketOptions = {
      auth,
      logger: this._baileysLogger,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      ...(webVersion ? { version: webVersion } : {}),
    };
    if (baileys.Browsers?.ubuntu) socketOptions.browser = baileys.Browsers.ubuntu('Chrome');

    const socket = baileys.makeWASocket(socketOptions);
    if (generation !== this._generation || this._stopRequested) {
      this._closeTransport(socket);
      return this.getStatus();
    }

    this.sock = socket;
    try {
      if (!socket.ev || typeof socket.ev.on !== 'function') {
        throw new WhatsAppConnectionError();
      }
      socket.ev.on('creds.update', (...args) => {
        if (generation !== this._generation || this._stopRequested) return;
        const persistence =
          typeof saveCreds === 'function' ? saveCreds(...args) : Promise.resolve();
        Promise.resolve(persistence).catch(() => {
          this._log('error', '[WA] Unable to persist updated credentials.');
        });
      });
      socket.ev.on('connection.update', (update) => {
        this._handleConnectionUpdate(generation, socket, update || {});
      });
    } catch (error) {
      if (this.sock === socket) this.sock = null;
      this._closeTransport(socket);
      throw error;
    }

    return this.getStatus();
  }

  _handleConnectionUpdate(generation, socket, update) {
    if (generation !== this._generation || socket !== this.sock || this._stopRequested) return;

    if (update.qr) {
      this._pairingRequired = true;
      if (this._webQrEnabled) this._setPairingQr(update.qr);
      this.emit('pairing-required', { required: true });

      if (this._showQrInTerminal) {
        try {
          const qrcode = require('qrcode-terminal');
          qrcode.generate(update.qr, { small: true });
        } catch (error) {
          this._log('error', '[WA] Unable to render the pairing code in the terminal.');
        }
      }

      if (this._emitRawQr) this.emit('qr', update.qr);
    }

    if (update.connection === 'open') {
      this._clearRetryTimer();
      this._retryAttempt = 0;
      this._pairingRequired = false;
      this._clearPairingQr();
      this._terminalReason = null;
      this._transition(CONNECTION_STATES.CONNECTED);
      this.emit('connected', this.getStatus());
      return;
    }

    if (update.connection === 'close') {
      this._handleConnectionClose(generation, socket, update.lastDisconnect);
    }
  }

  _handleConnectionClose(generation, socket, lastDisconnect) {
    if (
      generation !== this._generation ||
      socket !== this.sock ||
      this._closedGeneration === generation
    ) {
      return;
    }

    this._closedGeneration = generation;
    this.sock = null;
    this.isConnected = false;
    this._ready = false;
    this._clearPairingQr();
    ++this._generation;

    const code = extractDisconnectCode(lastDisconnect?.error);
    const terminalReason = terminalDisconnectReason(code, this._baileys?.DisconnectReason);
    const event = { code, terminal: Boolean(terminalReason), reason: terminalReason };
    this.emit('disconnected', event);

    if (String(code) === '405') {
      this._log(
        'error',
        '[WA] Registration rejected (code 405); verify the Baileys package and WhatsApp Web version.'
      );
    }

    if (terminalReason) {
      this._terminalReason = terminalReason;
      this._clearRetryTimer();
      this._transition(CONNECTION_STATES.LOGGED_OUT);
      this.emit('logged-out', { reason: terminalReason });
      return;
    }

    this._scheduleReconnect();
  }

  _closeTransport(socket) {
    if (!socket) return;
    try {
      if (typeof socket.end === 'function') {
        socket.end(new Error('WhatsApp service transport stopped'));
      } else if (typeof socket.ws?.close === 'function') {
        socket.ws.close();
      }
    } catch (error) {
      this._log('warn', '[WA] Transport close did not complete cleanly.');
    }
  }

  async stop() {
    this._stopRequested = true;
    this._clearRetryTimer();
    ++this._generation;
    this._closedGeneration = null;
    this._transition(CONNECTION_STATES.STOPPING);

    const socket = this.sock;
    this.sock = null;
    this.isConnected = false;
    this._ready = false;
    this._pairingRequired = false;
    this._clearPairingQr();
    this._closeTransport(socket);

    const inFlight = this._connectPromise;
    if (inFlight) {
      try {
        await inFlight;
      } catch (error) {
        // A failing stale connection attempt is already superseded by stop().
      }
    }

    return this.getStatus();
  }

  async sendNow(phone, text) {
    const canonicalPhone = normalizeIndonesianPhone(phone);

    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new WhatsAppSendError({ retryable: false });
    }
    if (!this.enabled) throw new WhatsAppDisabledError();
    if (
      this.state !== CONNECTION_STATES.CONNECTED ||
      !this.sock ||
      !this.isConnected ||
      !this._ready
    ) {
      throw new WhatsAppDisconnectedError(this.state);
    }

    const socket = this.sock;
    try {
      const providerResult = await socket.sendMessage(`${canonicalPhone}@s.whatsapp.net`, {
        text,
      });
      const rawProviderId = providerResult?.key?.id ?? providerResult?.messageId ?? null;
      return {
        state: 'accepted',
        providerMessageId: rawProviderId === null ? null : String(rawProviderId),
      };
    } catch (error) {
      throw new WhatsAppSendError({ retryable: true, cause: error });
    }
  }


}

const whatsappService = new WhatsAppService();

module.exports = whatsappService;
Object.assign(module.exports, {
  whatsappService,
  WhatsAppService,
  BaileysService: WhatsAppService,
  CONNECTION_STATES,
  ERROR_CODES,
  WhatsAppServiceError,
  WhatsAppDisabledError,
  WhatsAppDisconnectedError,
  WhatsAppInvalidPhoneError,
  WhatsAppSendError,
  WhatsAppConnectionError,
  normalizeIndonesianPhone,
  isValidIndonesianPhone,
  extractDisconnectCode,
  parseWhatsAppWebVersion,
});
