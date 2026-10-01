'use strict';

/**
 * Controller: Laporan
 * CRUD laporan induk + sub-laporan
 */
const prisma = require('../config/database');
const { Prisma } = require('@prisma/client');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { queueReportDecision, queueReportResubmitted } = require('../services/notification.service');
const { formatBusinessDate, getBusinessDate } = require('../services/business-time');
const { hashHumanToken } = require('../utils/security-token');
const {
  LaporanAccessError,
  isReviewer,
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
} = require('../services/laporan-access.service');

const KNA_FIELDS = ['jml_kontrak_row', 'luas_t_row', 'luas_b_row', 'nilai_row', 'target_rkad', 'jml_kontrak_non_row', 'luas_t_non_row', 'luas_b_non_row', 'nilai_non_row'];
const BARANG_FIELDS = ['jml_ka', 'nama_kustom', 'volume', 'volume_kumulatif', 'volume_program', 'volume_pencapaian', 'pendapatan', 'pendapatan_kumulatif', 'pendapatan_program', 'pendapatan_pencapaian', 'id_komoditi'];
const KEUANGAN_FIELDS = ['target_rkad', 'pendapatan', 'pengeluaran', 'rincian_transaksi', 'rincian_spj', 'rincian_invoice'];
const PENUMPANG_FIELDS = ['nama_ka', 'no_ka', 'lintas', 'berangkat', 'kedatangan', 'jml_penumpang', 'pendapatan'];
const LAPORAN_METADATA_FIELDS = ['tanggal', 'status_internal', 'kotak_detail'];
const TOKEN_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const PUBLIC_LAPORAN_SELECT = Object.freeze({
  id_laporan: true,
  tanggal: true,
  status_internal: true,
  status: true,
  kotak_detail: true,
  id_unit: true,
  id_pengguna: true,
  created_at: true,
  updated_at: true,
});

// realisasi_rkad TIDAK lagi diinput/disimpan dari user — dihitung otomatis
// saat baca (lihat attachRealisasiOtomatis) dan diabaikan saat tulis.
const pick = (value, fields) => fields.reduce((result, field) => {
  if (value?.[field] !== undefined) result[field] = value[field];
  return result;
}, {});

const normalizeValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.map(normalizeValue);
  // Decimal Prisma harus dikonversi eksplisit: instansinya memiliki own
  // property `constructor` (function) yang ikut tersalin oleh Object.keys
  // dan membuat kolom JSON gagal terserialisasi.
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (key === 'constructor' || key === '__proto__' || key === 'prototype') return result;
      result[key] = normalizeValue(value[key]);
      return result;
    }, {});
  }
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const snapshotLaporan = (laporan) => normalizeValue({
  tanggal: new Date(laporan.tanggal).toISOString().slice(0, 10),
  kotak_detail: laporan.kotak_detail ?? null,
  kna: laporan.laporan_kna ? pick(laporan.laporan_kna, KNA_FIELDS) : null,
  penumpang: (laporan.laporan_penumpang || []).map(item => pick(item, PENUMPANG_FIELDS)),
  barang: (laporan.laporan_barang || []).map(item => pick(item, BARANG_FIELDS)),
  keuangan: laporan.laporan_keuangan ? pick(laporan.laporan_keuangan, KEUANGAN_FIELDS) : null,
});

const numVal = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber() || 0;
  return Number(value) || 0;
};

/**
 * Realisasi RKAD otomatis: penjumlahan nilai harian unit tersebut sejak
 * 1 Januari tahun berjalan sampai tanggal tiap laporan (yang DITOLAK dikecualikan).
 * KNA menjumlah nilai_row + nilai_non_row, keuangan menjumlah pendapatan.
 * Hasilnya menimpa field realisasi_rkad pada response (kolom DB tidak dipakai lagi).
 */
const attachRealisasiOtomatis = async (rows) => {
  const targets = rows.filter((row) => row.laporan_kna || row.laporan_keuangan);
  if (targets.length === 0) return rows;

  const combos = new Map();
  for (const row of targets) {
    const year = new Date(row.tanggal).getFullYear();
    combos.set(`${row.id_unit}-${year}`, { id_unit: row.id_unit, year });
  }

  const harian = new Map();
  await Promise.all([...combos.entries()].map(async ([key, { id_unit, year }]) => {
    const baseWhere = {
      id_unit,
      tanggal: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      status: { not: 'DITOLAK' },
    };
    const [knaRows, keuanganRows] = await Promise.all([
      prisma.laporan.findMany({
        where: { ...baseWhere, laporan_kna: { isNot: null } },
        select: { tanggal: true, laporan_kna: { select: { nilai_row: true, nilai_non_row: true } } },
      }),
      prisma.laporan.findMany({
        where: { ...baseWhere, laporan_keuangan: { isNot: null } },
        select: { tanggal: true, laporan_keuangan: { select: { pendapatan: true } } },
      }),
    ]);
    harian.set(key, {
      kna: knaRows.map((item) => ({
        t: new Date(item.tanggal).getTime(),
        v: numVal(item.laporan_kna.nilai_row) + numVal(item.laporan_kna.nilai_non_row),
      })),
      keu: keuanganRows.map((item) => ({
        t: new Date(item.tanggal).getTime(),
        v: numVal(item.laporan_keuangan.pendapatan),
      })),
    });
  }));

  for (const row of targets) {
    const year = new Date(row.tanggal).getFullYear();
    const time = new Date(row.tanggal).getTime();
    const data = harian.get(`${row.id_unit}-${year}`);
    if (!data) continue;
    if (row.laporan_kna) {
      row.laporan_kna.realisasi_rkad = data.kna
        .filter((item) => item.t <= time)
        .reduce((sum, item) => sum + item.v, 0);
    }
    if (row.laporan_keuangan) {
      row.laporan_keuangan.realisasi_rkad = data.keu
        .filter((item) => item.t <= time)
        .reduce((sum, item) => sum + item.v, 0);
    }
  }
  return rows;
};

const collectChangedFields = (before, after, path = '') => {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) {
    return [path];
  }
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .flatMap(key => collectChangedFields(before[key], after[key], path ? `${path}.${key}` : key));
};

// Field angka DATA yang wajib berubah minimal 1 saat resubmit revisi.
// target_rkad / realisasi_rkad / rincian_* / tanggal / kotak_detail /
// status_internal / nama_ka / lintas dsb TIDAK dihitung.
const KNA_DATA_FIELDS = ['jml_kontrak_row', 'luas_t_row', 'luas_b_row', 'nilai_row', 'jml_kontrak_non_row', 'luas_t_non_row', 'luas_b_non_row', 'nilai_non_row'];
const BARANG_DATA_FIELDS = ['jml_ka', 'volume', 'pendapatan'];
const PENUMPANG_DATA_FIELDS = ['jml_penumpang', 'pendapatan'];
const KEUANGAN_DATA_FIELDS = ['pendapatan', 'pengeluaran'];

const numEqual = (first, second) => {
  const firstNumber = first === null || first === undefined || first === '' ? 0 : Number(first);
  const secondNumber = second === null || second === undefined || second === '' ? 0 : Number(second);
  if (Number.isNaN(firstNumber) || Number.isNaN(secondNumber)) return firstNumber === secondNumber;
  return Math.abs(firstNumber - secondNumber) < 1e-9;
};

const hasNumericDataChange = (before, after) => {
  const changed = [];
  if (before?.kna || after?.kna) {
    for (const field of KNA_DATA_FIELDS) {
      if (!numEqual(before?.kna?.[field], after?.kna?.[field])) changed.push(`kna.${field}`);
    }
  }
  if (before?.keuangan || after?.keuangan) {
    for (const field of KEUANGAN_DATA_FIELDS) {
      if (!numEqual(before?.keuangan?.[field], after?.keuangan?.[field])) changed.push(`keuangan.${field}`);
    }
  }

  const keyPenumpang = (item) => String(item?.nama_ka || '').toUpperCase();
  const penumpangBefore = new Map();
  for (const item of before?.penumpang || []) penumpangBefore.set(keyPenumpang(item), item);
  const seenPenumpang = new Set();
  for (const item of after?.penumpang || []) {
    const key = keyPenumpang(item);
    seenPenumpang.add(key);
    const previous = penumpangBefore.get(key);
    if (!previous) {
      changed.push(`penumpang.${key || 'baru'}`);
      continue;
    }
    for (const field of PENUMPANG_DATA_FIELDS) {
      if (!numEqual(previous[field], item[field])) changed.push(`penumpang.${key}.${field}`);
    }
  }
  for (const key of penumpangBefore.keys()) {
    if (!seenPenumpang.has(key)) changed.push(`penumpang.${key || 'hapus'}`);
  }

  const keyBarang = (item) => (
    item?.id_komoditi !== undefined && item?.id_komoditi !== null && item?.id_komoditi !== ''
      ? `id:${item.id_komoditi}`
      : `custom:${String(item?.nama_kustom || '').toUpperCase()}`
  );
  const barangBefore = new Map();
  for (const item of before?.barang || []) barangBefore.set(keyBarang(item), item);
  const seenBarang = new Set();
  for (const item of after?.barang || []) {
    const key = keyBarang(item);
    seenBarang.add(key);
    const previous = barangBefore.get(key);
    if (!previous) {
      changed.push(`barang.${key}`);
      continue;
    }
    for (const field of BARANG_DATA_FIELDS) {
      if (!numEqual(previous[field], item[field])) changed.push(`barang.${key}.${field}`);
    }
  }
  for (const key of barangBefore.keys()) {
    if (!seenBarang.has(key)) changed.push(`barang.${key}.hapus`);
  }
  return changed;
};

const stateConflict = (message, code = 'LAPORAN_STATE_CONFLICT') => (
  new LaporanAccessError(message, 409, code)
);

const invalidRecoveryToken = () => (
  new LaporanAccessError(
    'Token revisi tidak valid atau sudah kedaluwarsa',
    400,
    'LAPORAN_INVALID_REVISION_TOKEN'
  )
);

const redactLaporanSecrets = (laporan) => {
  if (!laporan || typeof laporan !== 'object') return laporan;
  if (Array.isArray(laporan)) return laporan.map(redactLaporanSecrets);
  const {
    token_revisi: _tokenRevisi,
    token_revisi_exp: _tokenRevisiExp,
    ...publicLaporan
  } = laporan;
  return publicLaporan;
};

const getSocketEvents = (req) => {
  if (!req.app || typeof req.app.get !== 'function') return null;
  return req.app.get('socketEvents') || null;
};

const emitStatusUpdate = (req, laporan) => {
  const socketEvents = getSocketEvents(req);
  if (typeof socketEvents?.emitStatusLaporanUpdate !== 'function') return;
  try {
    socketEvents.emitStatusLaporanUpdate(redactLaporanSecrets(laporan));
  } catch (error) {
    console.error(`[Socket] Gagal emit status laporan: ${error.message}`);
  }
};

const emitLaporanBaru = (req, laporan) => {
  const socketEvents = getSocketEvents(req);
  if (typeof socketEvents?.emitLaporanBaru !== 'function') return;
  try {
    socketEvents.emitLaporanBaru(redactLaporanSecrets(laporan));
  } catch (error) {
    console.error(`[Socket] Gagal emit laporan baru: ${error.message}`);
  }
};

const findReadableLaporan = async (idLaporan, pengguna, client = prisma) => {
  const laporan = await client.laporan.findUnique({
    where: { id_laporan: idLaporan },
    select: { id_laporan: true, id_unit: true, id_pengguna: true, status: true },
  });
  assertCanReadLaporan(pengguna, laporan);
  return laporan;
};

/**
 * Lock the parent report row through a DRAFT-only CAS before mutating a child.
 * A concurrent submit either waits for this transaction or makes the CAS fail.
 */
const mutateDraftSubreport = async (idLaporan, pengguna, mutation) => (
  prisma.$transaction(async (tx) => {
    const laporan = await tx.laporan.findUnique({
      where: { id_laporan: idLaporan },
      select: { id_laporan: true, id_unit: true, id_pengguna: true, status: true },
    });
    assertCanMutateDraft(pengguna, laporan);

    const gate = await tx.laporan.updateMany({
      where: {
        id_laporan: idLaporan,
        id_unit: pengguna.id_unit,
        status: 'DRAFT',
      },
      data: { updated_at: new Date() },
    });
    if (gate.count !== 1) {
      throw stateConflict('Laporan tidak lagi berstatus DRAFT', 'LAPORAN_DRAFT_CAS_FAILED');
    }

    return mutation(tx, laporan);
  })
);

/**
 * GET /api/laporan
 */
const getAllLaporan = async (req, res) => {
  const { skip, take, page, limit } = parsePagination(req.query);
  const { status, id_unit, tahun, bulan } = req.query;

  const where = {
    ...(status && { status }),
    ...(id_unit && { id_unit }),
  };

  if (tahun || bulan) {
    const currentBusinessYear = Number(getBusinessDate().slice(0, 4));
    const year = tahun || currentBusinessYear;
    const month = bulan ? bulan - 1 : null;
    where.tanggal = {
      gte: new Date(Date.UTC(year, month ?? 0, 1)),
      lt: month !== null
        ? new Date(Date.UTC(year, month + 1, 1))
        : new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  // USER_UNIT tidak pernah dapat memperluas scope di luar unit tokennya.
  if (req.pengguna.peran === 'USER_UNIT') {
    where.id_unit = req.pengguna.id_unit;
  }

  const [data, total] = await prisma.$transaction([
    prisma.laporan.findMany({
      where,
      skip,
      take,
      select: {
        ...PUBLIC_LAPORAN_SELECT,
        pengguna: { select: { nama: true } },
        unit: { select: { nama_unit: true } },
        laporan_kna: true,
        laporan_keuangan: true,
        laporan_penumpang: true,
        laporan_barang: { include: { komoditi: true } },
        _count: {
          select: {
            laporan_penumpang: true,
            laporan_barang: true,
          },
        },
      },
      orderBy: { tanggal: 'desc' },
    }),
    prisma.laporan.count({ where }),
  ]);

  await attachRealisasiOtomatis(data);
  return sendPaginated(
    res,
    redactLaporanSecrets(data),
    buildPaginationMeta(total, page, limit)
  );
};

/**
 * GET /api/laporan/:id
 * Detail lengkap dengan semua sub-laporan
 */
const getLaporanById = async (req, res) => {
  const laporan = await prisma.laporan.findUnique({
    where: { id_laporan: req.params.id },
    select: {
      ...PUBLIC_LAPORAN_SELECT,
      pengguna: { select: { id_pengguna: true, nama: true } },
      unit: { select: { id_unit: true, nama_unit: true } },
      laporan_kna: true,
      laporan_penumpang: true,
      laporan_barang: {
        include: { komoditi: { select: { nama_komoditi: true, satuan: true } } },
      },
      laporan_keuangan: true,
      permintaan_bantuan: {
        select: { id_permintaan: true, jenis: true, status: true },
      },
    },
  });

  assertCanReadLaporan(req.pengguna, laporan);
  await attachRealisasiOtomatis([laporan]);
  return sendSuccess(res, redactLaporanSecrets(laporan));
};

/**
 * POST /api/laporan
 */
const createLaporan = async (req, res) => {
  const { tanggal, kotak_detail, id_unit } = req.body;
  assertCanCreateLaporan(req.pengguna, id_unit);

  const laporan = await prisma.laporan.create({
    data: {
      tanggal,
      kotak_detail,
      id_unit: req.pengguna.id_unit,
      id_pengguna: req.pengguna.id_pengguna,
    },
    select: PUBLIC_LAPORAN_SELECT,
  });

  emitLaporanBaru(req, laporan);
  return sendCreated(res, redactLaporanSecrets(laporan), 'Laporan berhasil dibuat');
};

const updateDraftLaporan = async (req) => {
  const idLaporan = req.params.id;
  const nextStatus = req.body.status;
  const metadata = pick(req.body, LAPORAN_METADATA_FIELDS);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.laporan.findUnique({
      where: { id_laporan: idLaporan },
      select: { id_laporan: true, id_unit: true, id_pengguna: true, status: true },
    });

    if (req.body.id_unit !== undefined && req.body.id_unit !== req.pengguna.id_unit) {
      throw new LaporanAccessError(
        'Unit laporan tidak dapat diubah',
        403,
        'LAPORAN_UNIT_IMMUTABLE'
      );
    }

    if (nextStatus) assertCanSubmitDraft(req.pengguna, existing, nextStatus);
    else assertCanMutateDraft(req.pengguna, existing);
    if (!nextStatus && Object.keys(metadata).length === 0) {
      throw new LaporanAccessError(
        'Minimal satu field metadata yang dapat diubah harus dikirim',
        422,
        'LAPORAN_METADATA_REQUIRED'
      );
    }

    const updateData = {
      ...metadata,
      ...(nextStatus ? { status: nextStatus } : {}),
    };
    const changed = await tx.laporan.updateMany({
      where: {
        id_laporan: idLaporan,
        id_unit: req.pengguna.id_unit,
        status: 'DRAFT',
      },
      data: updateData,
    });
    if (changed.count !== 1) {
      throw stateConflict('Laporan tidak lagi berstatus DRAFT', 'LAPORAN_DRAFT_CAS_FAILED');
    }

    await tx.logAudit.create({
      data: {
        id_pengguna: req.pengguna.id_pengguna,
        aksi: nextStatus ? 'AJUKAN_LAPORAN' : 'UBAH_METADATA_LAPORAN',
        tabel_terkait: 'laporan',
        id_record_terkait: idLaporan,
        detail: JSON.stringify({
          status_sebelum: 'DRAFT',
          status_sesudah: nextStatus || 'DRAFT',
          field_diubah: Object.keys(metadata),
        }),
      },
    });

    return tx.laporan.findUnique({
      where: { id_laporan: idLaporan },
      select: {
        ...PUBLIC_LAPORAN_SELECT,
        pengguna: { select: { nama: true, no_hp: true } },
        unit: { select: { nama_unit: true } },
      },
    });
  });
};

const reviewLaporan = async (req) => {
  const idLaporan = req.params.id;
  const decision = req.body.status;
  const reason = req.body.kotak_detail ?? null;
  const forbiddenMetadata = ['tanggal', 'status_internal', 'id_unit']
    .filter((field) => req.body[field] !== undefined);

  if (!decision) {
    throw new LaporanAccessError(
      'Reviewer wajib mengirim keputusan status',
      422,
      'LAPORAN_REVIEW_DECISION_REQUIRED'
    );
  }
  if (forbiddenMetadata.length > 0) {
    throw new LaporanAccessError(
      'Reviewer tidak dapat mengubah metadata atau detail operasional laporan',
      403,
      'LAPORAN_REVIEW_METADATA_FORBIDDEN'
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.laporan.findUnique({
      where: { id_laporan: idLaporan },
      select: {
        ...PUBLIC_LAPORAN_SELECT,
        pengguna: { select: { id_pengguna: true, nama: true, no_hp: true } },
        unit: { select: { id_unit: true, nama_unit: true } },
      },
    });
    assertCanReviewLaporan(req.pengguna, existing, decision);

    const changed = await tx.laporan.updateMany({
      where: { id_laporan: idLaporan, status: 'DIAJUKAN' },
      data: { status: decision },
    });
    if (changed.count !== 1) {
      throw stateConflict(
        'Status laporan telah berubah; muat ulang sebelum mereview',
        'LAPORAN_REVIEW_CAS_FAILED'
      );
    }

    const recipientPhone = normalizeValidPhone(existing.pengguna?.no_hp);
    let notificationState = 'skipped_invalid_phone';
    if (recipientPhone) {
      const sourceVersion = existing.updated_at instanceof Date
        ? existing.updated_at.getTime()
        : String(existing.updated_at || 'unknown');
      const queued = await queueReportDecision({
        tx,
        dedupeKey: `report-decision:${idLaporan}:${sourceVersion}:${decision}`,
        decision,
        recipientName: existing.pengguna?.nama,
        recipientPhone,
        reportDate: formatBusinessDate(existing.tanggal),
        unitName: existing.unit?.nama_unit,
        reason,
        metadata: {
          reportId: idLaporan,
          reviewerId: req.pengguna.id_pengguna,
        },
      });
      notificationState = queued.state;
    }

    await tx.logAudit.create({
      data: {
        id_pengguna: req.pengguna.id_pengguna,
        aksi: decision === 'REVISI' ? 'MINTA_REVISI_LAPORAN' : 'REVIEW_LAPORAN',
        tabel_terkait: 'laporan',
        id_record_terkait: idLaporan,
        detail: JSON.stringify({
          status_sebelum: 'DIAJUKAN',
          status_sesudah: decision,
          catatan_review: reason,
          status_notifikasi: notificationState,
        }),
      },
    });

    return tx.laporan.findUnique({
      where: { id_laporan: idLaporan },
      select: {
        ...PUBLIC_LAPORAN_SELECT,
        pengguna: { select: { nama: true, no_hp: true } },
        unit: { select: { nama_unit: true } },
      },
    });
  });
};

/**
 * PUT /api/laporan/:id
 */
const updateLaporan = async (req, res) => {
  let updated;
  if (req.pengguna.peran === 'USER_UNIT') {
    updated = await updateDraftLaporan(req);
  } else if (isReviewer(req.pengguna)) {
    updated = await reviewLaporan(req);
  } else {
    throw new LaporanAccessError('Akses perubahan laporan ditolak', 403, 'LAPORAN_UPDATE_FORBIDDEN');
  }

  if (req.body.status) emitStatusUpdate(req, updated);
  return sendSuccess(
    res,
    redactLaporanSecrets(updated),
    'Laporan berhasil diperbarui'
  );
};

/**
 * DELETE /api/laporan/:id
 */
const deleteLaporan = async (req, res) => {
  const idLaporan = req.params.id;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.laporan.findUnique({
      where: { id_laporan: idLaporan },
      select: { id_laporan: true, id_unit: true, id_pengguna: true, status: true },
    });
    assertCanDeleteLaporan(req.pengguna, existing);

    const deleted = await tx.laporan.deleteMany({
      where: {
        id_laporan: idLaporan,
        id_unit: req.pengguna.id_unit,
        status: 'DRAFT',
      },
    });
    if (deleted.count !== 1) {
      throw stateConflict('Laporan tidak lagi dapat dihapus', 'LAPORAN_DELETE_CAS_FAILED');
    }

    await tx.logAudit.create({
      data: {
        id_pengguna: req.pengguna.id_pengguna,
        aksi: 'HAPUS_DRAFT_LAPORAN',
        tabel_terkait: 'laporan',
        id_record_terkait: idLaporan,
        detail: JSON.stringify({ status_sebelum: 'DRAFT' }),
      },
    });
  });

  return sendSuccess(res, null, 'Laporan berhasil dihapus');
};

// ============================================================
// SUB-LAPORAN: KNA
// ============================================================

const upsertLaporanKNA = async (req, res) => {
  const idLaporan = req.params.id;
  const { realisasi_rkad: _ignored, ...knaBody } = req.body;

  const kna = await mutateDraftSubreport(idLaporan, req.pengguna, (tx) => (
    tx.laporanKNA.upsert({
      where: { id_laporan: idLaporan },
      create: { ...knaBody, id_laporan: idLaporan },
      update: knaBody,
    })
  ));

  return sendSuccess(res, kna, 'Data KNA berhasil disimpan');
};

// ============================================================
// SUB-LAPORAN: Penumpang
// ============================================================

const getLaporanPenumpang = async (req, res) => {
  const idLaporan = req.params.id;
  await findReadableLaporan(idLaporan, req.pengguna);
  const data = await prisma.laporanPenumpang.findMany({
    where: { id_laporan: idLaporan },
    orderBy: { nama_ka: 'asc' },
  });
  return sendSuccess(res, data);
};

const createLaporanPenumpang = async (req, res) => {
  const idLaporan = req.params.id;
  const item = await mutateDraftSubreport(idLaporan, req.pengguna, (tx) => (
    tx.laporanPenumpang.create({
      data: { ...req.body, id_laporan: idLaporan },
    })
  ));
  return sendCreated(res, item, 'Data penumpang berhasil ditambahkan');
};

const updateLaporanPenumpang = async (req, res) => {
  const idLaporan = req.params.id;
  const itemId = req.params.itemId;
  const item = await mutateDraftSubreport(idLaporan, req.pengguna, async (tx) => {
    const existing = await tx.laporanPenumpang.findUnique({
      where: { id_laporan_penumpang: itemId },
      select: { id_laporan_penumpang: true, id_laporan: true },
    });
    assertChildBelongsToLaporan(existing, idLaporan, 'Data penumpang');
    return tx.laporanPenumpang.update({
      where: { id_laporan_penumpang: itemId },
      data: req.body,
    });
  });
  return sendSuccess(res, item, 'Data penumpang berhasil diperbarui');
};

const deleteLaporanPenumpang = async (req, res) => {
  const idLaporan = req.params.id;
  const itemId = req.params.itemId;
  await mutateDraftSubreport(idLaporan, req.pengguna, async (tx) => {
    const existing = await tx.laporanPenumpang.findUnique({
      where: { id_laporan_penumpang: itemId },
      select: { id_laporan_penumpang: true, id_laporan: true },
    });
    assertChildBelongsToLaporan(existing, idLaporan, 'Data penumpang');
    return tx.laporanPenumpang.delete({
      where: { id_laporan_penumpang: itemId },
    });
  });
  return sendSuccess(res, null, 'Data penumpang berhasil dihapus');
};

// ============================================================
// SUB-LAPORAN: Barang
// ============================================================

const getLaporanBarang = async (req, res) => {
  const idLaporan = req.params.id;
  await findReadableLaporan(idLaporan, req.pengguna);
  const data = await prisma.laporanBarang.findMany({
    where: { id_laporan: idLaporan },
    include: { komoditi: { select: { nama_komoditi: true, satuan: true } } },
  });
  return sendSuccess(res, data);
};

const createLaporanBarang = async (req, res) => {
  const idLaporan = req.params.id;
  const item = await mutateDraftSubreport(idLaporan, req.pengguna, (tx) => (
    tx.laporanBarang.create({
      data: { ...req.body, id_laporan: idLaporan },
    })
  ));
  return sendCreated(res, item, 'Data barang berhasil ditambahkan');
};

const updateLaporanBarang = async (req, res) => {
  const idLaporan = req.params.id;
  const itemId = req.params.itemId;
  const item = await mutateDraftSubreport(idLaporan, req.pengguna, async (tx) => {
    const existing = await tx.laporanBarang.findUnique({
      where: { id_laporan_barang: itemId },
      select: { id_laporan_barang: true, id_laporan: true },
    });
    assertChildBelongsToLaporan(existing, idLaporan, 'Data barang');
    return tx.laporanBarang.update({
      where: { id_laporan_barang: itemId },
      data: req.body,
    });
  });
  return sendSuccess(res, item, 'Data barang berhasil diperbarui');
};

const deleteLaporanBarang = async (req, res) => {
  const idLaporan = req.params.id;
  const itemId = req.params.itemId;
  await mutateDraftSubreport(idLaporan, req.pengguna, async (tx) => {
    const existing = await tx.laporanBarang.findUnique({
      where: { id_laporan_barang: itemId },
      select: { id_laporan_barang: true, id_laporan: true },
    });
    assertChildBelongsToLaporan(existing, idLaporan, 'Data barang');
    return tx.laporanBarang.delete({
      where: { id_laporan_barang: itemId },
    });
  });
  return sendSuccess(res, null, 'Data barang berhasil dihapus');
};

// ============================================================
// SUB-LAPORAN: Keuangan
// ============================================================

const upsertLaporanKeuangan = async (req, res) => {
  const idLaporan = req.params.id;
  const {
    target_rkad,
    pendapatan,
    pengeluaran,
    rincian_transaksi,
    rincian_spj,
    rincian_invoice,
  } = req.body;
  const data = {
    target_rkad,
    pendapatan,
    pengeluaran,
    laba_rugi: Number(pendapatan) - Number(pengeluaran),
    rincian_transaksi: rincian_transaksi || null,
    rincian_spj: rincian_spj || null,
    rincian_invoice: rincian_invoice || null,
  };

  const keuangan = await mutateDraftSubreport(idLaporan, req.pengguna, (tx) => (
    tx.laporanKeuangan.upsert({
      where: { id_laporan: idLaporan },
      create: { ...data, id_laporan: idLaporan },
      update: data,
    })
  ));

  return sendSuccess(res, keuangan, 'Data keuangan berhasil disimpan');
};

const resubmitLaporan = async (req, res) => {
  const idLaporan = req.params.id;
  const existing = await prisma.laporan.findUnique({
    where: { id_laporan: idLaporan },
    select: {
      ...PUBLIC_LAPORAN_SELECT,
      laporan_kna: true,
      laporan_penumpang: true,
      laporan_barang: true,
      laporan_keuangan: true,
      unit: { select: { id_unit: true, nama_unit: true } },
    },
  });

  assertCanResubmitLaporan(req.pengguna, existing);

  const before = snapshotLaporan(existing);
  const incoming = {
    tanggal: req.body.tanggal,
    kotak_detail: req.body.kotak_detail ?? null,
    laporan_kna: req.body.kna ?? null,
    laporan_penumpang: req.body.penumpangItems || [],
    laporan_barang: req.body.barangItems || [],
    laporan_keuangan: req.body.keuangan ?? null,
  };
  const after = snapshotLaporan(incoming);
  const changedFields = collectChangedFields(before, after);
  const numericChanged = hasNumericDataChange(before, after);

  if (changedFields.length === 0) {
    return sendError(res, 'Tidak ada perubahan data. Ubah minimal satu field sebelum resubmit.', 409);
  }
  if (numericChanged.length === 0) {
    return sendError(
      res,
      'Revisi wajib mengubah minimal satu angka data (mis. nilai, volume, pendapatan, jumlah). Perubahan catatan/tanggal saja belum cukup.',
      422
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.laporan.updateMany({
      where: {
        id_laporan: idLaporan,
        id_unit: req.pengguna.id_unit,
        status: 'REVISI',
      },
      data: {
        tanggal: req.body.tanggal,
        kotak_detail: req.body.kotak_detail ?? null,
        status: 'DIAJUKAN',
        status_internal: req.body.status_internal || 'PENDING',
      },
    });
    if (claimed.count !== 1) {
      throw stateConflict(
        'Status laporan telah berubah; muat ulang sebelum resubmit',
        'LAPORAN_RESUBMIT_CAS_FAILED'
      );
    }

    if (req.body.kna) {
      const data = pick(req.body.kna, KNA_FIELDS);
      await tx.laporanKNA.upsert({
        where: { id_laporan: idLaporan },
        create: { ...data, id_laporan: idLaporan },
        update: data,
      });
    } else {
      await tx.laporanKNA.deleteMany({ where: { id_laporan: idLaporan } });
    }

    await tx.laporanPenumpang.deleteMany({ where: { id_laporan: idLaporan } });
    if (incoming.laporan_penumpang.length > 0) {
      await tx.laporanPenumpang.createMany({
        data: incoming.laporan_penumpang.map((item) => ({
          ...pick(item, PENUMPANG_FIELDS),
          id_laporan: idLaporan,
        })),
      });
    }

    await tx.laporanBarang.deleteMany({ where: { id_laporan: idLaporan } });
    if (incoming.laporan_barang.length > 0) {
      await tx.laporanBarang.createMany({
        data: incoming.laporan_barang.map((item) => ({
          ...pick(item, BARANG_FIELDS),
          id_laporan: idLaporan,
        })),
      });
    }

    if (req.body.keuangan) {
      const data = pick(req.body.keuangan, KEUANGAN_FIELDS);
      data.laba_rugi = Number(data.pendapatan || 0) - Number(data.pengeluaran || 0);
      await tx.laporanKeuangan.upsert({
        where: { id_laporan: idLaporan },
        create: { ...data, id_laporan: idLaporan },
        update: data,
      });
    } else {
      await tx.laporanKeuangan.deleteMany({ where: { id_laporan: idLaporan } });
    }

    const latestRevision = await tx.revisiLaporan.findFirst({
      where: { id_laporan: idLaporan },
      orderBy: { versi: 'desc' },
      select: { versi: true },
    });
    const revision = await tx.revisiLaporan.create({
      data: {
        id_laporan: idLaporan,
        id_pengguna: req.pengguna.id_pengguna,
        versi: (latestRevision?.versi || 0) + 1,
        data_sebelum: before,
        data_sesudah: after,
        field_berubah: changedFields,
      },
    });

    const admins = await tx.pengguna.findMany({
      where: {
        peran: { in: ['ADMIN_GLOBAL', 'IT'] },
        no_hp: { not: null },
      },
      select: { id_pengguna: true, nama: true, no_hp: true },
    });
    const uniqueContacts = new Map();
    for (const admin of admins) {
      const phone = normalizeValidPhone(admin.no_hp);
      if (phone && !uniqueContacts.has(phone)) uniqueContacts.set(phone, { ...admin, phone });
    }

    let queuedCount = 0;
    for (const admin of uniqueContacts.values()) {
      const queued = await queueReportResubmitted({
        tx,
        dedupeKey: `report-resubmitted:${idLaporan}:v${revision.versi}:user:${admin.id_pengguna}`,
        recipientName: admin.nama,
        recipientPhone: admin.phone,
        reportId: idLaporan,
        unitName: existing.unit?.nama_unit,
        changedFields,
        metadata: {
          reportId: idLaporan,
          revision: revision.versi,
          submitterId: req.pengguna.id_pengguna,
        },
      });
      if (!queued.duplicate) queuedCount += 1;
    }

    await tx.logAudit.create({
      data: {
        id_pengguna: req.pengguna.id_pengguna,
        aksi: 'RESUBMIT_REVISI_LAPORAN',
        tabel_terkait: 'laporan',
        id_record_terkait: idLaporan,
        detail: JSON.stringify({
          versi: revision.versi,
          field_berubah: changedFields,
          notifikasi_diantrekan: queuedCount,
        }),
      },
    });

    return { revision, queuedCount };
  });

  const notification = {
    id_laporan: idLaporan,
    id_unit: existing.id_unit,
    nama_unit: existing.unit?.nama_unit,
    status: 'DIAJUKAN',
    versi: result.revision.versi,
    field_berubah: changedFields,
  };
  emitStatusUpdate(req, notification);

  return sendSuccess(
    res,
    {
      id_laporan: idLaporan,
      status: 'DIAJUKAN',
      versi: result.revision.versi,
      field_berubah: changedFields,
    },
    'Laporan revisi berhasil diajukan kembali'
  );
};

const unlockLaporan = async (req, res) => {
  const idLaporan = req.params.id;
  let tokenDigest;
  try {
    tokenDigest = hashHumanToken(req.body.token);
  } catch {
    return sendError(res, 'Token harus berisi tepat 16 karakter yang valid', 422);
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.laporan.findUnique({
      where: { id_laporan: idLaporan },
      select: {
        id_laporan: true,
        id_unit: true,
        id_pengguna: true,
        status: true,
        token_revisi: true,
        token_revisi_exp: true,
      },
    });
    assertCanUnlockLaporan(req.pengguna, existing);

    const expiresAt = existing.token_revisi_exp
      ? new Date(existing.token_revisi_exp)
      : null;
    if (
      typeof existing.token_revisi !== 'string' ||
      !TOKEN_DIGEST_PATTERN.test(existing.token_revisi) ||
      !expiresAt ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt <= now
    ) {
      throw invalidRecoveryToken();
    }

    const consumed = await tx.laporan.updateMany({
      where: {
        id_laporan: idLaporan,
        id_unit: req.pengguna.id_unit,
        id_pengguna: req.pengguna.id_pengguna,
        status: 'DISETUJUI',
        token_revisi: tokenDigest,
        token_revisi_exp: { gt: now },
      },
      data: {
        status: 'REVISI',
        token_revisi: null,
        token_revisi_exp: null,
      },
    });
    if (consumed.count !== 1) throw invalidRecoveryToken();

    await tx.logAudit.create({
      data: {
        id_pengguna: req.pengguna.id_pengguna,
        aksi: 'UNLOCK_LAPORAN',
        tabel_terkait: 'laporan',
        id_record_terkait: idLaporan,
        detail: JSON.stringify({
          status_sebelum: 'DISETUJUI',
          status_sesudah: 'REVISI',
          token_dikonsumsi: true,
        }),
      },
    });

    return tx.laporan.findUnique({
      where: { id_laporan: idLaporan },
      select: PUBLIC_LAPORAN_SELECT,
    });
  });

  emitStatusUpdate(req, updated);
  return sendSuccess(
    res,
    redactLaporanSecrets(updated),
    'Laporan berhasil dibuka kembali (Revisi)'
  );
};

module.exports = {
  redactLaporanSecrets,
  getAllLaporan,
  getLaporanById,
  createLaporan,
  updateLaporan,
  deleteLaporan,
  upsertLaporanKNA,
  getLaporanPenumpang,
  createLaporanPenumpang,
  updateLaporanPenumpang,
  deleteLaporanPenumpang,
  getLaporanBarang,
  createLaporanBarang,
  updateLaporanBarang,
  deleteLaporanBarang,
  upsertLaporanKeuangan,
  resubmitLaporan,
  unlockLaporan,
};
