/**
 * Controller: Pengguna
 * CRUD pengguna (hanya ADMIN)
 */
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

/**
 * GET /api/pengguna
 * Daftar semua pengguna (ADMIN only)
 */
const getAllPengguna = async (req, res) => {
  const { skip, take, page, limit } = parsePagination(req.query);
  const { search, peran, id_unit } = req.query;

  const where = {
    ...(search && {
      OR: [
        { nama: { contains: search } },
        { email: { contains: search } },
      ],
    }),
    ...(peran && { peran }),
    ...(id_unit && { id_unit: parseInt(id_unit) }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.pengguna.findMany({
      where,
      skip,
      take,
      select: {
        id_pengguna: true,
        nama: true,
        email: true,
        peran: true,
        no_hp: true,
        terkunci: true,
        percobaan_login: true,
        created_at: true,
        unit: { select: { id_unit: true, nama_unit: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.pengguna.count({ where }),
  ]);

  return sendPaginated(res, data, buildPaginationMeta(total, page, limit));
};

/**
 * GET /api/pengguna/:id
 */
const getPenggunaById = async (req, res) => {
  const { id } = req.params;

  const pengguna = await prisma.pengguna.findUnique({
    where: { id_pengguna: parseInt(id) },
    select: {
      id_pengguna: true,
      nama: true,
      email: true,
      peran: true,
      no_hp: true,
      terkunci: true,
      percobaan_login: true,
      created_at: true,
      updated_at: true,
      unit: { select: { id_unit: true, nama_unit: true, jenis_unit: true } },
    },
  });

  if (!pengguna) return sendError(res, 'Pengguna tidak ditemukan', 404);

  return sendSuccess(res, pengguna);
};

/**
 * POST /api/pengguna
 * Buat pengguna baru (ADMIN only)
 */
const createPengguna = async (req, res) => {
  const { kata_sandi, ...rest } = req.body;

  // Cek unit exist
  const unit = await prisma.unit.findUnique({ where: { id_unit: rest.id_unit } });
  if (!unit) return sendError(res, 'Unit tidak ditemukan', 404);

  const hashed = await bcrypt.hash(kata_sandi, parseInt(process.env.BCRYPT_ROUNDS) || 12);

  const pengguna = await prisma.pengguna.create({
    data: { ...rest, kata_sandi: hashed },
    select: {
      id_pengguna: true,
      nama: true,
      email: true,
      peran: true,
      no_hp: true,
      created_at: true,
    },
  });

  return sendCreated(res, pengguna, 'Pengguna berhasil dibuat');
};

/**
 * PUT /api/pengguna/:id
 * Update pengguna (ADMIN only)
 */
const updatePengguna = async (req, res) => {
  const { id } = req.params;

  const exists = await prisma.pengguna.findUnique({ where: { id_pengguna: parseInt(id) } });
  if (!exists) return sendError(res, 'Pengguna tidak ditemukan', 404);

  const updateData = { ...req.body };
  if (updateData.kata_sandi) {
    updateData.kata_sandi = await bcrypt.hash(updateData.kata_sandi, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  }

  const pengguna = await prisma.pengguna.update({
    where: { id_pengguna: parseInt(id) },
    data: updateData,
    select: {
      id_pengguna: true,
      nama: true,
      email: true,
      peran: true,
      no_hp: true,
      terkunci: true,
      updated_at: true,
    },
  });

  return sendSuccess(res, pengguna, 'Pengguna berhasil diperbarui');
};

/**
 * DELETE /api/pengguna/:id
 * Hapus pengguna (ADMIN only)
 */
const deletePengguna = async (req, res) => {
  const { id } = req.params;

  // Cegah hapus diri sendiri
  if (parseInt(id) === req.pengguna.id_pengguna) {
    return sendError(res, 'Tidak dapat menghapus akun sendiri', 400);
  }

  const exists = await prisma.pengguna.findUnique({ where: { id_pengguna: parseInt(id) } });
  if (!exists) return sendError(res, 'Pengguna tidak ditemukan', 404);

  await prisma.pengguna.delete({ where: { id_pengguna: parseInt(id) } });

  return sendSuccess(res, null, 'Pengguna berhasil dihapus');
};

/**
 * PATCH /api/pengguna/:id/unlock
 * Buka kunci akun (ADMIN only)
 */
const unlockPengguna = async (req, res) => {
  const { id } = req.params;

  await prisma.pengguna.update({
    where: { id_pengguna: parseInt(id) },
    data: { terkunci: false, percobaan_login: 0 },
  });

  return sendSuccess(res, null, 'Akun berhasil dibuka kuncinya');
};

module.exports = {
  getAllPengguna,
  getPenggunaById,
  createPengguna,
  updatePengguna,
  deletePengguna,
  unlockPengguna,
};
