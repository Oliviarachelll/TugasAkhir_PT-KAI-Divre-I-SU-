/**
 * Controller: Permintaan Bantuan
 */
const prisma = require('../config/database');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { z } = require('zod');

const createPermintaanSchema = z.object({
  jenis: z.enum(['BANTUAN_TEKNIS', 'KLARIFIKASI_DATA', 'PERMINTAAN_AKSES', 'LAINNYA']),
  deskripsi: z.string().min(10),
  id_laporan: z.number().int().positive().optional().nullable(),
});

const getAllPermintaan = async (req, res) => {
  const { skip, take, page, limit } = parsePagination(req.query);
  const { status } = req.query;

  const where = {
    ...(status && { status }),
    ...(req.pengguna.peran === 'USER_UNIT' && {
      id_pengguna_pengaju: req.pengguna.id_pengguna,
    }),
    ...(req.pengguna.peran === 'IT' && {
      jenis: { in: ['BANTUAN_TEKNIS', 'PERMINTAAN_AKSES', 'LAINNYA'] },
    }),
    ...(req.pengguna.peran === 'ADMIN_GLOBAL' && {
      jenis: 'KLARIFIKASI_DATA',
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.permintaanBantuan.findMany({
      where,
      skip,
      take,
      include: {
        pengaju: { 
          select: { 
            nama: true, 
            unit: { select: { nama_unit: true } } 
          } 
        },
        penanggung: { select: { nama: true } },
        laporan: { select: { id_laporan: true, tanggal: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.permintaanBantuan.count({ where }),
  ]);

  return sendPaginated(res, data, buildPaginationMeta(total, page, limit));
};

const createPermintaan = async (req, res) => {
  const parsed = createPermintaanSchema.parse(req.body);
  const permintaan = await prisma.permintaanBantuan.create({
    data: { ...parsed, id_pengguna_pengaju: req.pengguna.id_pengguna },
  });
  return sendCreated(res, permintaan, 'Permintaan bantuan berhasil diajukan');
};

const tanggapiPermintaan = async (req, res) => {
  const { id } = req.params;
  const { status, token } = req.body;

  const validStatus = z
    .enum(['MENUNGGU', 'DIPROSES', 'SELESAI', 'DITOLAK'])
    .parse(status);

  // Cari permintaan terlebih dahulu untuk mengecek id_laporan
  const existingPermintaan = await prisma.permintaanBantuan.findUnique({
    where: { id_permintaan: parseInt(id) }
  });

  if (!existingPermintaan) {
    return sendError(res, 404, 'Tiket tidak ditemukan');
  }

  const permintaan = await prisma.permintaanBantuan.update({
    where: { id_permintaan: parseInt(id) },
    data: {
      status: validStatus,
      id_pengguna_penanganan: req.pengguna.id_pengguna,
    },
  });

  // Jika admin mengirimkan token dan tiket ini terkait dengan sebuah laporan
  if (token && validStatus === 'SELESAI' && existingPermintaan.id_laporan) {
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 1); // Kedaluwarsa 1 jam dari sekarang
    
    await prisma.laporan.update({
      where: { id_laporan: existingPermintaan.id_laporan },
      data: { 
        token_revisi: token,
        token_revisi_exp: expiredAt
      }
    });
  } else if (token && validStatus === 'SELESAI' && existingPermintaan.jenis === 'PERMINTAAN_AKSES') {
    // Reset password token for locked account
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 1); // 1 hour expiration

    // Delete any old unused tokens for this user
    await prisma.tokenReset.deleteMany({
      where: { id_pengguna: existingPermintaan.id_pengguna_pengaju, sudah_dipakai: false }
    });

    await prisma.tokenReset.create({
      data: {
        token: token,
        kedaluwarsa_pada: expiredAt,
        id_pengguna: existingPermintaan.id_pengguna_pengaju
      }
    });
  }

  return sendSuccess(res, permintaan, 'Status permintaan berhasil diperbarui');
};

module.exports = { getAllPermintaan, createPermintaan, tanggapiPermintaan };
