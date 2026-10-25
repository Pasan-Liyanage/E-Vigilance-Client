const express = require('express');
const RewardController = require('../controllers/rewardController');
const AuthMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', AuthMiddleware.authenticate, RewardController.summary);
router.post('/payouts', AuthMiddleware.authenticate, RewardController.requestPayout);

module.exports = router;
