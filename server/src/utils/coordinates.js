/**
 * Coordinates typed into the location text, e.g. "6.9271, 79.8612" or
 * "Latitude: 8.5874 Longitude: 81.2152". Safety net for reports from older
 * (cached) PWA builds that allowed submitting without a map pin; the admin
 * panel needs coordinates to route a report to the nearest police station.
 * Mirrors web/src/utils/coordinates.js. Returns { latitude, longitude } or null.
 */
function valid(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function extractCoordinates(text) {
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

  return null;
}

module.exports = { extractCoordinates };
