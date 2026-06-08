/**
 * Controller: Komoditi Barang
 * CRUD komoditi / jenis barang
 */
const prisma = require('../config/database');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');
const { z } = require('zod');

const komoditiSchema = z.object({
  nama_komoditi: z.string().min(2).max(150),
  satuan: z.string().min(1).max(50),
  id_unit: z.number().int().positive(),
});

const getAllKomoditi = async (req, res) => {
  const { id_unit } = req.query;

  const where = id_unit ? { id_unit: parseInt(id_unit) } : {};

  const data = await prisma.komoditiBarang.findMany({
    where,
    include: { unit: { select: { nama_unit: true } } },
    orderBy: { nama_komoditi: 'asc' },
  });

  return sendSuccess(res, data);
};

const createKomoditi = async (req, res) => {
  const parsed = komoditiSchema.parse(req.body);
  const komoditi = await prisma.komoditiBarang.create({ data: parsed });
  return sendCreated(res, komoditi, 'Komoditi berhasil ditambahkan');
};

const updateKomoditi = async (req, res) => {
  const parsed = komoditiSchema.partial().parse(req.body);
  const komoditi = await prisma.komoditiBarang.update({
    where: { id_komoditi: parseInt(req.params.id) },
    data: parsed,
  });
  return sendSuccess(res, komoditi, 'Komoditi berhasil diperbarui');
};

const deleteKomoditi = async (req, res) => {
  await prisma.komoditiBarang.delete({ where: { id_komoditi: parseInt(req.params.id) } });
  return sendSuccess(res, null, 'Komoditi berhasil dihapus');
};

module.exports = { getAllKomoditi, createKomoditi, updateKomoditi, deleteKomoditi };
