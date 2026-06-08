/**
 * Controller: Unit
 * CRUD unit organisasi
 */
const prisma = require('../config/database');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { z } = require('zod');

const unitSchema = z.object({
  nama_unit: z.string().min(2).max(100),
  jenis_unit: z.enum(['PUSAT', 'DAERAH', 'CABANG']),
});

const getAllUnit = async (req, res) => {
  const { skip, take, page, limit } = parsePagination(req.query);

  const [data, total] = await prisma.$transaction([
    prisma.unit.findMany({
      skip,
      take,
      include: { _count: { select: { pengguna: true, laporan: true } } },
      orderBy: { nama_unit: 'asc' },
    }),
    prisma.unit.count(),
  ]);

  return sendPaginated(res, data, buildPaginationMeta(total, page, limit));
};

const getUnitById = async (req, res) => {
  const unit = await prisma.unit.findUnique({
    where: { id_unit: parseInt(req.params.id) },
    include: {
      _count: { select: { pengguna: true, laporan: true, target: true } },
    },
  });

  if (!unit) return sendError(res, 'Unit tidak ditemukan', 404);
  return sendSuccess(res, unit);
};

const createUnit = async (req, res) => {
  const parsed = unitSchema.parse(req.body);
  const unit = await prisma.unit.create({ data: parsed });
  return sendCreated(res, unit, 'Unit berhasil dibuat');
};

const updateUnit = async (req, res) => {
  const { id } = req.params;
  const exists = await prisma.unit.findUnique({ where: { id_unit: parseInt(id) } });
  if (!exists) return sendError(res, 'Unit tidak ditemukan', 404);

  const parsed = unitSchema.partial().parse(req.body);
  const unit = await prisma.unit.update({ where: { id_unit: parseInt(id) }, data: parsed });
  return sendSuccess(res, unit, 'Unit berhasil diperbarui');
};

const deleteUnit = async (req, res) => {
  const { id } = req.params;
  const exists = await prisma.unit.findUnique({
    where: { id_unit: parseInt(id) },
    include: { _count: { select: { pengguna: true } } },
  });

  if (!exists) return sendError(res, 'Unit tidak ditemukan', 404);
  if (exists._count.pengguna > 0) {
    return sendError(res, 'Unit masih memiliki pengguna, tidak dapat dihapus', 409);
  }

  await prisma.unit.delete({ where: { id_unit: parseInt(id) } });
  return sendSuccess(res, null, 'Unit berhasil dihapus');
};

module.exports = { getAllUnit, getUnitById, createUnit, updateUnit, deleteUnit };
