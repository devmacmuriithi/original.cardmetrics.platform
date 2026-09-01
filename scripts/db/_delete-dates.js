require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Usage: node _delete-dates.js --date=2026-01-21
const dateArg = process.argv.find(a => a.startsWith('--date='));
if (!dateArg) {
  console.error('Usage: node _delete-dates.js --date=YYYY-MM-DD');
  process.exit(1);
}
const dates = [dateArg.split('=')[1]];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 600000'); // 10 min
    for (const date of dates) {
      console.log(`Deleting ${date}...`);
      const t0 = Date.now();
      const r = await client.query('DELETE FROM card_daily_snapshots WHERE date = $1', [date]);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  ✅ Deleted ${r.rowCount.toLocaleString()} rows in ${elapsed}s`);
    }
    console.log('\nDone! All 3 dates cleared.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Error:', e.message); pool.end(); });
