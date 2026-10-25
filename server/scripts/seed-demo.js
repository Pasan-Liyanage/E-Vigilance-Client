/**
 * Demo data: one citizen account and three reports, so every screen of the
 * app has something to show and the admin system has reports to work on.
 *
 * Writes only what this app owns (`users`, `reports`). The police's side,
 * questions, updates and reward points, comes from the admin system after it
 * imports these reports, exactly as it would for real ones (DEMO.md).
 *
 * Usage (from server/):  npm run seed:demo
 *                        npm run seed:demo -- --unverify
 * Safe to run more than once: the account and its reports are created once.
 * --unverify makes the account's phone unverified again, so phone
 * verification can be shown once more. Set DEMO_PASSWORD in .env to choose
 * the account's password.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectOnce } = require('../src/config/database');
const AuthService = require('../src/services/authService');
const ReportService = require('../src/services/reportService');
const OffenceService = require('../src/services/offenceService');
const UserModel = require('../src/models/userModel');
const { birthDateFromNic } = require('../src/utils/srilanka');

const ACCOUNT = {
  name: 'Kumari Jayasinghe',
  email: 'citizen.demo@example.com',
  nic: '199234500123',
  phone: '077 000 0001',
  password: process.env.DEMO_PASSWORD || 'Demo-Citizen-2026',
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** Places, plates and offences a real report could have; none is a real person's. */
const REPORTS = [
  {
    clientReportId: 'demo-seed-1',
    offenceIds: ['MTA-164'],
    vehicleType: 'Car',
    vehicleNumber: 'WP CAB-4521',
    vehicleModel: 'Toyota Axio, white',
    occurredAt: () => new Date(Date.now() - 2 * DAY),
    location: 'Galle Road, Kollupitiya, Colombo 03',
    latitude: 6.9147,
    longitude: 79.8497,
    injuries: false,
    description:
      'The car drove through the junction well after the light turned red, while pedestrians had started crossing.',
  },
  {
    clientReportId: 'demo-seed-2',
    offenceIds: ['MTA-152A'],
    vehicleType: 'Bus',
    vehicleNumber: 'NB-6612',
    vehicleModel: 'Private bus, route 1',
    occurredAt: () => new Date(Date.now() - 5 * HOUR),
    location: 'Peradeniya Road, Kandy',
    latitude: 7.2936,
    longitude: 80.635,
    injuries: false,
    description: 'The driver was talking on a mobile phone held to his ear while driving a full bus.',
  },
  {
    clientReportId: 'demo-seed-3',
    offenceIds: ['MTA-157A', 'MTA-152'],
    vehicleType: 'Three Wheeler',
    vehicleNumber: 'SP QA-7710',
    vehicleModel: 'Bajaj, red',
    occurredAt: () => new Date(Date.now() - 9 * DAY),
    location: 'Matara Road, Galle Fort',
    latitude: 6.0329,
    longitude: 80.2168,
    injuries: false,
    description: 'Weaving between lanes at speed without a seat belt, nearly hitting a cyclist.',
  },
];

async function account() {
  const existing = await UserModel.findByEmail(ACCOUNT.email);
  if (existing) {
    console.log(`account exists: ${ACCOUNT.email}`);
    return existing;
  }
  const born = birthDateFromNic(ACCOUNT.nic);
  const { user } = await AuthService.register({
    ...ACCOUNT,
    dateOfBirth: born.toISOString().slice(0, 10),
  });
  console.log(`account created: ${ACCOUNT.email}`);
  return { _id: user.id };
}

async function main() {
  await connectOnce();

  // Offences the police no longer publish are left out of a report.
  const published = new Set((await OffenceService.list()).map((o) => o.code));
  if (!published.size) {
    throw new Error('No offences are published yet: open the admin system once so it publishes them.');
  }

  const user = await account();
  if (process.argv.includes('--unverify')) {
    await UserModel.updateProfile(user._id, { phoneVerified: false, phoneCode: null });
    console.log('phone set to unverified');
  }
  for (const r of REPORTS) {
    const offenceIds = r.offenceIds.filter((c) => published.has(c));
    if (!offenceIds.length) {
      console.log(`skipped ${r.clientReportId}: its offences are no longer published`);
      continue;
    }
    const { duplicate } = await ReportService.createReport(String(user._id), {
      ...r,
      offenceIds,
      occurredAt: r.occurredAt().toISOString(),
      // Placed and confirmed on the map, as the wizard requires.
      locationSource: 'map',
      locationConfirmed: true,
    });
    console.log(`${duplicate ? 'report exists' : 'report created'}: ${r.vehicleNumber}`);
  }

  console.log('');
  console.log(`Sign in to the app as ${ACCOUNT.email}`);
  console.log(process.env.DEMO_PASSWORD ? 'with DEMO_PASSWORD from .env' : `with the password ${ACCOUNT.password}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
