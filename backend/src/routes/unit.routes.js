/**
 * Routes: Unit
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  getAllUnit,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
} = require('../controllers/unit.controller');

router.use(authenticate);

router.get('/', getAllUnit);
router.get('/:id', getUnitById);
router.post('/', authorize('IT', 'ADMIN_GLOBAL'), createUnit);
router.put('/:id', authorize('IT', 'ADMIN_GLOBAL'), updateUnit);
router.delete('/:id', authorize('IT', 'ADMIN_GLOBAL'), deleteUnit);

module.exports = router;
