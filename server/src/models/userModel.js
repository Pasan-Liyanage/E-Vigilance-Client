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

  /** True when an account already uses this NIC. */
  async nicExists(nic) {
    const count = await User.countDocuments({ nic: String(nic).trim() });
    return count > 0;
  }

  /** Updates the editable profile fields and returns the fresh document. */
  async updateProfile(userId, updates) {
    return User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });
  }
}

module.exports = new UserModel();
module.exports.User = User;
