/**
 * Middleware: Audit Log
 * Otomatis mencatat aksi pengguna ke tabel log_audit
 */
const prisma = require('../config/database');

/**
 * Factory middleware untuk mencatat audit log
 * @param {string} aksi - Nama aksi (contoh: 'CREATE_LAPORAN')
 * @param {function} detailFn - Fungsi untuk menghasilkan detail log dari req
 */
const auditLog = (aksi, detailFn) => {
  return async (req, res, next) => {
    // Simpan fungsi original json
    const originalJson = res.json.bind(res);

    res.json = async (body) => {
      // Hanya catat jika request berhasil dan pengguna sudah login
      if (body?.success && req.pengguna?.id_pengguna) {
        try {
          const detail = detailFn
            ? detailFn(req, body)
            : JSON.stringify({ body: req.body });

          await prisma.logAudit.create({
            data: {
              aksi,
              detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
              id_pengguna: req.pengguna.id_pengguna,
            },
          });
        } catch (err) {
          console.error('[AUDIT LOG ERROR]', err.message);
          // Jangan crash request karena audit log gagal
        }
      }
      return originalJson(body);
    };

    next();
  };
};

module.exports = { auditLog };
