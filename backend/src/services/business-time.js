'use strict';

const BUSINESS_TIME_ZONE = 'Asia/Jakarta';
const BUSINESS_LOCALE = 'id-ID';
const JAKARTA_UTC_OFFSET_MINUTES = 7 * 60;
const JAKARTA_UTC_OFFSET_MS = JAKARTA_UTC_OFFSET_MINUTES * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function assertValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new TypeError('Business date parts must be integers');
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    throw new RangeError('Invalid business date');
  }

  return { year, month, day };
}

function parseDateOnly(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  return assertValidDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

function toUnambiguousInstant(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new RangeError('Invalid date');
    return new Date(value.getTime());
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new RangeError('Invalid timestamp');
    return date;
  }

  if (typeof value === 'string') {
    if (!EXPLICIT_OFFSET_PATTERN.test(value)) {
      throw new TypeError('Timestamp strings must include Z or an explicit UTC offset');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new RangeError('Invalid timestamp');
    return date;
  }

  throw new TypeError('Expected a Date, timestamp, ISO timestamp, or YYYY-MM-DD');
}

function getJakartaDateParts(value = new Date()) {
  const dateOnly = parseDateOnly(value);
  if (dateOnly) return dateOnly;

  const instant = toUnambiguousInstant(value);
  const jakartaWallClock = new Date(instant.getTime() + JAKARTA_UTC_OFFSET_MS);
  return {
    year: jakartaWallClock.getUTCFullYear(),
    month: jakartaWallClock.getUTCMonth() + 1,
    day: jakartaWallClock.getUTCDate(),
  };
}

function getBusinessDate(value = new Date()) {
  const { year, month, day } = getJakartaDateParts(value);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function startOfBusinessDayUtc(value = new Date()) {
  const { year, month, day } = getJakartaDateParts(value);
  return new Date(Date.UTC(year, month - 1, day) - JAKARTA_UTC_OFFSET_MS);
}

function getBusinessMonthRangeUtc(valueOrYear = new Date(), requestedMonth) {
  let year;
  let month;

  if (Number.isInteger(valueOrYear)) {
    year = valueOrYear;
    month = requestedMonth;
    assertValidDateParts(year, month, 1);
  } else {
    ({ year, month } = getJakartaDateParts(valueOrYear));
  }

  const start = new Date(Date.UTC(year, month - 1, 1) - JAKARTA_UTC_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, 1) - JAKARTA_UTC_OFFSET_MS);
  return { start, end };
}

function formatBusinessDate(value = new Date(), options = {}) {
  let locale = BUSINESS_LOCALE;
  let formatOptions = options;

  if (typeof options === 'string') {
    locale = options;
    formatOptions = {};
  } else if (options && typeof options === 'object') {
    ({ locale = BUSINESS_LOCALE, ...formatOptions } = options);
  } else {
    throw new TypeError('Formatting options must be an object or locale string');
  }

  const instant = parseDateOnly(value) ? startOfBusinessDayUtc(value) : toUnambiguousInstant(value);
  const defaults = { day: '2-digit', month: '2-digit', year: 'numeric' };

  return new Intl.DateTimeFormat(locale, {
    ...(Object.keys(formatOptions).length === 0 ? defaults : formatOptions),
    timeZone: BUSINESS_TIME_ZONE,
  }).format(instant);
}

function differenceInBusinessDays(from, to) {
  const fromParts = getJakartaDateParts(from);
  const toParts = getJakartaDateParts(to);
  const fromDay = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toDay = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  return Math.round((toDay - fromDay) / DAY_MS);
}

module.exports = {
  BUSINESS_TIME_ZONE,
  BUSINESS_LOCALE,
  JAKARTA_UTC_OFFSET_MINUTES,
  getJakartaDateParts,
  getBusinessDate,
  getJakartaBusinessDate: getBusinessDate,
  startOfBusinessDayUtc,
  getJakartaStartOfDayUtc: startOfBusinessDayUtc,
  getBusinessMonthRangeUtc,
  getJakartaMonthBoundsUtc: getBusinessMonthRangeUtc,
  formatBusinessDate,
  formatJakartaDate: formatBusinessDate,
  differenceInBusinessDays,
  differenceInJakartaDays: differenceInBusinessDays,
};
