const mongoose = require('mongoose');
const userSchema = require('./schemas/userSchema');

const User = mongoose.models.User || mongoose.model('User', userSchema);

/** Data-access layer for citizen accounts. */
class UserModel {
  /** Creates a user document. `userData.password` must already be hashed. */
  async createUser(userData) {
    const user = new User(userData);
    await user.save();
    return user;
  }

  /** Finds a user by email, including the password hash (needed at login). */
  async findByEmail(email) {
    return User.findOne({ email: String(email).toLowerCase().trim() });
  }

  /** Finds a user by id. */
  async findById(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    return User.findById(userId);
  }

  /** True when an account already uses this email. */
  async emailExists(email) {
    const count = await User.countDocuments({
      email: String(email).toLowerCase().trim(),
    });
    return count > 0;
  }

  /**
   * True when an account already uses this NIC. `nic` is canonical; accounts
   * created before NICs were normalised may hold a lower-case "v" or "x".
   */
  async nicExists(nic) {
    const count = await User.countDocuments({ nic: { $in: [nic, nic.toLowerCase()] } });
    return count > 0;
  }

  /** Updates fields and returns the fresh document. */
  async updateProfile(userId, updates) {
    return User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Removes the personal details of a deleted account. The document stays so
   * the citizen's reports keep a valid owner id; it can't be signed in to.
   */
  async anonymise(userId, session) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          name: 'Deleted account',
          email: `deleted-${userId}@deleted.invalid`,
          nic: null,
          phone: null,
          dateOfBirth: null,
          phoneVerified: false,
          nicVerified: false,
          phoneCode: null,
          password: null,
          deletedAt: new Date(),
        },
      },
      { session }
    );
  }
}

module.exports = new UserModel();
module.exports.User = User;
