require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    // Check for rows where windows is done but avg fields are null
    const r = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE windows_computed_at IS NOT NULL) as windows_done,
        COUNT(*) FILTER (WHERE avg_7d IS NOT NULL) as with_avg_7d,
        COUNT(*) FILTER (WHERE avg_30d IS NOT NULL) as with_avg_30d,
        COUNT(*) FILTER (WHERE avg_90d IS NOT NULL) as with_avg_90d,
        COUNT(*) FILTER (WHERE windows_computed_at IS NOT NULL AND avg_7d IS NULL) as windows_but_no_avg
      FROM card_daily_snapshots 
      WHERE date = '2025-12-28'
    `);
    console.log('Analysis for 2025-12-28:');
    console.log(r.rows[0]);
    
    // Sample row where windows is done
    const s = await client.query(`
      SELECT card_id, loose_price, avg_7d, avg_30d, avg_90d, windows_computed_at, data_points_7d, data_points_30d
      FROM card_daily_snapshots 
      WHERE date = '2025-12-28' AND windows_computed_at IS NOT NULL
      LIMIT 3
    `);
    console.log('\nSample rows with windows_computed_at set:');
    for (const row of s.rows) {
      console.log(row);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
