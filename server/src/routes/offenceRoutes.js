const express = require('express');
const OffenceController = require('../controllers/offenceController');
const AuthMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', AuthMiddleware.authenticate, OffenceController.list);

module.exports = router;
