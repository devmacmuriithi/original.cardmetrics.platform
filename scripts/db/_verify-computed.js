require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function verify() {
  const client = await pool.connect();
  try {
    // Check what we have in computed_metrics for Jan 21
    const r = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(high_7d) as with_high_7d,
        COUNT(low_7d) as with_low_7d,
        COUNT(range_pct_7d) as with_range_pct,
        COUNT(price_position_7d) as with_position,
        COUNT(price_change_pct) as with_change,
        COUNT(trend_state) as with_trend
      FROM card_computed_metrics
      WHERE date = '2026-01-21'
    `);
    
    console.log('Verification for 2026-01-21:');
    console.log(r.rows[0]);
    
    // Sample rows
    const s = await client.query(`
      SELECT card_id, console_name, product_name, loose_price,
             high_7d, low_7d, range_pct_7d, price_position_7d, 
             price_change_pct, trend_state, days_of_data
      FROM card_computed_metrics
      WHERE date = '2026-01-21'
      LIMIT 10
    `);
    
    console.log('\nSample rows:');
    for (const row of s.rows) {
      console.log(`\nCard: ${row.console_name} - ${row.product_name}`);
      console.log(`  Price: $${row.loose_price}, High7d: $${row.high_7d}, Low7d: $${row.low_7d}`);
      console.log(`  Range: ${row.range_pct_7d}%, Position: ${row.price_position_7d}%`);
      console.log(`  Change: ${row.price_change_pct}%, Trend: ${row.trend_state}`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
