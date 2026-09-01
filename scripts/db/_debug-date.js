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
      WHERE date = '2025-12-28'
      GROUP BY date
    `);
    console.log('Summary result:', r.rows[0]);
    
    // Raw count
    const c = await client.query(`SELECT COUNT(*) as cnt FROM card_daily_snapshots WHERE date = '2025-12-28'`);
    console.log('Raw count:', c.rows[0]);
    
    // Check if date is actually stored differently
    const d = await client.query(`SELECT DISTINCT date FROM card_daily_snapshots WHERE date::text LIKE '2025-12-%' ORDER BY date`);
    console.log('\nDecember 2025 dates:', d.rows.map(r => r.date.toISOString().slice(0,10)));
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
