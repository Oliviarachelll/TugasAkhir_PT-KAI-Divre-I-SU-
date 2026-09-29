const { Prisma } = require('@prisma/client');

const REPORT_TIMEZONE = 'Asia/Jakarta';
const REPORT_LOCALE = 'id-ID';
const ExportDecimal = Prisma.Decimal.clone({ precision: 40 });

const toDecimal = (value, fallback = '0') => {
  const createDecimal = (candidate) => {
    let normalized = candidate;
    if (normalized && typeof normalized === 'object' && typeof normalized.plus === 'function') {
      normalized = normalized.toString();
    }
    if (!['string', 'number', 'bigint'].includes(typeof normalized)) {
      throw new TypeError('Nilai bukan angka desimal');
    }
    if (typeof normalized === 'string' && normalized.trim() === '') {
      throw new TypeError('Nilai desimal kosong');
    }
    if (typeof normalized === 'number' && !Number.isFinite(normalized)) {
      throw new TypeError('Nilai desimal tidak terbatas');
    }

    const decimal = new ExportDecimal(normalized);
    if (!decimal.isFinite()) throw new TypeError('Nilai desimal tidak terbatas');
    return decimal;
  };

  try {
    return createDecimal(value === null || value === undefined || value === '' ? fallback : value);
  } catch {
    try {
      return createDecimal(fallback);
    } catch {
      return new ExportDecimal(0);
    }
  }
};

const toNumber = (value, fallback = 0) => {
  const number = toDecimal(value, fallback).toNumber();
  return Number.isFinite(number) ? number : fallback;
};

const dateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const parseDateOnly = (value) => {
  const normalized = dateOnly(value);
  return normalized ? new Date(`${normalized}T00:00:00.000Z`) : null;
};

const formatDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(REPORT_LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(REPORT_LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: REPORT_TIMEZONE,
    timeZoneName: 'short',
  }).format(date);
};

const excelDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const toExcelDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    excelDateTimeFormatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds()
  ));
};

const formatNumber = (value, maximumFractionDigits = 4) => new Intl.NumberFormat(REPORT_LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits,
}).format(toDecimal(value).toString());

const formatCurrency = (value) => new Intl.NumberFormat(REPORT_LOCALE, {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(toDecimal(value).toString());

const safeSpreadsheetText = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const parseJsonArray = (rawValue, label, warnings = []) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') return [];

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    if (!Array.isArray(parsed)) {
      warnings.push(`${label} tidak berbentuk array dan tidak disertakan.`);
      return [];
    }

    const validItems = parsed.filter(isPlainObject);
    const invalidCount = parsed.length - validItems.length;
    if (invalidCount > 0) {
      warnings.push(`${label} memuat ${invalidCount} item tidak valid dan item tersebut tidak disertakan.`);
    }
    return validItems;
  } catch {
    warnings.push(`${label} tidak dapat dibaca karena JSON tidak valid.`);
    return [];
  }
};

module.exports = {
  REPORT_TIMEZONE,
  REPORT_LOCALE,
  ExportDecimal,
  toDecimal,
  toNumber,
  dateOnly,
  parseDateOnly,
  formatDate,
  formatDateTime,
  toExcelDateTime,
  formatNumber,
  formatCurrency,
  safeSpreadsheetText,
  isPlainObject,
  parseJsonArray,
};
