const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function resetDate() {
  const client = await pool.connect();
  try {
    const date = process.argv[2];
    if (!date) {
      console.log('Usage: node scripts/reset-date.js <YYYY-MM-DD>');
      return;
    }
    
    console.log(`Resetting date ${date}...`);
    
    // Clear all stats for this date
    const deleteQuery = 'DELETE FROM sets_ingestion_stats WHERE date = $1';
    const result = await client.query(deleteQuery, [date]);
    console.log(`Deleted ${result.rowCount} records`);
    
    // Reinitialize queue for this date
    const initQuery = 'SELECT init_ingestion_queue($1::DATE, $2)';
    const initResult = await client.query(initQuery, [date, 'basketball']);
    console.log(`Reinitialized ${initResult.rows[0].init_ingestion_queue} sets`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

resetDate().catch(console.error);
