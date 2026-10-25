const LocationService = require('../services/locationService');
const StationService = require('../services/stationService');
const ApiError = require('../utils/ApiError');
const { insideSriLanka } = require('../utils/srilanka');

/** HTTP layer for placing a report's pin. */
class LocationController {
  /** POST /api/location/resolve - a pasted Google Maps link or coordinates, as a place. */
  resolve = async (req, res, next) => {
    try {
      res.json({ place: await LocationService.resolve(req.body?.text) });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/location/station?lat=&lng= - the police station a place falls to. */
  station = async (req, res, next) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !insideSriLanka(lat, lng)) {
        throw ApiError.badRequest('The place must be in Sri Lanka.');
      }
      res.json({ station: await StationService.forPlace(lat, lng) });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new LocationController();
