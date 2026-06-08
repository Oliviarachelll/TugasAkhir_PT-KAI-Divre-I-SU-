/**
 * Controller: Log Audit (Read-only)
 */
const prisma = require('../config/database');
const { sendPaginated } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const getAllLogAudit = async (req, res) => {
  const { skip, take, page, limit } = parsePagination(req.query);
  const { id_pengguna, aksi } = req.query;

  const where = {
    ...(id_pengguna && { id_pengguna: parseInt(id_pengguna) }),
    ...(aksi && { aksi: { contains: aksi } }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.logAudit.findMany({
      where,
      skip,
      take,
      include: {
        pengguna: { select: { nama: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.logAudit.count({ where }),
  ]);

  return sendPaginated(res, data, buildPaginationMeta(total, page, limit));
};

module.exports = { getAllLogAudit };
