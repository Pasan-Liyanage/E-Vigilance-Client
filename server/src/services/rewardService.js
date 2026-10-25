const { collection } = require('../models/shared');
const { publicUser } = require('./authService');
const ApiError = require('../utils/ApiError');
const { ageOf } = require('../utils/srilanka');

/** The fewest confirmed points a payout can be asked for (admin docs/16 §6). */
const MIN_PAYOUT_POINTS = 100;
/** Payout statuses still waiting on the police side. */
const OPEN = new Set(['requested', 'batched', 'failed']);

/**
 * Rewards as the admin system keeps them in `reward_accounts` (its docs/11
 * §6, docs/16), and the citizen's payout requests (`payout_requests`,
 * written here). Simulated until a real payment channel is approved.
 */
class RewardService {
  /** The reward account document, or null before the first reward. */
  async accountOf(userId) {
    return collection('rewardAccounts').findOne({ userId: String(userId) });
  }

  /** True while the citizen is suspended from reporting (admin docs/02 §10). */
  async isSuspended(userId) {
    const account = await this.accountOf(userId);
    return account?.status === 'suspended';
  }

  /**
   * Everything the rewards screen shows. Staff-only details (why an account
   * was flagged) are never passed on.
   */
  async summary(user) {
    const account = await this.accountOf(user._id);
    const me = publicUser(user);
    const balance = account?.balance || {};
    const open = await this.#openRequest(user._id, account);
    return {
      status: account?.status || 'active',
      suspended: account?.status === 'suspended',
      frozen: Boolean(account?.rewards?.frozen),
      excluded: Boolean(account?.rewards?.excluded),
      eligibility: {
        phoneVerified: me.phoneVerified,
        nicVerified: me.nicVerified,
        adult: Boolean(user.dateOfBirth) && ageOf(user.dateOfBirth) >= 18,
        eligible: me.rewardEligible,
      },
      balance: {
        pending: balance.pending || 0,
        available: balance.available || 0,
        inPayout: balance.inPayout || 0,
        paidOut: balance.paidOut || 0,
        expiringSoon: balance.expiringSoon || 0,
      },
      ledger: (account?.ledger || []).map((l) => ({
        reportNumber: l.reportNumber,
        points: l.points,
        status: l.status,
        message: l.message || null,
        at: l.at,
      })),
      payouts: (account?.payouts || []).map((p) => ({
        status: p.status,
        points: p.points,
        amount: p.amount,
        reference: p.reference || null,
        message: p.message || null,
        at: p.at,
      })),
      minPayoutPoints: MIN_PAYOUT_POINTS,
      requestOpen: Boolean(open),
    };
  }

  /**
   * Asks for a payout of the available points. The admin system sets the
   * points aside, pays in weekly batches and answers in `reward_accounts`.
   * @param {object} user
   * @param {{ method?: string, accountNumber?: string, accountName?: string, bankName?: string }} input
   */
  async requestPayout(user, input) {
    const summary = await this.summary(user);
    if (summary.suspended || summary.excluded) {
      throw ApiError.forbidden('This account can no longer receive rewards.');
    }
    if (summary.frozen) {
      throw ApiError.forbidden('Payouts are on hold while your account is reviewed.');
    }
    if (!summary.eligibility.eligible) {
      throw ApiError.forbidden('Verify your phone and NIC (18 or over) to receive rewards.');
    }
    if (summary.requestOpen) {
      throw ApiError.conflict('Your last payout request is still being processed.');
    }
    if (summary.balance.available < MIN_PAYOUT_POINTS) {
      throw ApiError.badRequest(
        `You need at least ${MIN_PAYOUT_POINTS} confirmed points to ask for a payout.`
      );
    }

    const method = input.method === 'wallet' ? 'wallet' : input.method === 'bank' ? 'bank' : null;
    if (!method) throw ApiError.badRequest('Choose a bank account or a mobile wallet.');
    const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
    if (accountNumber.length < 6 || accountNumber.length > 20) {
      throw ApiError.badRequest(
        method === 'bank' ? 'Enter your bank account number.' : 'Enter your wallet number.'
      );
    }
    const accountName = String(input.accountName || '').trim().slice(0, 120);
    if (accountName.length < 3) throw ApiError.badRequest("Enter the account holder's name.");
    const bankName = method === 'bank' ? String(input.bankName || '').trim().slice(0, 80) : null;
    if (method === 'bank' && !bankName) throw ApiError.badRequest('Enter the name of your bank.');

    await collection('payoutRequests').insertOne({
      userId: String(user._id),
      method,
      ...(method === 'bank' ? { accountNumber, bankName } : { walletNumber: accountNumber }),
      accountName,
      createdAt: new Date(),
    });
    return { requested: true, account: `•••• ${accountNumber.slice(-4)}` };
  }

  /**
   * The citizen's latest request while the police haven't finished with it:
   * not yet read by the admin system, or still requested, batched or failed.
   */
  async #openRequest(userId, account) {
    const [last] = await collection('payoutRequests')
      .find({ userId: String(userId) })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    if (!last) return null;
    const answer = (account?.payouts || []).find((p) => String(p.requestId) === String(last._id));
    return !answer || OPEN.has(answer.status) ? last : null;
  }
}

module.exports = new RewardService();
module.exports.MIN_PAYOUT_POINTS = MIN_PAYOUT_POINTS;
