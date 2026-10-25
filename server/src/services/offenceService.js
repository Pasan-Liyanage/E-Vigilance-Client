const { collection } = require('../models/shared');
const ApiError = require('../utils/ApiError');

/**
 * The offences citizens can report, published by the admin system in
 * `offence_schedule_public` (its docs/11 §3): code, plain name, description
 * and the vehicle types each applies to. No fines are published.
 */
class OffenceService {
  /** Every reportable offence, in the admin system's order. */
  async list() {
    const rows = await collection('publicOffences')
      .find({}, { projection: { _id: 0, code: 1, name: 1, description: 1, vehicleTypes: 1, sortOrder: 1 } })
      .sort({ sortOrder: 1, name: 1 })
      .toArray();
    return rows.map(({ code, name, description, vehicleTypes }) => ({
      code,
      name,
      description,
      vehicleTypes: vehicleTypes || [],
    }));
  }

  /**
   * The offences for the codes a report names; every code must be published.
   * @param {unknown} codes
   */
  async resolve(codes) {
    const list = Array.isArray(codes) ? codes : [];
    const wanted = [...new Set(list.map((c) => String(c).trim()).filter(Boolean))];
    if (!wanted.length) throw ApiError.badRequest('Choose at least one offence.');
    if (wanted.length > 5) throw ApiError.badRequest('Choose at most five offences.');

    const found = await collection('publicOffences')
      .find({ code: { $in: wanted } }, { projection: { _id: 0, code: 1, name: 1 } })
      .toArray();
    if (found.length !== wanted.length) {
      throw ApiError.badRequest('One of the offences is no longer listed. Please choose again.');
    }
    return wanted.map((code) => found.find((o) => o.code === code));
  }
}

module.exports = new OffenceService();
