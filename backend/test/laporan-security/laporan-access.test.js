'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LaporanAccessError,
  assertCanReadLaporan,
  assertCanMutateDraft,
  assertCanSubmitDraft,
  assertCanReviewLaporan,
  assertCanUnlockLaporan,
  assertChildBelongsToLaporan,
  normalizeValidPhone,
} = require('../../src/services/laporan-access.service');

const unitUser = {
  id_pengguna: 7,
  id_unit: 3,
  peran: 'USER_UNIT',
};
const admin = {
  id_pengguna: 1,
  id_unit: 1,
  peran: 'ADMIN_GLOBAL',
};
const report = {
  id_laporan: 10,
  id_pengguna: 7,
  id_unit: 3,
  status: 'DRAFT',
};

function hasError(error, statusCode, code) {
  return error instanceof LaporanAccessError &&
    error.statusCode === statusCode &&
    error.code === code;
}

test('USER_UNIT reads only its own unit while reviewers can read globally', () => {
  assert.doesNotThrow(() => assertCanReadLaporan(unitUser, report));
  assert.doesNotThrow(() => assertCanReadLaporan(admin, { ...report, id_unit: 99 }));
  assert.throws(
    () => assertCanReadLaporan(unitUser, { ...report, id_unit: 99 }),
    (error) => hasError(error, 403, 'LAPORAN_UNIT_FORBIDDEN')
  );
});

test('operational writes require an own-unit DRAFT and exact submit transition', () => {
  assert.doesNotThrow(() => assertCanMutateDraft(unitUser, report));
  assert.doesNotThrow(() => assertCanSubmitDraft(unitUser, report, 'DIAJUKAN'));
  assert.throws(
    () => assertCanMutateDraft(admin, report),
    (error) => hasError(error, 403, 'LAPORAN_MUTATION_FORBIDDEN')
  );
  assert.throws(
    () => assertCanMutateDraft(unitUser, { ...report, status: 'DIAJUKAN' }),
    (error) => hasError(error, 409, 'LAPORAN_NOT_DRAFT')
  );
  assert.throws(
    () => assertCanSubmitDraft(unitUser, report, 'DISETUJUI'),
    (error) => hasError(error, 409, 'LAPORAN_INVALID_SUBMISSION')
  );
});

test('reviewers can decide only submitted reports using terminal review states', () => {
  const submitted = { ...report, status: 'DIAJUKAN' };
  for (const decision of ['DISETUJUI', 'REVISI', 'DITOLAK']) {
    assert.doesNotThrow(() => assertCanReviewLaporan(admin, submitted, decision));
  }
  assert.throws(
    () => assertCanReviewLaporan(admin, report, 'DISETUJUI'),
    (error) => hasError(error, 409, 'LAPORAN_NOT_SUBMITTED')
  );
  assert.throws(
    () => assertCanReviewLaporan(admin, submitted, 'DIAJUKAN'),
    (error) => hasError(error, 409, 'LAPORAN_INVALID_REVIEW_DECISION')
  );
  assert.throws(
    () => assertCanReviewLaporan(unitUser, submitted, 'DISETUJUI'),
    (error) => hasError(error, 403, 'LAPORAN_REVIEW_FORBIDDEN')
  );
});

test('unlock requires the exact USER_UNIT report owner and approved state', () => {
  const approved = { ...report, status: 'DISETUJUI' };
  assert.doesNotThrow(() => assertCanUnlockLaporan(unitUser, approved));
  assert.throws(
    () => assertCanUnlockLaporan({ ...unitUser, id_pengguna: 8 }, approved),
    (error) => hasError(error, 403, 'LAPORAN_OWNER_FORBIDDEN')
  );
  assert.throws(
    () => assertCanUnlockLaporan(admin, approved),
    (error) => hasError(error, 403, 'LAPORAN_UNLOCK_FORBIDDEN')
  );
  assert.throws(
    () => assertCanUnlockLaporan(unitUser, { ...approved, status: 'REVISI' }),
    (error) => hasError(error, 409, 'LAPORAN_NOT_APPROVED')
  );
});

test('child ownership and phone validation fail closed', () => {
  assert.equal(
    assertChildBelongsToLaporan({ id_laporan: 10 }, 10, 'Item').id_laporan,
    10
  );
  assert.throws(
    () => assertChildBelongsToLaporan({ id_laporan: 11 }, 10, 'Item'),
    (error) => hasError(error, 404, 'LAPORAN_CHILD_NOT_FOUND')
  );
  assert.equal(normalizeValidPhone('0812-3456-7890'), '6281234567890');
  assert.equal(normalizeValidPhone('0812.invalid'), null);
  assert.equal(normalizeValidPhone(null), null);
});
