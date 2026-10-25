const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const UserModel = require('../models/userModel');
const { collection } = require('../models/shared');
const SmsService = require('./smsService');
const ApiError = require('../utils/ApiError');
const {
  normalizeNic, birthDateFromNic, ageOf, normalizePhone, isMobile,
} = require('../utils/srilanka');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
/** Passwords too common to allow, whatever their length. */
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwertyui', 'qwerty123', '11111111', '00000000', 'iloveyou', 'abcd1234',
  'evigilance', 'srilanka', 'police123',
]);

/** One-time phone codes (admin docs/11 §6: verification is done in the app). */
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_MS = 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;

/** Registration, login, verification and account deletion for citizens. */
class AuthService {
  /** Creates an account and returns { token, user }. */
  async register({ name, email, nic, phone, dateOfBirth, password }) {
    name = String(name || '').trim();
    email = String(email || '').toLowerCase().trim();
    password = String(password || '');
    const canonicalNic = normalizeNic(nic);
    const canonicalPhone = normalizePhone(phone);
    const born = parseDate(dateOfBirth);

    if (!name || !email || !nic || !phone || !dateOfBirth || !password) {
      throw ApiError.badRequest(
        'Name, email, NIC, phone, date of birth and password are all required.'
      );
    }
    if (name.length < 3) throw ApiError.badRequest('Please enter your full name.');
    if (!EMAIL_RE.test(email)) throw ApiError.badRequest('Please enter a valid email address.');
    if (!canonicalNic) {
      throw ApiError.badRequest('Enter your NIC as 9 digits and V or X, or as 12 digits.');
    }
    if (!canonicalPhone || !isMobile(canonicalPhone)) {
      throw ApiError.badRequest('Enter a Sri Lankan mobile number, for example 077 123 4567.');
    }
    if (!born || born > new Date()) throw ApiError.badRequest('Enter a valid date of birth.');
    checkPassword(password);

    if (await UserModel.emailExists(email)) {
      throw ApiError.conflict('An account with this email already exists.');
    }
    if (await UserModel.nicExists(canonicalNic)) {
      throw ApiError.conflict('An account with this NIC already exists.');
    }

    const user = await UserModel.createUser({
      name,
      email,
      nic: canonicalNic,
      phone: canonicalPhone,
      dateOfBirth: born,
      nicVerified: nicMatchesBirth(canonicalNic, born),
      phoneVerified: false,
      password: await bcrypt.hash(password, 10),
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
    if (!user || user.deletedAt) throw ApiError.unauthorized('Invalid email or password.');

    // Staff accounts of the previous admin panel live in the same collection
    // but use a different hashing scheme - they belong in the admin dashboard.
    if (!user.password) {
      throw ApiError.forbidden(
        'This account belongs to the admin dashboard. Please sign in there instead.'
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw ApiError.unauthorized('Invalid email or password.');

    return { token: this.generateToken(user._id), user: publicUser(user) };
  }

  /**
   * Updates the editable profile fields. A new phone number must be verified
   * again; the NIC and date of birth are fixed once the account exists.
   */
  async updateProfile(user, { name, phone }) {
    const updates = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 3) throw ApiError.badRequest('Please enter your full name.');
      updates.name = trimmed;
    }
    if (phone !== undefined) {
      const canonical = normalizePhone(phone);
      if (!canonical || !isMobile(canonical)) {
        throw ApiError.badRequest('Enter a Sri Lankan mobile number, for example 077 123 4567.');
      }
      if (canonical !== user.phone) {
        updates.phone = canonical;
        updates.phoneVerified = false;
        updates.phoneCode = null;
      }
    }
    return publicUser(await UserModel.updateProfile(user._id, updates));
  }

  /** Sends a one-time code to the account's phone. */
  async sendPhoneCode(user) {
    if (user.phoneVerified) throw ApiError.badRequest('Your phone number is already verified.');
    if (!user.phone || !isMobile(user.phone)) {
      throw ApiError.badRequest('Add a mobile number to your profile first.');
    }
    const last = user.phoneCode?.sentAt?.getTime() ?? 0;
    if (Date.now() - last < CODE_RESEND_MS) {
      throw new ApiError(429, 'Please wait a minute before asking for another code.');
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await SmsService.send(user.phone, `Your verification code is ${code}. It expires in 10 minutes.`);
    await UserModel.updateProfile(user._id, {
      phoneCode: {
        hash: codeHash(user._id, code),
        phone: user.phone,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        attempts: 0,
        sentAt: new Date(),
      },
    });
    return {
      sentTo: maskPhone(user.phone),
      expiresInMinutes: CODE_TTL_MS / 60000,
      // Demo mode only: nothing was texted, so the app shows the code instead.
      ...(SmsService.demo ? { demoCode: code } : {}),
    };
  }

  /** Checks a one-time code; on success the phone is verified. */
  async verifyPhoneCode(user, code) {
    const pending = user.phoneCode;
    if (!pending || pending.phone !== user.phone) {
      throw ApiError.badRequest('Ask for a verification code first.');
    }
    if (pending.expiresAt < new Date()) {
      throw ApiError.badRequest('That code has expired. Ask for a new one.');
    }
    if (pending.attempts >= CODE_MAX_ATTEMPTS) {
      throw ApiError.badRequest('Too many wrong codes. Ask for a new one.');
    }
    const given = String(code || '').replace(/\D/g, '');
    const expected = Buffer.from(pending.hash, 'hex');
    const actual = Buffer.from(codeHash(user._id, given), 'hex');
    if (given.length !== 6 || !crypto.timingSafeEqual(expected, actual)) {
      await UserModel.updateProfile(user._id, { 'phoneCode.attempts': pending.attempts + 1 });
      throw ApiError.badRequest('That code is not right. Check the message and try again.');
    }
    return publicUser(
      await UserModel.updateProfile(user._id, { phoneVerified: true, phoneCode: null })
    );
  }

  /**
   * Deletes the citizen's account (admin docs/10 §5.5). Reports stay with the
   * police; the admin system anonymises their link to this account when it
   * reads `account_deletions`. Personal details are removed here at once.
   */
  async deleteAccount(user, password) {
    if (!user.password || !(await bcrypt.compare(String(password || ''), user.password))) {
      throw ApiError.unauthorized('That password is not right.');
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await collection('accountDeletions').insertOne(
          { userId: String(user._id), deletedAt: new Date() },
          { session }
        );
        await UserModel.anonymise(user._id, session);
      });
    } finally {
      await session.endSession();
    }
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

/** Long enough and not one of the most common passwords. */
function checkPassword(password) {
  if (password.length < MIN_PASSWORD) {
    throw ApiError.badRequest(`Password must be at least ${MIN_PASSWORD} characters long.`);
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw ApiError.badRequest('That password is too common. Please choose another.');
  }
}

/** "YYYY-MM-DD" (or an ISO date) as midnight UTC, or null. */
function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The app's own NIC check (admin docs/11 D11-3): a well-formed NIC whose
 * encoded birth date matches the one given. A registry check can replace
 * this when one is available.
 */
function nicMatchesBirth(nic, born) {
  const encoded = birthDateFromNic(nic);
  return Boolean(encoded && born && encoded.getTime() === born.getTime());
}

/** Codes are stored only as a keyed hash. */
function codeHash(userId, code) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'phone-code')
    .update(`${userId}:${code}`)
    .digest('hex');
}

/** "+94 77 *** 4567" */
const maskPhone = (phone) => `+94 ${phone.slice(3, 5)} *** ${phone.slice(-4)}`;

/** What the client may see of a user. */
function publicUser(user) {
  const adult = user.dateOfBirth ? ageOf(user.dateOfBirth) >= 18 : false;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    nic: user.nic,
    phone: user.phone || null,
    dateOfBirth: user.dateOfBirth || null,
    phoneVerified: Boolean(user.phoneVerified),
    nicVerified: Boolean(user.nicVerified),
    // The admin system pays rewards only to verified adults (its docs/16 §3).
    rewardEligible: Boolean(user.phoneVerified && user.nicVerified && adult),
    smsAvailable: SmsService.enabled,
    smsDemo: SmsService.demo,
    role: user.role || 'user',
    createdAt: user.createdAt,
  };
}

module.exports = new AuthService();
module.exports.publicUser = publicUser;
