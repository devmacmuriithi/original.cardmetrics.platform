require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    // Exact query from _date-summary.js
    const r = await client.query(`
      SELECT date,
        COUNT(*) as total_cards,
        COUNT(loose_price) as with_price,
        COUNT(windows_computed_at) as with_windows
      FROM card_daily_snapshots
      GROUP BY date
      ORDER BY date
    `);
    console.log(`Found ${r.rows.length} dates`);
    
    // Find 2025-12-28
    const dec28 = r.rows.find(row => row.date.toISOString().slice(0,10) === '2025-12-28');
    if (dec28) {
      console.log('2025-12-28 row:', dec28);
    } else {
      console.log('2025-12-28 not found in results');
      console.log('First few dates:', r.rows.slice(0,5).map(r => r.date.toISOString().slice(0,10)));
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
