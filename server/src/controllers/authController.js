const AuthService = require('../services/authService');
const { publicUser } = require('../services/authService');
const UserModel = require('../models/userModel');

/** HTTP layer for authentication. */
class AuthController {
  /** POST /api/auth/register */
  register = async (req, res, next) => {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({ message: 'Account created successfully', ...result });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/auth/login */
  login = async (req, res, next) => {
    try {
      const result = await AuthService.login(req.body.email, req.body.password);
      res.json({ message: 'Signed in successfully', ...result });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/auth/me - used by the PWA to restore a session on load. */
  me = async (req, res) => {
    res.json({ user: publicUser(req.user) });
  };

  /** PATCH /api/auth/me - update the citizen's own profile. */
  updateMe = async (req, res, next) => {
    try {
      const updates = {};
      if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
      if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim() || null;
      const user = await UserModel.updateProfile(req.userId, updates);
      res.json({ message: 'Profile updated', user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new AuthController();
