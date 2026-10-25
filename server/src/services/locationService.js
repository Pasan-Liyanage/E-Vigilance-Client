const ApiError = require('../utils/ApiError');
const { extractCoordinates } = require('../utils/coordinates');
const { insideSriLanka } = require('../utils/srilanka');

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 6000;

/**
 * Only Google Maps addresses are opened, so a pasted link can't make this
 * server fetch anything else: the short links (maps.app.goo.gl,
 * goo.gl/maps), Google Maps pages on any Google domain, and Google's
 * cookie-consent page that may sit between them.
 */
function isGoogleMaps(url) {
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return url.pathname.startsWith('/maps');
  if (host === 'consent.google.com') return true;
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  return /^(www\.)?google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps');
}

const num = (s) => Number(s);
const valid = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/**
 * The pinned place in a full Google Maps address, most precise first:
 *   !3d<lat>!4d<lng>     the place itself (a dropped pin or a business)
 *   q= / query= / ll= / destination=   coordinates given as the search
 *   @<lat>,<lng>,<zoom>  only where the map was centred: a last resort
 * Returns null when the address names a place without coordinates.
 */
function coordinatesInMapsUrl(url) {
  const text = decodeURIComponent(url.href);
  const place = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(text);
  if (place && valid(num(place[1]), num(place[2]))) {
    return { latitude: num(place[1]), longitude: num(place[2]), exact: true };
  }
  for (const key of ['q', 'query', 'll', 'destination', 'daddr']) {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(url.searchParams.get(key) || '');
    if (m && valid(num(m[1]), num(m[2]))) return { latitude: num(m[1]), longitude: num(m[2]), exact: true };
  }
  const centre = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname);
  if (centre && valid(num(centre[1]), num(centre[2]))) {
    return { latitude: num(centre[1]), longitude: num(centre[2]), exact: false };
  }
  return null;
}

/** Follows a Google Maps short link to the full address, without reading the page. */
async function expand(start) {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (url.hostname === 'consent.google.com' && url.searchParams.get('continue')) {
      url = new URL(url.searchParams.get('continue'));
      if (!isGoogleMaps(url)) break;
      continue;
    }
    if (coordinatesInMapsUrl(url)?.exact) return url;
    let res;
    try {
      res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new ApiError(502, "We couldn't open that Google Maps link. Check your connection, or drop the pin on our map.");
    }
    res.body?.cancel();
    const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!next) return url;
    url = new URL(next, url);
    if (!isGoogleMaps(url)) break;
  }
  throw ApiError.badRequest("That link doesn't lead to a Google Maps place. Drop the pin on our map instead.");
}

/**
 * Turns what the citizen pasted, a Google Maps link or typed coordinates,
 * into a place. The citizen still confirms it on the map before sending.
 */
class LocationService {
  /** @param {unknown} raw @returns {Promise<{ latitude: number, longitude: number, exact: boolean }>} */
  async resolve(raw) {
    const text = String(raw ?? '').trim().slice(0, 2000);
    if (!text) throw ApiError.badRequest('Paste a Google Maps link or coordinates first.');

    let place = null;
    const link = /https?:\/\/\S+/i.exec(text)?.[0];
    if (link) {
      let url;
      try {
        url = new URL(link);
      } catch {
        throw ApiError.badRequest("That link isn't complete. Copy it again from Google Maps.");
      }
      if (!isGoogleMaps(url)) {
        throw ApiError.badRequest('Only Google Maps links can be used. Or drop the pin on our map.');
      }
      place = coordinatesInMapsUrl(await expand(url));
      if (!place) {
        throw ApiError.badRequest(
          "That link names a place but not its exact position. In Google Maps, press and hold on the spot to drop a pin, then share that."
        );
      }
    } else {
      const typed = extractCoordinates(text);
      if (!typed) {
        throw ApiError.badRequest('Paste a Google Maps link, or coordinates such as 6.9271, 79.8612.');
      }
      place = { ...typed, exact: true };
    }

    if (!insideSriLanka(place.latitude, place.longitude)) {
      throw ApiError.badRequest('That place is outside Sri Lanka.');
    }
    return {
      latitude: Number(place.latitude.toFixed(6)),
      longitude: Number(place.longitude.toFixed(6)),
      exact: place.exact,
    };
  }
}

module.exports = new LocationService();
module.exports.coordinatesInMapsUrl = coordinatesInMapsUrl;
module.exports.isGoogleMaps = isGoogleMaps;
