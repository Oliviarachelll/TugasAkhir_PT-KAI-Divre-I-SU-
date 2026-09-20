/**
 * Controller: Target
 * CRUD target tahunan per unit per kategori
 */
const prisma = require('../config/database');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');
const { z } = require('zod');

const targetSchema = z.object({
  tahun: z.number().int().min(2000).max(2100),
  kategori: z.enum(['KNA', 'PENUMPANG', 'BARANG', 'KEUANGAN', 'OPERASIONAL']),
  nilai: z.number().positive(),
  id_unit: z.number().int().positive(),
});

const getAllTarget = async (req, res) => {
  const { tahun, id_unit } = req.query;

  const where = {
    ...(tahun && { tahun: parseInt(tahun) }),
    ...(id_unit && { id_unit: parseInt(id_unit) }),
  };

  if (req.pengguna.peran === 'USER_UNIT') {
    where.id_unit = req.pengguna.id_unit;
  }

  const data = await prisma.target.findMany({
    where,
    include: { unit: { select: { nama_unit: true } } },
    orderBy: [{ tahun: 'desc' }, { kategori: 'asc' }],
  });

  return sendSuccess(res, data);
};

const createTarget = async (req, res) => {
  const parsed = targetSchema.parse(req.body);
  // USER_UNIT hanya boleh membuat target untuk unitnya sendiri.
  if (req.pengguna.peran === 'USER_UNIT') {
    parsed.id_unit = req.pengguna.id_unit;
  }
  const target = await prisma.target.create({ data: parsed });
  return sendCreated(res, target, 'Target berhasil dibuat');
};

const updateTarget = async (req, res) => {
  const { id } = req.params;
  const parsed = targetSchema.partial().parse(req.body);

  const existing = await prisma.target.findUnique({ where: { id_target: parseInt(id) } });
  if (!existing) return sendError(res, 'Target tidak ditemukan', 404);

  // USER_UNIT hanya boleh mengubah target milik unitnya sendiri,
  // dan tidak boleh memindahkan target ke unit lain.
  if (req.pengguna.peran === 'USER_UNIT') {
    if (existing.id_unit !== req.pengguna.id_unit) {
      return sendError(res, 'Akses ditolak', 403);
    }
    delete parsed.id_unit;
  }

  const target = await prisma.target.update({
    where: { id_target: parseInt(id) },
    data: parsed,
  });

  return sendSuccess(res, target, 'Target berhasil diperbarui');
};

const deleteTarget = async (req, res) => {
  await prisma.target.delete({ where: { id_target: parseInt(req.params.id) } });
  return sendSuccess(res, null, 'Target berhasil dihapus');
};

module.exports = { getAllTarget, createTarget, updateTarget, deleteTarget };
