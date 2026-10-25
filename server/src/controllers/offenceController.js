const OffenceService = require('../services/offenceService');

/** HTTP layer for the published offence schedule. */
class OffenceController {
  /** GET /api/offences - the offences a citizen can report. */
  list = async (req, res, next) => {
    try {
      res.json({ offences: await OffenceService.list() });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new OffenceController();
