'use strict';

const {
  WhatsAppInvalidPhoneError,
  normalizeIndonesianPhone,
} = require('../whatsapp/baileys.service');

const REVIEWER_ROLES = new Set(['ADMIN_GLOBAL', 'IT']);
const REVIEW_DECISIONS = new Set(['DISETUJUI', 'REVISI', 'DITOLAK']);

class LaporanAccessError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'LaporanAccessError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function fail(message, statusCode, code) {
  throw new LaporanAccessError(message, statusCode, code);
}

function assertLaporanExists(laporan) {
  if (!laporan) fail('Laporan tidak ditemukan', 404, 'LAPORAN_NOT_FOUND');
  return laporan;
}

function isReviewer(pengguna) {
  return REVIEWER_ROLES.has(pengguna?.peran);
}

function assertCanReadLaporan(pengguna, laporan) {
  assertLaporanExists(laporan);

  if (pengguna?.peran === 'USER_UNIT') {
    if (laporan.id_unit !== pengguna.id_unit) {
      fail('Akses laporan ditolak', 403, 'LAPORAN_UNIT_FORBIDDEN');
    }
    return laporan;
  }

  if (!isReviewer(pengguna)) {
    fail('Akses laporan ditolak', 403, 'LAPORAN_ROLE_FORBIDDEN');
  }
  return laporan;
}

function assertCanCreateLaporan(pengguna, idUnit) {
  if (pengguna?.peran !== 'USER_UNIT') {
    fail('Hanya user unit yang dapat membuat laporan', 403, 'LAPORAN_CREATE_FORBIDDEN');
  }
  if (idUnit !== pengguna.id_unit) {
    fail('Laporan hanya dapat dibuat untuk unit sendiri', 403, 'LAPORAN_UNIT_FORBIDDEN');
  }
}

function assertUserUnitScope(pengguna, laporan, action) {
  assertLaporanExists(laporan);
  if (pengguna?.peran !== 'USER_UNIT') {
    fail(`Hanya user unit yang dapat ${action}`, 403, 'LAPORAN_MUTATION_FORBIDDEN');
  }
  if (laporan.id_unit !== pengguna.id_unit) {
    fail('Laporan hanya dapat diubah oleh unit pemilik', 403, 'LAPORAN_UNIT_FORBIDDEN');
  }
}

function assertCanMutateDraft(pengguna, laporan) {
  assertUserUnitScope(pengguna, laporan, 'mengubah laporan');
  if (laporan.status !== 'DRAFT') {
    fail('Laporan hanya dapat diubah saat berstatus DRAFT', 409, 'LAPORAN_NOT_DRAFT');
  }
  return laporan;
}

function assertCanSubmitDraft(pengguna, laporan, nextStatus) {
  assertCanMutateDraft(pengguna, laporan);
  if (nextStatus !== 'DIAJUKAN') {
    fail('Transisi yang diizinkan hanya DRAFT ke DIAJUKAN', 409, 'LAPORAN_INVALID_SUBMISSION');
  }
  return laporan;
}

function assertCanReviewLaporan(pengguna, laporan, decision) {
  assertLaporanExists(laporan);
  if (!isReviewer(pengguna)) {
    fail('Hanya ADMIN_GLOBAL atau IT yang dapat mereview laporan', 403, 'LAPORAN_REVIEW_FORBIDDEN');
  }
  if (laporan.status !== 'DIAJUKAN') {
    fail('Hanya laporan DIAJUKAN yang dapat direview', 409, 'LAPORAN_NOT_SUBMITTED');
  }
  if (!REVIEW_DECISIONS.has(decision)) {
    fail('Keputusan review tidak valid', 409, 'LAPORAN_INVALID_REVIEW_DECISION');
  }
  return laporan;
}

function assertCanDeleteLaporan(pengguna, laporan) {
  return assertCanMutateDraft(pengguna, laporan);
}

function assertCanResubmitLaporan(pengguna, laporan) {
  assertUserUnitScope(pengguna, laporan, 'mengajukan ulang laporan');
  if (laporan.status !== 'REVISI') {
    fail('Laporan tidak dalam status REVISI', 409, 'LAPORAN_NOT_IN_REVISION');
  }
  return laporan;
}

function assertCanUnlockLaporan(pengguna, laporan) {
  assertLaporanExists(laporan);
  if (pengguna?.peran !== 'USER_UNIT') {
    fail('Hanya user unit pemilik laporan yang dapat membuka laporan', 403, 'LAPORAN_UNLOCK_FORBIDDEN');
  }
  if (
    laporan.id_pengguna !== pengguna.id_pengguna ||
    laporan.id_unit !== pengguna.id_unit
  ) {
    fail('Hanya pemilik laporan yang dapat membuka laporan', 403, 'LAPORAN_OWNER_FORBIDDEN');
  }
  if (laporan.status !== 'DISETUJUI') {
    fail('Laporan tidak dalam status DISETUJUI', 409, 'LAPORAN_NOT_APPROVED');
  }
  return laporan;
}

function assertChildBelongsToLaporan(child, idLaporan, label = 'Data sub-laporan') {
  if (!child || child.id_laporan !== idLaporan) {
    fail(`${label} tidak ditemukan pada laporan ini`, 404, 'LAPORAN_CHILD_NOT_FOUND');
  }
  return child;
}

function normalizeValidPhone(phone) {
  if (typeof phone !== 'string' || phone.trim() === '') return null;
  try {
    return normalizeIndonesianPhone(phone);
  } catch (error) {
    if (error instanceof WhatsAppInvalidPhoneError) return null;
    throw error;
  }
}

module.exports = {
  REVIEW_DECISIONS,
  LaporanAccessError,
  isReviewer,
  assertLaporanExists,
  assertCanReadLaporan,
  assertCanCreateLaporan,
  assertCanMutateDraft,
  assertCanSubmitDraft,
  assertCanReviewLaporan,
  assertCanDeleteLaporan,
  assertCanResubmitLaporan,
  assertCanUnlockLaporan,
  assertChildBelongsToLaporan,
  normalizeValidPhone,
};
