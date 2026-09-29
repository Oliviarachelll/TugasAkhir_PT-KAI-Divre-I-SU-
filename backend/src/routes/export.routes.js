const router = require('express').Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validate.middleware');
const { exportLaporanSchema } = require('../schemas/export.schema');
const { exportLaporan } = require('../controllers/export.controller');

router.use(authenticate);
router.post('/laporan/:format', validateBody(exportLaporanSchema), exportLaporan);

module.exports = router;
