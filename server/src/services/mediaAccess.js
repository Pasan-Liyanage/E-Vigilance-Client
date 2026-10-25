const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

/**
 * Who may open evidence media (admin docs/10 E2: evidence is never shown to
 * the public). MEDIA_ACCESS chooses:
 *
 *   public  - anyone with the link (the default, while the previous admin
 *             panel still displays evidence straight from these links)
 *   signed  - only links this API signed for the report's owner, valid for
 *             an hour, and the admin system's import, which sends the shared
 *             MEDIA_SERVICE_KEY in an X-Media-Key header
 */
const LINK_TTL_SECONDS = 60 * 60;

class MediaAccess {
  get signed() {
    return (process.env.MEDIA_ACCESS || 'public').toLowerCase() === 'signed';
  }

  /** The secret links are signed with. */
  #secret() {
    const secret = process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('MEDIA_SIGNING_SECRET is not configured.');
    return secret;
  }

  #signature(path, expires) {
    return crypto.createHmac('sha256', this.#secret()).update(`${path}:${expires}`).digest('hex');
  }

  /**
   * A media link the owner's browser can open: unchanged in public mode,
   * otherwise with an expiry and a signature.
   * @param {string | null | undefined} url
   */
  link(url) {
    if (!url || !this.signed) return url || null;
    const parsed = new URL(url);
    const expires = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
    parsed.searchParams.set('exp', String(expires));
    parsed.searchParams.set('sig', this.#signature(parsed.pathname, expires));
    return parsed.toString();
  }

  /** Express middleware for the media routes. */
  guard = (req, res, next) => {
    if (!this.signed) return next();

    const serviceKey = process.env.MEDIA_SERVICE_KEY;
    const presented = req.get('x-media-key');
    if (serviceKey && presented && safeEqual(presented, serviceKey)) return next();

    const expires = Number(req.query.exp);
    const signature = String(req.query.sig || '');
    const path = req.originalUrl.split('?')[0];
    if (
      Number.isFinite(expires) &&
      expires > Date.now() / 1000 &&
      signature &&
      safeEqual(signature, this.#signature(path, expires))
    ) {
      return next();
    }
    return next(ApiError.forbidden('This evidence link has expired. Open the report again.'));
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = new MediaAccess();
