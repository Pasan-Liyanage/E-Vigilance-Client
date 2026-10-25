const express = require('express');
const ReportController = require('../controllers/reportController');
const MediaAccess = require('../services/mediaAccess');

const router = express.Router();

// Who may open evidence depends on MEDIA_ACCESS (services/mediaAccess.js):
// anyone with the link, or only signed links and the admin system's import.
router.get(/^\/r2\/(.+)$/, MediaAccess.guard, ReportController.redirectR2Media);
router.get('/:id', MediaAccess.guard, ReportController.streamMedia);

module.exports = router;
