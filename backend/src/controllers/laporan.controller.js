/**
 * Controller: Laporan
 * CRUD laporan induk + sub-laporan
 */
const prisma = require('../config/database');
const { Prisma } = require('@prisma/client');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const whatsappService = require('../whatsapp/baileys.service');

const KNA_FIELDS = ['jml_kontrak_row', 'luas_t_row', 'luas_b_row', 'nilai_row', 'target_rkad', 'jml_kontrak_non_row', 'luas_t_non_row', 'luas_b_non_row', 'nilai_non_row'];
const BARANG_FIELDS = ['jml_ka', 'nama_kustom', 'volume', 'volume_kumulatif', 'volume_program', 'volume_pencapaian', 'pendapatan', 'pendapatan_kumulatif', 'pendapatan_program', 'pendapatan_pencapaian', 'id_komoditi'];
const KEUANGAN_FIELDS = ['target_rkad', 'pendapatan', 'pengeluaran', 'rincian_transaksi', 'rincian_spj', 'rincian_invoice'];
// realisasi_rkad TIDAK lagi diinput/disimpa dari user — dihitung otomatis
// saat baca (lihat attachRealisasiOtomatis) dan diabaikan saat tulis.
const PENUMPANG_FIELDS = ['nama_ka', 'no_ka', 'lintas', 'berangkat', 'kedatangan', 'jml_penumpang', 'pendapatan'];

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

const numVal = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber() || 0;
  return Number(v) || 0;
};

/**
 * Realisasi RKAD otomatis: penjumlahan nilai harian unit tersebut sejak
 * 1 Januari tahun berjalan sampai tanggal tiap laporan (yang DITOLAK dikecualikan).
 * KNA menjumlah nilai_row + nilai_non_row, keuangan menjumlah pendapatan.
 * Hasilnya menimpa field realisasi_rkad pada response (kolom DB tidak dipakai lagi).
 */
const attachRealisasiOtomatis = async (rows) => {
  const targets = rows.filter((r) => r.laporan_kna || r.laporan_keuangan);
  if (targets.length === 0) return rows;

  const combos = new Map();
  for (const r of targets) {
    const year = new Date(r.tanggal).getFullYear();
    combos.set(`${r.id_unit}-${year}`, { id_unit: r.id_unit, year });
  }

  const harian = new Map();
  await Promise.all([...combos.entries()].map(async ([key, { id_unit, year }]) => {
    const baseWhere = {
      id_unit,
      tanggal: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      status: { not: 'DITOLAK' },
    };
    const [knaRows, keuRows] = await Promise.all([
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
      kna: knaRows.map((x) => ({ t: new Date(x.tanggal).getTime(), v: numVal(x.laporan_kna.nilai_row) + numVal(x.laporan_kna.nilai_non_row) })),
      keu: keuRows.map((x) => ({ t: new Date(x.tanggal).getTime(), v: numVal(x.laporan_keuangan.pendapatan) })),
    });
  }));

  for (const r of targets) {
    const year = new Date(r.tanggal).getFullYear();
    const t = new Date(r.tanggal).getTime();
    const data = harian.get(`${r.id_unit}-${year}`);
    if (!data) continue;
    if (r.laporan_kna) {
      r.laporan_kna.realisasi_rkad = data.kna.filter((x) => x.t <= t).reduce((s, x) => s + x.v, 0);
    }
    if (r.laporan_keuangan) {
      r.laporan_keuangan.realisasi_rkad = data.keu.filter((x) => x.t <= t).reduce((s, x) => s + x.v, 0);
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

/**
 * GET /api/laporan
 */
const getAllLaporan = async (req, res) => {
  const { skip, take, page, limit } = parsePagination(req.query);
  const { status, id_unit, tahun, bulan } = req.query;

  const where = {
    ...(status && { status }),
    ...(id_unit && { id_unit: parseInt(id_unit) }),
  };

  // Filter berdasarkan tahun/bulan dari tanggal
  if (tahun || bulan) {
    const year = parseInt(tahun) || new Date().getFullYear();
    const month = bulan ? parseInt(bulan) - 1 : null;

    where.tanggal = {
      gte: new Date(year, month ?? 0, 1),
      lt: month !== null
        ? new Date(year, month + 1, 1)
        : new Date(year + 1, 0, 1),
    };
  }

  // USER_UNIT hanya lihat laporan unit sendiri
  if (req.pengguna.peran === 'USER_UNIT') {
    where.id_unit = req.pengguna.id_unit;
  }

  const [data, total] = await prisma.$transaction([
    prisma.laporan.findMany({
      where,
      skip,
      take,
      include: {
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

  return sendPaginated(res, data, buildPaginationMeta(total, page, limit));
};

/**
 * GET /api/laporan/:id
 * Detail lengkap dengan semua sub-laporan
 */
const getLaporanById = async (req, res) => {
  const laporan = await prisma.laporan.findUnique({
    where: { id_laporan: parseInt(req.params.id) },
    include: {
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

  if (!laporan) return sendError(res, 'Laporan tidak ditemukan', 404);

  // USER_UNIT hanya lihat laporan unit sendiri
  if (req.pengguna.peran === 'USER_UNIT' && laporan.id_unit !== req.pengguna.id_unit) {
    return sendError(res, 'Akses ditolak', 403);
  }

  await attachRealisasiOtomatis([laporan]);

  return sendSuccess(res, laporan);
};

/**
 * POST /api/laporan
 */
const createLaporan = async (req, res) => {
  const { tanggal, kotak_detail, id_unit } = req.body;

  // USER_UNIT hanya bisa buat laporan untuk unitnya sendiri
  const targetUnit = req.pengguna.peran === 'USER_UNIT'
    ? req.pengguna.id_unit
    : id_unit;

  const laporan = await prisma.laporan.create({
    data: {
      tanggal,
      kotak_detail,
      id_unit: targetUnit,
      id_pengguna: req.pengguna.id_pengguna,
    },
  });

  return sendCreated(res, laporan, 'Laporan berhasil dibuat');
};

/**
 * PUT /api/laporan/:id
 */
const updateLaporan = async (req, res) => {
  const { id } = req.params;

  const laporan = await prisma.laporan.findUnique({ where: { id_laporan: parseInt(id) } });
  if (!laporan) return sendError(res, 'Laporan tidak ditemukan', 404);

  if (req.pengguna.peran === 'USER_UNIT' && laporan.id_unit !== req.pengguna.id_unit) {
    return sendError(res, 'Akses ditolak', 403);
  }

  // User unit hanya boleh mengedit metadata draft. Resubmit revisi wajib melalui endpoint atomik.
  if (laporan.status === 'REVISI' && req.pengguna.peran === 'USER_UNIT') {
    return sendError(res, 'Gunakan proses resubmit untuk laporan revisi', 409);
  }

  // Cegah edit laporan yang sudah disetujui (kecuali IT/ADMIN_GLOBAL)
  if (laporan.status === 'DISETUJUI' && !['IT', 'ADMIN_GLOBAL'].includes(req.pengguna.peran)) {
    return sendError(res, 'Laporan yang sudah disetujui tidak dapat diubah', 403);
  }

  const previousStatus = laporan.status;
  const updated = await prisma.laporan.update({
    where: { id_laporan: parseInt(id) },
    data: req.body,
    include: {
      pengguna: { select: { nama: true, no_hp: true } },
      unit: { select: { nama_unit: true } },
    },
  });

  // Catat keputusan reviewer, termasuk pelaku dan waktu melalui relasi audit.
  if (req.body.status && req.body.status !== previousStatus) {
    await prisma.logAudit.create({
      data: {
        id_pengguna: req.pengguna.id_pengguna,
        aksi: req.body.status === 'REVISI' ? 'MINTA_REVISI_LAPORAN' : 'UBAH_STATUS_LAPORAN',
        tabel_terkait: 'laporan',
        id_record_terkait: parseInt(id),
        detail: JSON.stringify({ status_sebelum: previousStatus, status_sesudah: req.body.status, catatan: req.body.kotak_detail ?? null }),
      },
    });
  }

  // Kirim notifikasi WA hanya jika status benar-benar berubah.
  const statusBaru = req.body.status !== previousStatus ? req.body.status : null;
  if (statusBaru && ['DISETUJUI', 'DITOLAK', 'REVISI'].includes(statusBaru)) {
    const noHp = updated.pengguna?.no_hp;
    const nama = updated.pengguna?.nama;
    const namaUnit = updated.unit?.nama_unit;
    const tanggal = new Date(updated.tanggal).toLocaleDateString('id-ID');

    if (noHp) {
      if (statusBaru === 'DISETUJUI') {
        whatsappService
          .notifikasiLaporanDisetujui(noHp, nama, tanggal, namaUnit)
          .catch((err) => console.error('[WA] Gagal notif disetujui:', err.message));
      } else {
        whatsappService
          .notifikasiLaporanDitolak(noHp, nama, tanggal, statusBaru)
          .catch((err) => console.error('[WA] Gagal notif ditolak/revisi:', err.message));
      }
    }
  }

  return sendSuccess(res, updated, 'Laporan berhasil diperbarui');
};

/**
 * DELETE /api/laporan/:id
 */
const deleteLaporan = async (req, res) => {
  const { id } = req.params;

  const laporan = await prisma.laporan.findUnique({ where: { id_laporan: parseInt(id) } });
  if (!laporan) return sendError(res, 'Laporan tidak ditemukan', 404);

  if (laporan.status === 'DISETUJUI') {
    return sendError(res, 'Laporan yang sudah disetujui tidak dapat dihapus', 403);
  }

  await prisma.laporan.delete({ where: { id_laporan: parseInt(id) } });
  return sendSuccess(res, null, 'Laporan berhasil dihapus');
};

// ============================================================
// SUB-LAPORAN: KNA
// ============================================================

const upsertLaporanKNA = async (req, res) => {
  const id_laporan = parseInt(req.params.id);

  const laporan = await prisma.laporan.findUnique({ where: { id_laporan } });
  if (!laporan) return sendError(res, 'Laporan tidak ditemukan', 404);

  // realisasi_rkad diabaikan: selalu dihitung otomatis saat baca.
  const { realisasi_rkad: _abaikanKna, ...knaBody } = req.body;
  const kna = await prisma.laporanKNA.upsert({
    where: { id_laporan },
    create: { ...knaBody, id_laporan },
    update: knaBody,
  });

  return sendSuccess(res, kna, 'Data KNA berhasil disimpan');
};

// ============================================================
// SUB-LAPORAN: Penumpang
// ============================================================

const getLaporanPenumpang = async (req, res) => {
  const data = await prisma.laporanPenumpang.findMany({
    where: { id_laporan: parseInt(req.params.id) },
    orderBy: { nama_ka: 'asc' },
  });
  return sendSuccess(res, data);
};

const createLaporanPenumpang = async (req, res) => {
  const id_laporan = parseInt(req.params.id);

  const laporan = await prisma.laporan.findUnique({ where: { id_laporan } });
  if (!laporan) return sendError(res, 'Laporan tidak ditemukan', 404);

  const item = await prisma.laporanPenumpang.create({
    data: { ...req.body, id_laporan },
  });
  return sendCreated(res, item, 'Data penumpang berhasil ditambahkan');
};

const updateLaporanPenumpang = async (req, res) => {
  const item = await prisma.laporanPenumpang.update({
    where: { id_laporan_penumpang: parseInt(req.params.itemId) },
    data: req.body,
  });
  return sendSuccess(res, item, 'Data penumpang berhasil diperbarui');
};

const deleteLaporanPenumpang = async (req, res) => {
  await prisma.laporanPenumpang.delete({
    where: { id_laporan_penumpang: parseInt(req.params.itemId) },
  });
  return sendSuccess(res, null, 'Data penumpang berhasil dihapus');
};

// ============================================================
// SUB-LAPORAN: Barang
// ============================================================

const getLaporanBarang = async (req, res) => {
  const data = await prisma.laporanBarang.findMany({
    where: { id_laporan: parseInt(req.params.id) },
    include: { komoditi: { select: { nama_komoditi: true, satuan: true } } },
  });
  return sendSuccess(res, data);
};

const createLaporanBarang = async (req, res) => {
  const id_laporan = parseInt(req.params.id);
  const laporan = await prisma.laporan.findUnique({ where: { id_laporan } });
  if (!laporan) return sendError(res, 'Laporan tidak ditemukan', 404);

  const item = await prisma.laporanBarang.create({
    data: { ...req.body, id_laporan },
  });
  return sendCreated(res, item, 'Data barang berhasil ditambahkan');
};

const updateLaporanBarang = async (req, res) => {
  const item = await prisma.laporanBarang.update({
    where: { id_laporan_barang: parseInt(req.params.itemId) },
    data: req.body,
  });
  return sendSuccess(res, item, 'Data barang berhasil diperbarui');
};

const deleteLaporanBarang = async (req, res) => {
  await prisma.laporanBarang.delete({
    where: { id_laporan_barang: parseInt(req.params.itemId) },
  });
  return sendSuccess(res, null, 'Data barang berhasil dihapus');
};

// ============================================================
// SUB-LAPORAN: Keuangan
// ============================================================

const upsertLaporanKeuangan = async (req, res) => {
  const id_laporan = parseInt(req.params.id);

  const laporan = await prisma.laporan.findUnique({ where: { id_laporan } });
  if (!laporan) return sendError(res, 'Laporan tidak ditemukan', 404);

  // realisasi_rkad diabaikan: selalu dihitung otomatis saat baca.
  const { target_rkad, pendapatan, pengeluaran, rincian_transaksi, rincian_spj, rincian_invoice } = req.body;
  const laba_rugi = parseFloat(pendapatan) - parseFloat(pengeluaran);

  const data = {
    target_rkad,
    pendapatan,
    pengeluaran,
    laba_rugi,
    rincian_transaksi: rincian_transaksi || null,
    rincian_spj: rincian_spj || null,
    rincian_invoice: rincian_invoice || null
  };

  const keuangan = await prisma.laporanKeuangan.upsert({
    where: { id_laporan },
    create: { ...data, id_laporan },
    update: data,
  });

  return sendSuccess(res, keuangan, 'Data keuangan berhasil disimpan');
};

const resubmitLaporan = async (req, res) => {
  const idLaporan = parseInt(req.params.id);
  const existing = await prisma.laporan.findUnique({
    where: { id_laporan: idLaporan },
    include: { laporan_kna: true, laporan_penumpang: true, laporan_barang: true, laporan_keuangan: true, unit: true },
  });

  if (!existing) return sendError(res, 'Laporan tidak ditemukan', 404);
  if (req.pengguna.peran !== 'USER_UNIT' || existing.id_unit !== req.pengguna.id_unit) {
    return sendError(res, 'Hanya user unit pemilik laporan yang dapat melakukan resubmit', 403);
  }
  if (existing.status !== 'REVISI') {
    return sendError(res, 'Laporan tidak dalam status REVISI', 409);
  }

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

  if (changedFields.length === 0) {
    return sendError(res, 'Tidak ada perubahan data. Ubah minimal satu field sebelum resubmit.', 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.laporan.update({
      where: { id_laporan: idLaporan },
      data: { tanggal: new Date(req.body.tanggal), kotak_detail: req.body.kotak_detail ?? null, status: 'DIAJUKAN', status_internal: req.body.status_internal || 'PENDING' },
    });

    if (req.body.kna) {
      const data = pick(req.body.kna, KNA_FIELDS);
      await tx.laporanKNA.upsert({ where: { id_laporan: idLaporan }, create: { ...data, id_laporan: idLaporan }, update: data });
    } else {
      await tx.laporanKNA.deleteMany({ where: { id_laporan: idLaporan } });
    }

    await tx.laporanPenumpang.deleteMany({ where: { id_laporan: idLaporan } });
    if (incoming.laporan_penumpang.length) {
      await tx.laporanPenumpang.createMany({ data: incoming.laporan_penumpang.map(item => ({ ...pick(item, PENUMPANG_FIELDS), id_laporan: idLaporan })) });
    }

    await tx.laporanBarang.deleteMany({ where: { id_laporan: idLaporan } });
    if (incoming.laporan_barang.length) {
      await tx.laporanBarang.createMany({ data: incoming.laporan_barang.map(item => ({ ...pick(item, BARANG_FIELDS), id_laporan: idLaporan })) });
    }

    if (req.body.keuangan) {
      const data = pick(req.body.keuangan, KEUANGAN_FIELDS);
      data.laba_rugi = Number(data.pendapatan || 0) - Number(data.pengeluaran || 0);
      await tx.laporanKeuangan.upsert({ where: { id_laporan: idLaporan }, create: { ...data, id_laporan: idLaporan }, update: data });
    } else {
      await tx.laporanKeuangan.deleteMany({ where: { id_laporan: idLaporan } });
    }

    const latestRevision = await tx.revisiLaporan.findFirst({ where: { id_laporan: idLaporan }, orderBy: { versi: 'desc' }, select: { versi: true } });
    const revision = await tx.revisiLaporan.create({
      data: { id_laporan: idLaporan, id_pengguna: req.pengguna.id_pengguna, versi: (latestRevision?.versi || 0) + 1, data_sebelum: before, data_sesudah: after, field_berubah: changedFields },
    });
    await tx.logAudit.create({
      data: { id_pengguna: req.pengguna.id_pengguna, aksi: 'RESUBMIT_REVISI_LAPORAN', tabel_terkait: 'laporan', id_record_terkait: idLaporan, detail: JSON.stringify({ versi: revision.versi, field_berubah: changedFields }) },
    });
    return revision;
  });

  const notification = { id_laporan: idLaporan, id_unit: existing.id_unit, nama_unit: existing.unit?.nama_unit, versi: result.versi, field_berubah: changedFields };
  req.app.get('io')?.emit('laporan:resubmitted', notification);

  const admins = await prisma.pengguna.findMany({ where: { peran: 'ADMIN_GLOBAL', no_hp: { not: null } }, select: { nama: true, no_hp: true } });
  const deliveryResults = await Promise.allSettled(admins.map(admin => whatsappService.kirimPesan(admin.no_hp, `🔄 *Laporan Direvisi*\n\nHalo ${admin.nama}, laporan #${idLaporan} dari *${existing.unit?.nama_unit}* telah diperbaiki dan membutuhkan review ulang.\n\nField berubah: ${changedFields.join(', ')}`)));
  const sent = deliveryResults.filter(item => item.status === 'fulfilled').length;
  await prisma.logNotifikasi.create({
    data: { template: 'Laporan direvisi - review ulang', penerima: `${admins.length} Admin Global`, status: `${sent} Berhasil, ${admins.length - sent} Gagal; socket broadcast terkirim` },
  });

  return sendSuccess(res, { id_laporan: idLaporan, status: 'DIAJUKAN', versi: result.versi, field_berubah: changedFields }, 'Laporan revisi berhasil diajukan kembali');
};

module.exports = {
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
};

const unlockLaporan = async (req, res) => {
  const { id } = req.params;
  const { token } = req.body;
  const idLaporan = parseInt(id);

  if (!token) {
    return sendError(res, 'Token diperlukan', 400);
  }

  const laporan = await prisma.laporan.findUnique({
    where: { id_laporan: idLaporan }
  });

  if (!laporan) {
    return sendError(res, 'Laporan tidak ditemukan', 404);
  }

  if (laporan.status !== 'DISETUJUI') {
    return sendError(res, 'Laporan tidak dalam status DISETUJUI', 400);
  }

  if (laporan.token_revisi !== token) {
    return sendError(res, 'Token revisi tidak valid', 400);
  }

  if (laporan.token_revisi_exp && new Date() > new Date(laporan.token_revisi_exp)) {
    return sendError(res, 'Token revisi sudah kedaluwarsa', 400);
  }

  // Token valid, unlock laporan
  const updated = await prisma.laporan.update({
    where: { id_laporan: idLaporan },
    data: {
      status: 'REVISI',
      token_revisi: null, // Clear token after use
      token_revisi_exp: null, // Clear expiration after use
      kotak_detail: 'Laporan dibuka kembali melalui token Helpdesk'
    }
  });

  // Log audit
  await prisma.logAudit.create({
    data: {
      id_pengguna: req.pengguna.id_pengguna,
      aksi: 'UNLOCK_LAPORAN',
      tabel_terkait: 'laporan',
      id_record_terkait: idLaporan,
      detail: `Laporan di-unlock dengan token revisi. Status diubah dari DISETUJUI ke REVISI.`,
    }
  });

  return sendSuccess(res, updated, 'Laporan berhasil dibuka kembali (Revisi)');
};

module.exports.unlockLaporan = unlockLaporan;
