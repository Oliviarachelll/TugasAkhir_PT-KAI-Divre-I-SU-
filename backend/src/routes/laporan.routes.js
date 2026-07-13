/**
 * Routes: Laporan
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validate.middleware');
const {
  createLaporanSchema,
  updateLaporanSchema,
  laporanKNASchema,
  laporanPenumpangSchema,
  laporanBarangSchema,
  laporanKeuanganSchema,
} = require('../schemas/laporan.schema');
const {
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
  unlockLaporan
} = require('../controllers/laporan.controller');

router.use(authenticate);

// Laporan induk
router.get('/', getAllLaporan);
router.get('/:id', getLaporanById);
router.post('/', validateBody(createLaporanSchema), createLaporan);
router.put('/:id', validateBody(updateLaporanSchema), updateLaporan);
router.delete('/:id', authorize('IT', 'ADMIN_GLOBAL'), deleteLaporan);
router.post('/:id/unlock', unlockLaporan);

// Sub-laporan KNA
router.put('/:id/kna', validateBody(laporanKNASchema), upsertLaporanKNA);

// Sub-laporan Penumpang
router.get('/:id/penumpang', getLaporanPenumpang);
router.post('/:id/penumpang', validateBody(laporanPenumpangSchema), createLaporanPenumpang);
router.put('/:id/penumpang/:itemId', validateBody(laporanPenumpangSchema), updateLaporanPenumpang);
router.delete('/:id/penumpang/:itemId', deleteLaporanPenumpang);

// Sub-laporan Barang
router.get('/:id/barang', getLaporanBarang);
router.post('/:id/barang', validateBody(laporanBarangSchema), createLaporanBarang);
router.put('/:id/barang/:itemId', validateBody(laporanBarangSchema), updateLaporanBarang);
router.delete('/:id/barang/:itemId', deleteLaporanBarang);

// Sub-laporan Keuangan
router.put('/:id/keuangan', validateBody(laporanKeuanganSchema), upsertLaporanKeuangan);

module.exports = router;
