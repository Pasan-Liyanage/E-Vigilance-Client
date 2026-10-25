const RewardService = require('../services/rewardService');

/** HTTP layer for the citizen's rewards and payout requests. */
class RewardController {
  /** GET /api/rewards - balance, reward lines, payouts and eligibility. */
  summary = async (req, res, next) => {
    try {
      res.json({ rewards: await RewardService.summary(req.user) });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/rewards/payouts - ask for the available points to be paid out. */
  requestPayout = async (req, res, next) => {
    try {
      const result = await RewardService.requestPayout(req.user, req.body || {});
      res.status(201).json({ message: 'Payout requested', ...result });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new RewardController();
