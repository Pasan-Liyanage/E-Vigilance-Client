const express = require('express');
const AuthController = require('../controllers/authController');
const AuthMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', AuthMiddleware.authenticate, AuthController.me);
router.patch('/me', AuthMiddleware.authenticate, AuthController.updateMe);

module.exports = router;
