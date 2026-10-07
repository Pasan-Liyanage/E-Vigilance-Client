const express = require('express');
const ReportController = require('../controllers/reportController');

const router = express.Router();

// Public so <img>/<video> tags (and the admin panel) can load evidence directly.
// R2 keys are unguessable (timestamp + 64 random bits), so the link is the secret.
router.get(/^\/r2\/(.+)$/, ReportController.redirectR2Media);
router.get('/:id', ReportController.streamMedia);

module.exports = router;
