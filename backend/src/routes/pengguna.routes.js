/**
 * Routes: Pengguna
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validate.middleware');
const { createPenggunaSchema, updatePenggunaSchema } = require('../schemas/pengguna.schema');
const {
  getAllPengguna,
  getPenggunaById,
  createPengguna,
  updatePengguna,
  deletePengguna,
  unlockPengguna,
} = require('../controllers/pengguna.controller');

// Semua route pengguna butuh auth
router.use(authenticate);

router.get('/', authorize('IT', 'ADMIN_GLOBAL'), getAllPengguna);
router.get('/:id', authorize('IT', 'ADMIN_GLOBAL'), getPenggunaById);
router.post('/', authorize('IT', 'ADMIN_GLOBAL'), validateBody(createPenggunaSchema), createPengguna);
router.put('/:id', authorize('IT', 'ADMIN_GLOBAL'), validateBody(updatePenggunaSchema), updatePengguna);
router.delete('/:id', authorize('IT'), deletePengguna);
router.patch('/:id/unlock', authorize('IT', 'ADMIN_GLOBAL'), unlockPengguna);

module.exports = router;
