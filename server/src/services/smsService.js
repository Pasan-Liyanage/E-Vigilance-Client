const ApiError = require('../utils/ApiError');

/** The sender name every citizen message carries (admin docs/09 N5). */
const SENDER = 'Sri Lanka Police - E-Vigilance';

/**
 * Sends SMS through the configured provider (SMS_PROVIDER):
 *   console - development only: the message is written to the server log
 *   demo    - demonstrations: nothing is sent, and the app shows the code on
 *             screen, clearly labelled as demo mode. Never for real citizens
 *   none    - SMS is off; sending fails with a clear message (the default
 *             in production until a provider is configured)
 *
 * A real gateway (Dialog, Mobitel, a GovSMS service) plugs in here as one
 * more provider with the same `send(to, text)`.
 */
class SmsService {
  get provider() {
    const configured = (process.env.SMS_PROVIDER || '').toLowerCase();
    if (configured) return configured;
    return process.env.NODE_ENV === 'production' ? 'none' : 'console';
  }

  /** True when a code can be delivered to a phone (or shown, in demo mode). */
  get enabled() {
    return this.provider !== 'none';
  }

  /** True in demo mode: codes are returned to the app instead of texted. */
  get demo() {
    return this.provider === 'demo';
  }

  /**
   * @param {string} to   +94 number
   * @param {string} text the message, without the sender name
   */
  async send(to, text) {
    switch (this.provider) {
      case 'console':
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SMS_PROVIDER=console is for development only.');
        }
        console.log(`[sms] to ${to}: ${SENDER}: ${text}`);
        return;
      case 'demo':
        // The caller hands the code to the app; no message leaves the server.
        return;
      case 'none':
        throw new ApiError(503, 'Text messages are not available yet. Please try again later.');
      default:
        throw new Error(`Unknown SMS_PROVIDER "${this.provider}".`);
    }
  }
}

const sms = new SmsService();

// Said on every start, so demo mode is never left on by accident.
if (sms.demo) {
  console.warn(
    '[sms] DEMO MODE: no text messages are sent; verification codes are shown in the app. ' +
      'Do not use with real citizens.'
  );
}

module.exports = sms;
