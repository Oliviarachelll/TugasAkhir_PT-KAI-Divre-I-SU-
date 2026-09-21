/**
 * Controller: Program Tahunan Barang per Komoditi
 * Diisi sekali setahun (seperti target KNA). Form laporan hanya membaca.
 */
const prisma = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { z } = require('zod');

const getAllProgram = async (req, res) => {
  const { tahun, id_unit } = req.query;

  const where = {
    ...(tahun && { tahun: parseInt(tahun) }),
    ...(id_unit && { komoditi: { id_unit: parseInt(id_unit) } }),
  };

  // USER_UNIT hanya lihat program unitnya sendiri.
  if (req.pengguna.peran === 'USER_UNIT') {
    where.komoditi = { id_unit: req.pengguna.id_unit };
  }

  const data = await prisma.programBarang.findMany({
    where,
    include: { komoditi: { select: { nama_komoditi: true, satuan: true, id_unit: true } } },
    orderBy: { id_komoditi: 'asc' },
  });

  return sendSuccess(res, data);
};

const programItemSchema = z.object({
  id_komoditi: z.number().int().positive(),
  volume_program: z.coerce.number().nonnegative().optional().nullable(),
  pendapatan_program: z.coerce.number().nonnegative().optional().nullable(),
});

const saveBulkProgram = async (req, res) => {
  const parsed = z.object({
    tahun: z.number().int().min(2000).max(2100),
    items: z.array(programItemSchema).min(1),
  }).parse(req.body);

  const ids = parsed.items.map((i) => i.id_komoditi);
  const koms = await prisma.komoditiBarang.findMany({
    where: { id_komoditi: { in: ids } },
    select: { id_komoditi: true, id_unit: true },
  });
  if (koms.length !== ids.length) {
    return sendError(res, 'Sebagian komoditi tidak ditemukan', 404);
  }
  // USER_UNIT hanya boleh isi program unitnya sendiri.
  if (req.pengguna.peran === 'USER_UNIT' && koms.some((k) => k.id_unit !== req.pengguna.id_unit)) {
    return sendError(res, 'Akses ditolak', 403);
  }

  await prisma.$transaction(
    parsed.items.map((it) =>
      prisma.programBarang.upsert({
        where: { tahun_id_komoditi: { tahun: parsed.tahun, id_komoditi: it.id_komoditi } },
        create: {
          tahun: parsed.tahun,
          id_komoditi: it.id_komoditi,
          volume_program: it.volume_program ?? null,
          pendapatan_program: it.pendapatan_program ?? null,
        },
        update: {
          volume_program: it.volume_program ?? null,
          pendapatan_program: it.pendapatan_program ?? null,
        },
      })
    )
  );

  return sendSuccess(res, null, 'Program tahunan berhasil disimpan');
};

module.exports = { getAllProgram, saveBulkProgram };
