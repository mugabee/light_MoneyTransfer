// Run this locally to generate an admin password hash — nothing here is
// sent anywhere. Paste the output into ADMIN_PASSWORD_HASH in your .env
// (local dev) and in Render's environment variables (production).
//
// Usage: node scripts/hash-password.js "your-chosen-password"

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-chosen-password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('\nADMIN_PASSWORD_HASH=' + hash + '\n');
console.log('Paste the line above into your .env and into Render\'s environment variables.');
