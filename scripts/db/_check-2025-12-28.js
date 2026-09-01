require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    console.log('Price types on 2025-12-28:\n');
    const r = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE loose_price IS NOT NULL) as loose_count,
        COUNT(*) FILTER (WHERE graded_price IS NOT NULL) as graded_count,
        COUNT(*) FILTER (WHERE psa10_price IS NOT NULL) as psa10_count,
        COUNT(*) FILTER (WHERE loose_price IS NULL AND graded_price IS NULL AND psa10_price IS NULL) as no_price,
        COUNT(*) as total
      FROM card_daily_snapshots 
      WHERE date = '2025-12-28'
    `);
    console.log(r.rows[0]);
    
    // Check windows_computed_at distribution
    const w = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE windows_computed_at IS NOT NULL) as windows_done,
        COUNT(*) FILTER (WHERE windows_computed_at IS NULL) as windows_not_done
      FROM card_daily_snapshots 
      WHERE date = '2025-12-28'
    `);
    console.log('\nWindows computed:', w.rows[0]);
    
    // Sample row
    const s = await client.query(`
      SELECT card_id, loose_price, graded_price, psa10_price, avg_7d, avg_30d, windows_computed_at
      FROM card_daily_snapshots 
      WHERE date = '2025-12-28' 
      LIMIT 3
    `);
    console.log('\nSample rows:');
    for (const row of s.rows) console.log(row);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
