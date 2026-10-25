export const VEHICLE_TYPES = [
  'Car', 'Motorcycle', 'Three Wheeler', 'Van', 'Bus', 'Lorry / Truck',
  'Cab', 'Bicycle', 'Other',
];

/**
 * Used only when the police have not published their list of offences yet
 * (GET /api/offences returns none). The report then carries this text and the
 * police match it to an offence themselves.
 */
export const ISSUE_TYPES = [
  'Running a red light',
  'Speeding',
  'Driving Recklessly',
  'Wrong side Driving',
  'A vehicle was parked illegally',
  'A driver disobeyed a traffic signal or road sign',
  'Overtaking in a no-overtaking zone',
  'Using a mobile phone while driving',
  'Not wearing a seat belt or helmet',
  'Driving without a valid licence or insurance',
  'Drunk driving',
  'Blocking an emergency vehicle',
  'Noise or emission violation',
  'Other',
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
