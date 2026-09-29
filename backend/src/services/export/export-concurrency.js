const DEFAULT_MAX_CONCURRENCY = 2;
const DEFAULT_MAX_QUEUE = 10;
const DEFAULT_QUEUE_TIMEOUT_MS = 30_000;

const ERROR_DEFINITIONS = {
  EXPORT_QUEUE_FULL: 'Antrean ekspor penuh. Silakan coba lagi nanti.',
  EXPORT_QUEUE_TIMEOUT: 'Waktu tunggu ekspor habis. Silakan coba lagi.',
  EXPORT_SERVICE_CLOSED: 'Layanan ekspor sedang dihentikan. Silakan coba lagi nanti.',
  EXPORT_REQUEST_ABORTED: 'Permintaan ekspor dibatalkan.',
};

class ExportConcurrencyError extends Error {
  constructor(code, statusCode = 503) {
    super(ERROR_DEFINITIONS[code] || 'Layanan ekspor tidak tersedia.');
    this.name = 'ExportConcurrencyError';
    this.code = code;
    this.statusCode = statusCode;
    this.expose = code !== 'EXPORT_REQUEST_ABORTED';
  }
}

const validateLimit = (name, value, { allowZero = false } = {}) => {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} harus berupa bilangan bulat >= ${minimum}`);
  }
  return value;
};

const readIntegerEnv = (name, fallback, options = {}) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') return fallback;
  if (!/^\d+$/.test(rawValue)) {
    throw new TypeError(`${name} harus berupa bilangan bulat`);
  }
  return validateLimit(name, Number(rawValue), options);
};

class ExportSemaphore {
  constructor({
    maxConcurrency = DEFAULT_MAX_CONCURRENCY,
    maxQueue = DEFAULT_MAX_QUEUE,
    queueTimeoutMs = DEFAULT_QUEUE_TIMEOUT_MS,
  } = {}) {
    this.maxConcurrency = validateLimit('maxConcurrency', maxConcurrency);
    this.maxQueue = validateLimit('maxQueue', maxQueue, { allowZero: true });
    this.queueTimeoutMs = validateLimit('queueTimeoutMs', queueTimeoutMs);
    this.active = 0;
    this.queue = [];
    this.closed = false;
    this.idleWaiters = [];
  }

  get stats() {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueue: this.maxQueue,
      closed: this.closed,
    };
  }

  acquire({ signal } = {}) {
    if (this.closed) {
      return Promise.reject(new ExportConcurrencyError('EXPORT_SERVICE_CLOSED'));
    }
    if (signal?.aborted) {
      return Promise.reject(new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499));
    }
    if (this.active < this.maxConcurrency) {
      this.active += 1;
      return Promise.resolve(this.#createRelease());
    }
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new ExportConcurrencyError('EXPORT_QUEUE_FULL'));
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        signal,
        onAbort: null,
        timer: null,
        settled: false,
      };

      waiter.timer = setTimeout(() => {
        this.#rejectWaiter(waiter, new ExportConcurrencyError('EXPORT_QUEUE_TIMEOUT'));
      }, this.queueTimeoutMs);

      if (signal) {
        waiter.onAbort = () => {
          this.#rejectWaiter(waiter, new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499));
        };
        signal.addEventListener('abort', waiter.onAbort, { once: true });
      }

      this.queue.push(waiter);
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    const queued = [...this.queue];
    queued.forEach((waiter) => {
      this.#rejectWaiter(waiter, new ExportConcurrencyError('EXPORT_SERVICE_CLOSED'));
    });
    this.#notifyIdle();
  }

  onIdle() {
    if (this.active === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  #createRelease() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#release();
    };
  }

  #release() {
    while (this.queue.length > 0) {
      const waiter = this.queue.shift();
      if (waiter.settled) continue;
      waiter.settled = true;
      this.#cleanupWaiter(waiter);
      waiter.resolve(this.#createRelease());
      return;
    }

    this.active = Math.max(0, this.active - 1);
    this.#notifyIdle();
  }

  #rejectWaiter(waiter, error) {
    if (waiter.settled) return;
    waiter.settled = true;
    const index = this.queue.indexOf(waiter);
    if (index >= 0) this.queue.splice(index, 1);
    this.#cleanupWaiter(waiter);
    waiter.reject(error);
  }

  #cleanupWaiter(waiter) {
    if (waiter.timer) clearTimeout(waiter.timer);
    if (waiter.signal && waiter.onAbort) {
      waiter.signal.removeEventListener('abort', waiter.onAbort);
    }
  }

  #notifyIdle() {
    if (this.active !== 0) return;
    const waiters = this.idleWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }
}

const createExportSemaphoreFromEnv = () => new ExportSemaphore({
  maxConcurrency: readIntegerEnv('EXPORT_MAX_CONCURRENCY', DEFAULT_MAX_CONCURRENCY),
  maxQueue: readIntegerEnv('EXPORT_MAX_QUEUE', DEFAULT_MAX_QUEUE, { allowZero: true }),
  queueTimeoutMs: readIntegerEnv('EXPORT_QUEUE_TIMEOUT_MS', DEFAULT_QUEUE_TIMEOUT_MS),
});

const exportSemaphore = createExportSemaphoreFromEnv();

module.exports = {
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_MAX_QUEUE,
  DEFAULT_QUEUE_TIMEOUT_MS,
  ExportConcurrencyError,
  ExportSemaphore,
  readIntegerEnv,
  createExportSemaphoreFromEnv,
  exportSemaphore,
};
