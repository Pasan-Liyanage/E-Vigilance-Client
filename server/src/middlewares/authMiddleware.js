const AuthService = require('../services/authService');
const UserModel = require('../models/userModel');
const ApiError = require('../utils/ApiError');

/** Verifies the Bearer JWT and attaches req.userId / req.user. */
class AuthMiddleware {
  authenticate = async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
      if (!token) throw ApiError.unauthorized('Authentication required. Please sign in.');

      const decoded = AuthService.verifyToken(token);
      const user = await UserModel.findById(decoded.userId);
      if (!user) throw ApiError.unauthorized('This account no longer exists.');

      req.userId = String(user._id);
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new AuthMiddleware();
