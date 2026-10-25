import exifr from 'exifr/dist/lite.esm.mjs';
import { insideSriLanka } from './coordinates';

/**
 * Where a photo was taken, from the GPS position the phone's camera stores in
 * the file. Read from the original file, before it is compressed (which drops
 * that information). Returns null when the photo has none, or it isn't in
 * Sri Lanka. Never sent anywhere by itself: the citizen chooses to use it.
 * @param {File} file
 * @returns {Promise<{ latitude: number, longitude: number } | null>}
 */
export async function photoLocation(file) {
  if (!file?.type?.startsWith('image/')) return null;
  try {
    const gps = await exifr.gps(file);
    const latitude = Number(gps?.latitude);
    const longitude = Number(gps?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (!insideSriLanka(latitude, longitude)) return null;
    return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
  } catch {
    return null;
  }
}
