'use strict';

/**
 * Routes: Laporan
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateBody, validateQuery } = require('../middlewares/validate.middleware');
const { sendError } = require('../utils/response');
const {
  createLaporanSchema,
  updateLaporanSchema,
  laporanListQuerySchema,
  laporanIdParamsSchema,
  laporanItemParamsSchema,
  laporanKNASchema,
  laporanPenumpangSchema,
  laporanBarangSchema,
  laporanKeuanganSchema,
  resubmitLaporanSchema,
  unlockLaporanSchema,
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
  unlockLaporan,
  resubmitLaporan,
} = require('../controllers/laporan.controller');

const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const errors = result.error.errors.map((error) => ({
      field: error.path.join('.'),
      message: error.message,
    }));
    return sendError(res, 'Parameter URL tidak valid', 422, errors);
  }
  req.params = result.data;
  return next();
};

router.use(authenticate);

// Laporan induk
router.get('/', validateQuery(laporanListQuerySchema), getAllLaporan);
router.get('/:id', validateParams(laporanIdParamsSchema), getLaporanById);
router.post('/', authorize('USER_UNIT'), validateBody(createLaporanSchema), createLaporan);
router.put('/:id', validateParams(laporanIdParamsSchema), validateBody(updateLaporanSchema), updateLaporan);
router.post(
  '/:id/resubmit',
  authorize('USER_UNIT'),
  validateParams(laporanIdParamsSchema),
  validateBody(resubmitLaporanSchema),
  resubmitLaporan
);
router.delete(
  '/:id',
  authorize('USER_UNIT'),
  validateParams(laporanIdParamsSchema),
  deleteLaporan
);
router.post(
  '/:id/unlock',
  authorize('USER_UNIT'),
  validateParams(laporanIdParamsSchema),
  validateBody(unlockLaporanSchema),
  unlockLaporan
);

// Sub-laporan KNA
router.put(
  '/:id/kna',
  authorize('USER_UNIT'),
  validateParams(laporanIdParamsSchema),
  validateBody(laporanKNASchema),
  upsertLaporanKNA
);

// Sub-laporan Penumpang
router.get(
  '/:id/penumpang',
  validateParams(laporanIdParamsSchema),
  getLaporanPenumpang
);
router.post(
  '/:id/penumpang',
  authorize('USER_UNIT'),
  validateParams(laporanIdParamsSchema),
  validateBody(laporanPenumpangSchema),
  createLaporanPenumpang
);
router.put(
  '/:id/penumpang/:itemId',
  authorize('USER_UNIT'),
  validateParams(laporanItemParamsSchema),
  validateBody(laporanPenumpangSchema),
  updateLaporanPenumpang
);
router.delete(
  '/:id/penumpang/:itemId',
  authorize('USER_UNIT'),
  validateParams(laporanItemParamsSchema),
  deleteLaporanPenumpang
);

// Sub-laporan Barang
router.get(
  '/:id/barang',
  validateParams(laporanIdParamsSchema),
  getLaporanBarang
);
router.post(
  '/:id/barang',
  authorize('USER_UNIT'),
  validateParams(laporanIdParamsSchema),
  validateBody(laporanBarangSchema),
  createLaporanBarang
);
router.put(
  '/:id/barang/:itemId',
  authorize('USER_UNIT'),
  validateParams(laporanItemParamsSchema),
  validateBody(laporanBarangSchema),
  updateLaporanBarang
);
router.delete(
  '/:id/barang/:itemId',
  authorize('USER_UNIT'),
  validateParams(laporanItemParamsSchema),
  deleteLaporanBarang
);

// Sub-laporan Keuangan
router.put(
  '/:id/keuangan',
  authorize('USER_UNIT'),
  validateParams(laporanIdParamsSchema),
  validateBody(laporanKeuanganSchema),
  upsertLaporanKeuangan
);

module.exports = router;
