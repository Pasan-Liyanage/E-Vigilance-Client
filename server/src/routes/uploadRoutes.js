const express = require('express');
const ReportController = require('../controllers/reportController');
const AuthMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', AuthMiddleware.authenticate, ReportController.presignUpload);

module.exports = router;
