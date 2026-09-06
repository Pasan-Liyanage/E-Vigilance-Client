const express = require('express');
const ReportController = require('../controllers/reportController');
const AuthMiddleware = require('../middlewares/authMiddleware');
const { handleUploadErrors } = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.post('/', AuthMiddleware.authenticate, handleUploadErrors, ReportController.create);
router.get('/', AuthMiddleware.authenticate, ReportController.getUserReports);
router.get('/stats', AuthMiddleware.authenticate, ReportController.getStats);
router.get('/:id', AuthMiddleware.authenticate, ReportController.getOne);

module.exports = router;
