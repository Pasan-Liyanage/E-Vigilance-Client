/**
 * One-off: replace the plain unique `nic_1` index on the shared `users`
 * collection with a partial one, so admin-panel staff accounts without a NIC
 * no longer collide with each other.
 *
 * Usage (from server/):  node scripts/migrate-nic-index.js
 * Safe to run more than once.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectOnce } = require('../src/config/database');

async function main() {
  await connectOnce();
  const users = mongoose.connection.db.collection('users');

  await users.createIndex(
    { nic: 1 },
    { name: 'nic_unique_when_set', unique: true, partialFilterExpression: { nic: { $type: 'string' } } }
  );
  console.log('created nic_unique_when_set');

  const names = (await users.indexes()).map((i) => i.name);
  if (names.includes('nic_1')) {
    await users.dropIndex('nic_1');
    console.log('dropped nic_1');
  } else {
    console.log('nic_1 already gone');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
