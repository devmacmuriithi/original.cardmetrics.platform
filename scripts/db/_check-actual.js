require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    // Exact query from _date-summary.js for just one date
    const r = await client.query(`
      SELECT date,
        COUNT(*) as total_cards,
        COUNT(loose_price) as with_price,
        COUNT(windows_computed_at) as with_windows
      FROM card_daily_snapshots
      WHERE date = '2025-12-28'
      GROUP BY date
    `);
    console.log('Summary for 2025-12-28:', r.rows[0]);
    
    // Now check actual avg_7d values
    const s = await client.query(`
      SELECT card_id, loose_price, avg_7d, avg_30d, windows_computed_at
      FROM card_daily_snapshots 
      WHERE date = '2025-12-28' 
        AND loose_price IS NOT NULL
      LIMIT 5
    `);
    console.log('\nSample rows with loose_price:');
    for (const row of s.rows) {
      console.log(`  card_id=${row.card_id}, loose_price=${row.loose_price}, avg_7d=${row.avg_7d}, avg_30d=${row.avg_30d}`);
    }
    
    // Count with actual avg values
    const c = await client.query(`
      SELECT 
        COUNT(*) as total_with_loose,
        COUNT(avg_7d) as with_avg_7d,
        COUNT(avg_30d) as with_avg_30d
      FROM card_daily_snapshots 
      WHERE date = '2025-12-28' AND loose_price IS NOT NULL
    `);
    console.log('\nCounts:', c.rows[0]);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
