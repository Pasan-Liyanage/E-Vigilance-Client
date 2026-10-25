const { collection } = require('../models/shared');
const { distanceKm, areaContains, areaSizeKm2 } = require('../utils/geo');

/** Stations change rarely; reading them once a few minutes is plenty. */
const CACHE_MS = 5 * 60 * 1000;

/**
 * Which police station a place falls to, by the admin system's own rule
 * (its cases/dispatch.js autoPlan): among active, verified stations, the
 * smallest area that contains the place; with none, the nearest station.
 * Shown to the citizen so a wrong pin is noticed; HQ may still choose
 * another station.
 */
class StationService {
  #cache = { at: 0, stations: [] };

  async #stations() {
    if (Date.now() - this.#cache.at < CACHE_MS) return this.#cache.stations;
    const stations = await collection('stations')
      .find({ isActive: true, verified: true }, { projection: { _id: 0, name: 1, location: 1, area: 1 } })
      .toArray();
    this.#cache = { at: Date.now(), stations };
    return stations;
  }

  /**
   * @param {number} lat @param {number} lng
   * @returns {Promise<{ name: string, by: 'area' | 'nearest', distanceKm: number | null } | null>}
   */
  async forPlace(lat, lng) {
    const stations = await this.#stations();

    const containing = stations
      .filter((s) => s.area && areaContains(s.area, lat, lng))
      .sort((a, b) => areaSizeKm2(a.area) - areaSizeKm2(b.area));
    if (containing[0]) return { name: containing[0].name, by: 'area', distanceKm: null };

    let best = null;
    for (const s of stations) {
      const [slng, slat] = s.location?.coordinates ?? [];
      if (slat === undefined || slng === undefined) continue;
      const d = distanceKm({ lat, lng }, { lat: slat, lng: slng });
      if (!best || d < best.distanceKm) best = { name: s.name, by: 'nearest', distanceKm: d };
    }
    return best && { ...best, distanceKm: Math.round(best.distanceKm * 10) / 10 };
  }
}

module.exports = new StationService();
