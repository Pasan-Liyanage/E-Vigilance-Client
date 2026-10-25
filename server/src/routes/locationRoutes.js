const express = require('express');
const LocationController = require('../controllers/locationController');
const AuthMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/resolve', AuthMiddleware.authenticate, LocationController.resolve);
router.get('/station', AuthMiddleware.authenticate, LocationController.station);

module.exports = router;
