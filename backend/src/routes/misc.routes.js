/**
 * Routes: Target, Komoditi, Permintaan, Audit
 */

// === TARGET ===
const targetRouter = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { getAllTarget, createTarget, updateTarget, deleteTarget } = require('../controllers/target.controller');

targetRouter.use(authenticate);
// GET tetap terbuka untuk semua peran yang login (dashboard admin membutuhkannya).
targetRouter.get('/', getAllTarget);
// Tulis target hanya untuk USER_UNIT (menu Target hanya ada di unit).
targetRouter.post('/', authorize('USER_UNIT'), createTarget);
targetRouter.put('/:id', authorize('USER_UNIT'), updateTarget);
targetRouter.delete('/:id', authorize('IT'), deleteTarget);

// === KOMODITI ===
const komoditiRouter = require('express').Router();
const { getAllKomoditi, createKomoditi, updateKomoditi, deleteKomoditi } = require('../controllers/komoditi.controller');

komoditiRouter.use(authenticate);
komoditiRouter.get('/', getAllKomoditi);
komoditiRouter.post('/', authorize('IT', 'ADMIN_GLOBAL'), createKomoditi);
komoditiRouter.put('/:id', authorize('IT', 'ADMIN_GLOBAL'), updateKomoditi);
komoditiRouter.delete('/:id', authorize('IT'), deleteKomoditi);

// === PERMINTAAN BANTUAN ===
const permintaanRouter = require('express').Router();
const { getAllPermintaan, createPermintaan, tanggapiPermintaan } = require('../controllers/permintaan.controller');
const { validateBody, validateQuery } = require('../middlewares/validate.middleware');
const { sendError } = require('../utils/response');
const {
  createPermintaanSchema,
  tanggapiPermintaanSchema,
  permintaanIdParamsSchema,
  permintaanListQuerySchema,
} = require('../schemas/permintaan.schema');

const validatePermintaanParams = (schema) => (req, res, next) => {
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

permintaanRouter.use(authenticate);
permintaanRouter.get('/', validateQuery(permintaanListQuerySchema), getAllPermintaan);
permintaanRouter.post(
  '/',
  authorize('USER_UNIT'),
  validateBody(createPermintaanSchema),
  createPermintaan
);
permintaanRouter.patch(
  '/:id/tanggapi',
  authorize('IT', 'ADMIN_GLOBAL'),
  validatePermintaanParams(permintaanIdParamsSchema),
  validateBody(tanggapiPermintaanSchema),
  tanggapiPermintaan
);

// === AUDIT LOG ===
const auditRouter = require('express').Router();
const { getAllLogAudit } = require('../controllers/audit.controller');

auditRouter.use(authenticate);
auditRouter.get('/', authorize('IT'), getAllLogAudit);

// === SYSTEM STATS ===
const systemRouter = require('express').Router();
const { getSystemStats } = require('../controllers/system.controller');

systemRouter.use(authenticate);
systemRouter.get('/stats', authorize('IT', 'ADMIN_GLOBAL'), getSystemStats);

// === PROGRAM BARANG TAHUNAN ===
const programRouter = require('express').Router();
const { getAllProgram, saveBulkProgram } = require('../controllers/program.controller');

programRouter.use(authenticate);
programRouter.get('/', getAllProgram);
programRouter.put('/', authorize('IT', 'USER_UNIT'), saveBulkProgram);

module.exports = { targetRouter, komoditiRouter, permintaanRouter, auditRouter, systemRouter, programRouter };
