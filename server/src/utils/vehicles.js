/**
 * Vehicle types as the admin system knows them (its offences.model.js
 * VEHICLE_TYPES). Each published offence lists the types it applies to
 * (`offence_schedule_public.vehicleTypes`); an empty list means every vehicle.
 */
const VEHICLE_TYPES = ['motorcycle', 'three_wheeler', 'car', 'van', 'bus', 'lorry', 'tractor', 'other'];

/**
 * The words people use for each type, checked in this order. The same rule
 * as the admin system's import (its app-import.service.js VEHICLE_WORDS),
 * so both sides read the app's vehicle labels the same way.
 */
const VEHICLE_WORDS = [
  [/motor ?(bike|cycle)|^bike|scooter/i, 'motorcycle'],
  [/three|tuk|trishaw|3 ?wheel/i, 'three_wheeler'],
  [/bus/i, 'bus'],
  [/lorry|truck|tipper/i, 'lorry'],
  [/van|jeep|suv|\bcab\b|pick ?-?up/i, 'van'],
  [/tractor/i, 'tractor'],
  [/car|sedan|hatch/i, 'car'],
];

/**
 * The admin system's type for a vehicle label the app sends ("Three
 * Wheeler" → three_wheeler), or null when none was given.
 * @param {unknown} label
 */
function vehicleTypeOf(label) {
  const v = String(label ?? '').trim();
  if (!v) return null;
  if (VEHICLE_TYPES.includes(v)) return v;
  return VEHICLE_WORDS.find(([rx]) => rx.test(v))?.[1] ?? 'other';
}

/**
 * Whether an offence can be committed with this type of vehicle: an offence
 * with no vehicle types applies to all; an unknown or "other" vehicle fits
 * any offence. The admin system applies the same rule.
 * @param {{ vehicleTypes?: string[] }} offence @param {string | null} type
 */
function appliesToVehicle(offence, type) {
  return !type || type === 'other' || !offence.vehicleTypes?.length || offence.vehicleTypes.includes(type);
}

/** Vehicle types as a sentence names them. */
const VEHICLE_NOUNS = {
  motorcycle: 'motorcycles',
  three_wheeler: 'three-wheelers',
  car: 'cars',
  van: 'vans',
  bus: 'buses',
  lorry: 'lorries',
  tractor: 'tractors',
  other: 'other vehicles',
};

module.exports = { VEHICLE_TYPES, VEHICLE_NOUNS, vehicleTypeOf, appliesToVehicle };
