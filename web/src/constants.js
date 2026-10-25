/**
 * The vehicle choices, each with the admin system's type (its offences.model.js
 * VEHICLE_TYPES). The label is what reports store and the previous admin panel
 * shows; the type is what offences are checked against.
 */
export const VEHICLES = [
  { label: 'Car', type: 'car', noun: 'a car' },
  { label: 'Motorcycle', type: 'motorcycle', noun: 'a motorcycle' },
  { label: 'Three Wheeler', type: 'three_wheeler', noun: 'a three-wheeler' },
  { label: 'Van / Jeep / Cab', type: 'van', noun: 'a van, jeep or cab' },
  { label: 'Bus', type: 'bus', noun: 'a bus' },
  { label: 'Lorry / Truck', type: 'lorry', noun: 'a lorry or truck' },
  { label: 'Tractor', type: 'tractor', noun: 'a tractor' },
  { label: 'Other', type: 'other', noun: 'this vehicle' },
];
export const VEHICLE_TYPES = VEHICLES.map((v) => v.label);

/** The vehicle as a sentence names it ("a three-wheeler"). */
export const vehicleNoun = (label) => VEHICLES.find((v) => v.label === label)?.noun ?? 'this vehicle';

/** Labels from earlier versions of the app, as saved in drafts. */
const OLD_LABELS = { Van: 'Van / Jeep / Cab', Cab: 'Van / Jeep / Cab', Bicycle: 'Other' };
export const currentVehicleLabel = (label) =>
  VEHICLE_TYPES.includes(label) ? label : OLD_LABELS[label] || '';

/** The admin system's vehicle type for a label, or null. */
export const vehicleTypeOf = (label) => VEHICLES.find((v) => v.label === label)?.type ?? null;

/**
 * Whether an offence can be committed with this vehicle: an offence with no
 * vehicle types applies to all, and "Other" fits any offence. The app's
 * server and the admin system apply the same rule.
 */
export const appliesToVehicle = (offence, type) =>
  !type || type === 'other' || !offence.vehicleTypes?.length || offence.vehicleTypes.includes(type);

/**
 * Used only when the police's list of offences can't be loaded (none
 * published yet, or the request failed). The report then carries this text
 * and the police match it to an offence themselves. Like the published
 * list, each entry says which vehicles it applies to (none = all).
 */
export const FALLBACK_ISSUES = [
  { name: 'Running a red light' },
  { name: 'Speeding' },
  { name: 'Driving Recklessly' },
  { name: 'Wrong side Driving' },
  { name: 'A vehicle was parked illegally' },
  { name: 'A driver disobeyed a traffic signal or road sign' },
  { name: 'Overtaking in a no-overtaking zone' },
  { name: 'Using a mobile phone while driving' },
  { name: 'Not wearing a helmet', vehicleTypes: ['motorcycle'] },
  { name: 'Not wearing a seat belt', vehicleTypes: ['car', 'van', 'bus', 'lorry'] },
  { name: 'Driving without a valid licence or insurance' },
  { name: 'Drunk driving' },
  { name: 'Blocking an emergency vehicle' },
  { name: 'Noise or emission violation' },
  { name: 'Other' },
];

/** The most offences one report may name. */
export const MAX_OFFENCES = 5;

/** Report stages, from the police's latest update (server/src/models/reportModel.js). */
export const STAGE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'waiting', label: 'Answer needed' },
  { key: 'review', label: 'Being reviewed' },
  { key: 'closed', label: 'Closed' },
];

/** How a report's progress is shown, by `reportState()` below. */
export const STATE_META = {
  waiting: { cls: 'badge-progress', label: 'Answer needed' },
  review: { cls: 'badge-brand', label: 'Being reviewed' },
  action: { cls: 'badge-completed', label: 'Action taken' },
  rejected: { cls: 'badge-rejected', label: 'Not taken forward' },
  closed: { cls: 'badge-neutral', label: 'Closed' },
};

/**
 * The state of a report for its badge. Closed reports say how they closed,
 * from the latest update when the list sends it, else from the old status.
 */
export function reportState(report, latestType = report?.latestUpdate?.type) {
  if (report?.stage === 'waiting') return 'waiting';
  if (report?.stage !== 'closed') return 'review';
  if (latestType === 'action_taken') return 'action';
  if (latestType === 'rejected') return 'rejected';
  if (latestType === 'closed_no_action') return 'closed';
  if (report.status === 'Completed') return 'action';
  if (report.status === 'Rejected') return 'rejected';
  return 'closed';
}

/** Report rules shared with the server (admin system docs/11 §4). */
export const MAX_EVIDENCE_FILES = 10;
export const MAX_FILE_MB = 50;
export const MAX_PHOTO_MB = 25;
export const MAX_REPORT_AGE_DAYS = 30;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 2000;
export const REPLY_MAX = 1000;

/** Reward line and payout states as the police's system reports them. */
export const LEDGER_META = {
  pending: { cls: 'badge-progress', label: 'Pending' },
  under_review: { cls: 'badge-progress', label: 'Under review' },
  confirmed: { cls: 'badge-completed', label: 'Confirmed' },
  paid: { cls: 'badge-brand', label: 'Paid out' },
  reversed: { cls: 'badge-rejected', label: 'Reversed' },
  expired: { cls: 'badge-neutral', label: 'Expired' },
  not_eligible: { cls: 'badge-neutral', label: 'Not eligible' },
};

export const PAYOUT_META = {
  requested: { cls: 'badge-progress', label: 'Requested' },
  batched: { cls: 'badge-brand', label: 'Being paid' },
  paid: { cls: 'badge-completed', label: 'Paid' },
  failed: { cls: 'badge-rejected', label: 'Payment failed' },
  rejected: { cls: 'badge-rejected', label: 'Declined' },
};
