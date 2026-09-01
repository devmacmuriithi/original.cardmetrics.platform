const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const args = process.argv.slice(2);
const dateArg = args.find(arg => arg.startsWith('--date='));
const sportArg = args.find(arg => arg.startsWith('--sport='));

const DATE = dateArg ? dateArg.split('=')[1] : '2026-01-24';
const SPORT = sportArg ? sportArg.split('=')[1] : 'basketball';

async function clearAndReinit() {
  const client = await pool.connect();
  try {
    console.log(`Clearing queue for ${DATE}...`);
    
    // Delete existing records for this date
    const deleteResult = await client.query(
      'DELETE FROM sets_ingestion_stats WHERE date = $1',
      [DATE]
    );
    console.log(`  Deleted ${deleteResult.rowCount} records`);
    
    // Re-initialize with sport filter
    console.log(`Initializing queue for ${SPORT} on ${DATE}...`);
    const initResult = await client.query(
      'SELECT init_ingestion_queue($1, $2) as count',
      [DATE, SPORT]
    );
    const count = initResult.rows[0].count;
    console.log(`  Added ${count} ${SPORT} sets to queue`);
    
    // Verify
    const verifyResult = await client.query(
      `SELECT status, COUNT(*) FROM sets_ingestion_stats WHERE date = $1 GROUP BY status`,
      [DATE]
    );
    console.log(`\nQueue status for ${DATE}:`);
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

clearAndReinit().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
