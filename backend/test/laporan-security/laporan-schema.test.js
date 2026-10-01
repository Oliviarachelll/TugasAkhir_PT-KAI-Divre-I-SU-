'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createLaporanSchema,
  updateLaporanSchema,
  laporanListQuerySchema,
  laporanIdParamsSchema,
  laporanItemParamsSchema,
  resubmitLaporanSchema,
  unlockLaporanSchema,
} = require('../../src/schemas/laporan.schema');

test('report dates accept only real YYYY-MM-DD calendar values', () => {
  const parsed = createLaporanSchema.parse({
    tanggal: '2026-09-30',
    id_unit: '3',
    kotak_detail: null,
  });
  assert.equal(parsed.tanggal.toISOString(), '2026-09-30T00:00:00.000Z');
  assert.equal(parsed.id_unit, 3);

  for (const tanggal of [
    '2026-09-30T00:00:00.000Z',
    '2026/09/30',
    '2026-02-30',
    '2026-13-01',
  ]) {
    assert.equal(createLaporanSchema.safeParse({ tanggal, id_unit: 3 }).success, false);
  }
});

test('URL and query IDs reject partial, zero, signed, and padded values', () => {
  assert.deepEqual(laporanIdParamsSchema.parse({ id: '42' }), { id: 42 });
  assert.deepEqual(
    laporanItemParamsSchema.parse({ id: '42', itemId: '9' }),
    { id: 42, itemId: 9 }
  );

  for (const id of ['1abc', '0', '-1', '+1', '01', ' 1', '1.5']) {
    assert.equal(laporanIdParamsSchema.safeParse({ id }).success, false);
  }

  assert.deepEqual(
    laporanListQuerySchema.parse({ id_unit: '3', tahun: '2026', bulan: '9', page: '2' }),
    { id_unit: 3, tahun: 2026, bulan: 9, page: 2 }
  );
  assert.equal(laporanListQuerySchema.safeParse({ id_unit: '3x' }).success, false);
});

test('update schema allows only explicit workflow statuses and known fields', () => {
  assert.equal(updateLaporanSchema.safeParse({ status: 'DIAJUKAN' }).success, true);
  assert.equal(updateLaporanSchema.safeParse({ status: 'DISETUJUI', kotak_detail: 'Sesuai' }).success, true);
  assert.equal(updateLaporanSchema.safeParse({ status: 'DRAFT' }).success, false);
  assert.equal(updateLaporanSchema.safeParse({}).success, false);
  assert.equal(updateLaporanSchema.safeParse({ id_unit: 3 }).success, false);
  assert.equal(updateLaporanSchema.safeParse({ status: 'DISETUJUI', laporan_kna: {} }).success, false);
});

test('resubmit uses date-only input and unlock accepts exactly 16 token characters', () => {
  assert.equal(resubmitLaporanSchema.safeParse({ tanggal: '2026-09-30' }).success, true);
  assert.equal(
    resubmitLaporanSchema.safeParse({ tanggal: '2026-09-30T00:00:00.000Z' }).success,
    false
  );

  assert.equal(
    unlockLaporanSchema.safeParse({ token: '0123-4567-89AB-CDEF' }).success,
    true
  );
  for (const token of [
    '0123-4567-89AB-CDE',
    '0123-4567-89ab-cdef',
    '0123-4567-89AO-CDEF',
    '0123_4567_89AB_CDEF',
  ]) {
    assert.equal(unlockLaporanSchema.safeParse({ token }).success, false);
  }
});
