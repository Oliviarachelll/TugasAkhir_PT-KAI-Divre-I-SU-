'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BUSINESS_TIME_ZONE,
  getBusinessDate,
  getBusinessMonthRangeUtc,
  startOfBusinessDayUtc,
  formatBusinessDate,
  differenceInBusinessDays,
} = require('../../src/services/business-time');

test('Jakarta business date changes at 17:00 UTC', () => {
  assert.equal(BUSINESS_TIME_ZONE, 'Asia/Jakarta');
  assert.equal(getBusinessDate('2026-01-31T16:59:59.999Z'), '2026-01-31');
  assert.equal(getBusinessDate('2026-01-31T17:00:00.000Z'), '2026-02-01');
});

test('month boundaries are half-open UTC instants for Jakarta', () => {
  const { start, end } = getBusinessMonthRangeUtc(2026, 2);
  assert.equal(start.toISOString(), '2026-01-31T17:00:00.000Z');
  assert.equal(end.toISOString(), '2026-02-28T17:00:00.000Z');

  assert.equal(
    startOfBusinessDayUtc('2026-02-01').toISOString(),
    '2026-01-31T17:00:00.000Z'
  );
});

test('formatting and day differences use Jakarta calendar dates', () => {
  assert.equal(formatBusinessDate('2026-01-31T17:00:00.000Z', 'en-GB'), '01/02/2026');
  assert.equal(
    differenceInBusinessDays('2026-01-31T16:00:00.000Z', '2026-02-02T16:59:59.000Z'),
    2
  );
  assert.equal(
    differenceInBusinessDays('2026-02-02T16:59:59.000Z', '2026-01-31T16:00:00.000Z'),
    -2
  );
});

test('timezone-less timestamp strings are rejected', () => {
  assert.throws(
    () => getBusinessDate('2026-02-01T00:00:00'),
    /explicit UTC offset/
  );
});
