/**
 * Routes: Target, Komoditi, Permintaan, Audit
 */

// === TARGET ===
const targetRouter = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { getAllTarget, createTarget, updateTarget, deleteTarget } = require('../controllers/target.controller');

targetRouter.use(authenticate);
targetRouter.get('/', getAllTarget);
targetRouter.post('/', authorize('IT', 'ADMIN_GLOBAL'), createTarget);
targetRouter.put('/:id', authorize('IT', 'ADMIN_GLOBAL'), updateTarget);
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

permintaanRouter.use(authenticate);
permintaanRouter.get('/', getAllPermintaan);
permintaanRouter.post('/', createPermintaan);
permintaanRouter.patch('/:id/tanggapi', authorize('IT', 'ADMIN_GLOBAL'), tanggapiPermintaan);

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

module.exports = { targetRouter, komoditiRouter, permintaanRouter, auditRouter, systemRouter };
