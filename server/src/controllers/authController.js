const AuthService = require('../services/authService');
const { publicUser } = require('../services/authService');

/** HTTP layer for authentication and the citizen's own account. */
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
      const user = await AuthService.updateProfile(req.user, {
        name: req.body.name,
        phone: req.body.phone,
      });
      res.json({ message: 'Profile updated', user });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/auth/phone/code - send a one-time code to the account's phone. */
  sendPhoneCode = async (req, res, next) => {
    try {
      res.json({ message: 'Code sent', ...(await AuthService.sendPhoneCode(req.user)) });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/auth/phone/verify - check the code; the phone is then verified. */
  verifyPhone = async (req, res, next) => {
    try {
      const user = await AuthService.verifyPhoneCode(req.user, req.body.code);
      res.json({ message: 'Phone number verified', user });
    } catch (err) {
      next(err);
    }
  };

  /** DELETE /api/auth/me - delete the account (password required). */
  deleteMe = async (req, res, next) => {
    try {
      await AuthService.deleteAccount(req.user, req.body?.password);
      res.json({ message: 'Your account has been deleted.' });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new AuthController();
