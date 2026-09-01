require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    // Just get 3 rows for 2025-12-28 with any data
    const r = await client.query(`
      SELECT date, card_id, loose_price, graded_price, psa10_price, 
             avg_7d, avg_30d, avg_90d, windows_computed_at
      FROM card_daily_snapshots 
      WHERE date = '2025-12-28'::date
      LIMIT 3
    `);
    console.log(`Found ${r.rows.length} rows`);
    for (const row of r.rows) {
      console.log(row);
    }
    
    // Check date type
    const d = await client.query(`SELECT pg_typeof(date) as date_type FROM card_daily_snapshots LIMIT 1`);
    console.log('\nDate column type:', d.rows[0].date_type);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
