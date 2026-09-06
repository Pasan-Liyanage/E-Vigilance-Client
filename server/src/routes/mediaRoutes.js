const express = require('express');
const ReportController = require('../controllers/reportController');

const router = express.Router();

// Public so <img>/<video> tags (and the admin panel) can load evidence directly.
router.get('/:id', ReportController.streamMedia);

module.exports = router;
