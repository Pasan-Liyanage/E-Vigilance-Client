/**
 * Turning a typed location into map coordinates.
 *
 * The admin panel routes every report to the nearest police station, which
 * needs a latitude/longitude. Reports used to be accepted with only a typed
 * address, and those could not be dispatched automatically.
 */

function valid(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Sri Lanka's bounding box, the same as the server's (server/src/utils/srilanka.js). */
export function insideSriLanka(latitude, longitude) {
  return latitude >= 5.85 && latitude <= 9.9 && longitude >= 79.5 && longitude <= 81.95;
}

/**
 * Places in Sri Lanka matching a search, from OpenStreetMap: up to five, so
 * the citizen picks the right one rather than the first.
 * Returns [{ latitude, longitude, label }].
 */
export async function searchPlaces(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=lk&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  return (await res.json())
    .map((hit) => ({
      latitude: Number(Number(hit.lat).toFixed(6)),
      longitude: Number(Number(hit.lon).toFixed(6)),
      label: hit.display_name,
    }))
    .filter((p) => valid(p.latitude, p.longitude) && insideSriLanka(p.latitude, p.longitude));
}

/** A short address for a point, or null (best effort, OpenStreetMap). */
export async function addressOf(latitude, longitude) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=17`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

function dmsToDecimal(deg, min, sec, dir) {
  const dec = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return /[SW]/i.test(dir) ? -dec : dec;
}

/**
 * Coordinates the user typed themselves, e.g. "6.9271, 79.8612",
 * "Latitude: 8.5874 Longitude: 81.2152" or 8°35'14.6"N 81°12'54.7"E.
 * Returns { latitude, longitude } or null.
 */
export function extractCoordinates(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  const latLabel = /\blat(?:itude)?\s*[:=]?\s*(-?\d{1,2}(?:\.\d+)?)/i.exec(text);
  const lngLabel = /\b(?:lng|lon|long|longitude)\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)/i.exec(text);
  if (latLabel && lngLabel) {
    const lat = Number(latLabel[1]);
    const lng = Number(lngLabel[1]);
    if (valid(lat, lng)) return { latitude: lat, longitude: lng };
  }

  const pair = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/.exec(text);
  if (pair) {
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (valid(lat, lng)) return { latitude: lat, longitude: lng };
  }

  const dms = /(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"\s*([NS])\s+(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"\s*([EW])/i.exec(text);
  if (dms) {
    const lat = dmsToDecimal(dms[1], dms[2], dms[3], dms[4]);
    const lng = dmsToDecimal(dms[5], dms[6], dms[7], dms[8]);
    if (valid(lat, lng)) return { latitude: lat, longitude: lng };
  }

  return null;
}

/**
 * Looks an address up on OpenStreetMap (Sri Lanka only).
 * Returns { latitude, longitude, label } or null when nothing matches.
 */
export async function geocodeAddress(address) {
  const q = String(address || '').trim();
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=lk&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);

  const [hit] = await res.json();
  if (!hit) return null;

  const latitude = Number(Number(hit.lat).toFixed(6));
  const longitude = Number(Number(hit.lon).toFixed(6));
  return valid(latitude, longitude) ? { latitude, longitude, label: hit.display_name } : null;
}
