/**
 * Controller: Laporan
 * CRUD laporan induk + sub-laporan
 */
const prisma = require('../config/database');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const whatsappService = require('../whatsapp/baileys.service');

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

  // Cegah edit laporan yang sudah disetujui (kecuali IT/ADMIN_GLOBAL)
  if (laporan.status === 'DISETUJUI' && !['IT', 'ADMIN_GLOBAL'].includes(req.pengguna.peran)) {
    return sendError(res, 'Laporan yang sudah disetujui tidak dapat diubah', 403);
  }

  const updated = await prisma.laporan.update({
    where: { id_laporan: parseInt(id) },
    data: req.body,
    include: {
      pengguna: { select: { nama: true, no_hp: true } },
      unit: { select: { nama_unit: true } },
    },
  });

  // Kirim notifikasi WA jika status berubah ke DISETUJUI / DITOLAK / REVISI
  const statusBaru = req.body.status;
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

  const kna = await prisma.laporanKNA.upsert({
    where: { id_laporan },
    create: { ...req.body, id_laporan },
    update: req.body,
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

  const { pendapatan, pengeluaran } = req.body;
  const laba_rugi = parseFloat(pendapatan) - parseFloat(pengeluaran);

  const keuangan = await prisma.laporanKeuangan.upsert({
    where: { id_laporan },
    create: { pendapatan, pengeluaran, laba_rugi, id_laporan },
    update: { pendapatan, pengeluaran, laba_rugi },
  });

  return sendSuccess(res, keuangan, 'Data keuangan berhasil disimpan');
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
};
