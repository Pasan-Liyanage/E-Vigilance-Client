const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const ApiError = require('../utils/ApiError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Registration, login and JWT handling for citizen accounts. */
class AuthService {
  /** Creates an account and returns { token, user }. */
  async register({ name, email, nic, phone, password }) {
    name = String(name || '').trim();
    email = String(email || '').toLowerCase().trim();
    nic = String(nic || '').trim();
    password = String(password || '');

    if (!name || !email || !nic || !password) {
      throw ApiError.badRequest('Name, email, NIC and password are all required.');
    }
    if (!EMAIL_RE.test(email)) throw ApiError.badRequest('Please enter a valid email address.');
    if (password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters long.');
    }
    if (await UserModel.emailExists(email)) {
      throw ApiError.conflict('An account with this email already exists.');
    }
    if (await UserModel.nicExists(nic)) {
      throw ApiError.conflict('An account with this NIC already exists.');
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await UserModel.createUser({
      name,
      email,
      nic,
      phone: phone ? String(phone).trim() : null,
      password: hashed,
      role: 'user',
    });

    return { token: this.generateToken(user._id), user: publicUser(user) };
  }

  /** Verifies credentials and returns { token, user }. */
  async login(email, password) {
    email = String(email || '').toLowerCase().trim();
    password = String(password || '');

    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required.');
    }

    const user = await UserModel.findByEmail(email);
    if (!user) throw ApiError.unauthorized('Invalid email or password.');

    // Admin-panel staff accounts live in the same collection but use a
    // different hashing scheme - they belong in the admin dashboard.
    if (!user.password) {
      throw ApiError.forbidden(
        'This account belongs to the admin dashboard. Please sign in there instead.'
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw ApiError.unauthorized('Invalid email or password.');

    return { token: this.generateToken(user._id), user: publicUser(user) };
  }

  /** Signs a JWT holding the user id. */
  generateToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured.');
    return jwt.sign({ userId: String(userId) }, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  }

  /** Verifies a JWT and returns its payload, or throws 401. */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw ApiError.unauthorized('Your session has expired. Please sign in again.');
    }
  }
}

/** Strips the password hash before sending a user to the client. */
function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    nic: user.nic,
    phone: user.phone || null,
    role: user.role || 'user',
    createdAt: user.createdAt,
  };
}

module.exports = new AuthService();
module.exports.publicUser = publicUser;
