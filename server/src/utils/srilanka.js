/**
 * Sri Lankan identifiers in one canonical form, matching the admin system
 * (E-Vigilence-Admin-Panel/New Backend/src/core/srilanka.js), so both sides
 * compare the same values.
 */

/**
 * NIC in canonical form: old (9 digits + V/X) or new (12 digits), upper case
 * and without spaces. Returns null when it is neither.
 * @param {unknown} input
 */
function normalizeNic(input) {
  if (input === null || input === undefined) return null;
  const value = String(input).replace(/\s+/g, '').toUpperCase();
  if (/^\d{9}[VX]$/.test(value)) return value;
  if (/^(19|20)\d{10}$/.test(value)) return value;
  return null;
}

/**
 * The date of birth a NIC encodes: the year, then the day of the year
 * (plus 500 for women). Returns null when the day isn't a real date.
 * @param {string} nic canonical NIC
 * @returns {Date | null} midnight UTC of the birth date
 */
function birthDateFromNic(nic) {
  const year = nic.length === 10 ? 1900 + Number(nic.slice(0, 2)) : Number(nic.slice(0, 4));
  let day = Number(nic.length === 10 ? nic.slice(2, 5) : nic.slice(4, 7));
  if (day > 500) day -= 500;
  if (day < 1 || day > 366) return null;
  // The scheme counts every year as a leap year: day 60 is 29 February.
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (!leap && day === 60) return null;
  if (!leap && day > 60) day -= 1;
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(day);
  return date;
}

/** Whole years between a birth date and now. @param {Date} born */
function ageOf(born, now = new Date()) {
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const m = now.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

/**
 * Mobile and landline numbers as +94 and the 9-digit national number.
 * Accepts 0771234567, 077 123 4567, 771234567, +94771234567, 0094771234567.
 * @param {unknown} input
 */
function normalizePhone(input) {
  if (input === null || input === undefined) return null;
  let digits = String(input).replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+94')) digits = digits.slice(3);
  else if (digits.startsWith('0094')) digits = digits.slice(4);
  else if (digits.startsWith('94') && digits.length === 11) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return /^[1-9]\d{8}$/.test(digits) ? `+94${digits}` : null;
}

/** True for a mobile number (07x), which can receive a verification code. */
const isMobile = (phone) => /^\+947\d{8}$/.test(String(phone || ''));

/** Sri Lanka's bounding box, generous enough for the coast and islands. */
function insideSriLanka(latitude, longitude) {
  return latitude >= 5.85 && latitude <= 9.9 && longitude >= 79.5 && longitude <= 81.95;
}

/** Sri Lanka is UTC+05:30 all year; the start of "today" there. */
function colomboDayStart(now = new Date()) {
  const offset = 5.5 * 3600 * 1000;
  const day = 24 * 3600 * 1000;
  return new Date(Math.floor((now.getTime() + offset) / day) * day - offset);
}

module.exports = {
  normalizeNic,
  birthDateFromNic,
  ageOf,
  normalizePhone,
  isMobile,
  insideSriLanka,
  colomboDayStart,
};
