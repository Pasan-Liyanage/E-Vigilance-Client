export const VEHICLE_TYPES = [
  'Car', 'Motorcycle', 'Three Wheeler', 'Van', 'Bus', 'Lorry / Truck',
  'Cab', 'Bicycle', 'Other',
];

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

export const STATUS_FILTERS = ['All', 'In Progress', 'Completed', 'Rejected'];

export const STATUS_META = {
  'In Progress': { cls: 'badge-progress', label: 'In Progress' },
  Completed: { cls: 'badge-completed', label: 'Completed' },
  Rejected: { cls: 'badge-rejected', label: 'Rejected' },
};

export const MAX_EVIDENCE_FILES = 10;
export const MAX_FILE_MB = 50;
