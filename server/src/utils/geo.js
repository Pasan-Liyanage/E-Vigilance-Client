/**
 * Distances and station areas, ported unchanged from the admin system's
 * core/geo.js so both sides choose the same police station for a point.
 */

/** Great-circle distance in km. @param {{lat:number,lng:number}} a @param {{lat:number,lng:number}} b */
function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The polygons of a Polygon or MultiPolygon, as lists of rings. */
const polygonsOf = (area) => (area.type === 'Polygon' ? [area.coordinates] : area.coordinates);

/** Ray casting: is [lng, lat] inside the ring? */
function inRing(ring, lng, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi = 0, yi = 0] = ring[i] ?? [];
    const [xj = 0, yj = 0] = ring[j] ?? [];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether an area contains a point: inside the outer ring and outside every hole. */
function areaContains(area, lat, lng) {
  return polygonsOf(area).some(
    ([outer, ...holes]) => Boolean(outer) && inRing(outer, lng, lat) && !holes.some((h) => inRing(h, lng, lat))
  );
}

/** Approximate size of an area in km², to prefer the smallest of overlapping areas. */
function areaSizeKm2(area) {
  const ringArea = (ring) => {
    const lat0 = ((ring[0]?.[1] ?? 0) * Math.PI) / 180;
    const kx = 111.32 * Math.cos(lat0);
    const ky = 110.57;
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi = 0, yi = 0] = ring[i] ?? [];
      const [xj = 0, yj = 0] = ring[j] ?? [];
      sum += xj * kx * (yi * ky) - xi * kx * (yj * ky);
    }
    return Math.abs(sum) / 2;
  };
  return polygonsOf(area).reduce(
    (total, [outer, ...holes]) =>
      total + (outer ? ringArea(outer) : 0) - holes.reduce((h, ring) => h + ringArea(ring), 0),
    0
  );
}

module.exports = { distanceKm, areaContains, areaSizeKm2 };
