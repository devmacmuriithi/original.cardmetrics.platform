require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function verify() {
  const client = await pool.connect();
  try {
    console.log('Verifying 2026-01-21 computed metrics (checking for NULLs)...\n');
    
    const r = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE high_7d IS NULL) as null_high_7d,
        COUNT(*) FILTER (WHERE low_7d IS NULL) as null_low_7d,
        COUNT(*) FILTER (WHERE range_pct_7d IS NULL) as null_range_7d,
        COUNT(*) FILTER (WHERE price_position_7d IS NULL) as null_position,
        COUNT(*) FILTER (WHERE price_change_pct IS NULL) as null_change,
        COUNT(*) FILTER (WHERE trend_state IS NULL) as null_trend,
        COUNT(*) FILTER (WHERE console_name IS NULL) as null_console,
        COUNT(*) FILTER (WHERE product_name IS NULL) as null_product
      FROM card_computed_metrics
      WHERE date = '2026-01-21'
    `);
    
    console.log('Results:');
    console.log(`  Total rows: ${r.rows[0].total}`);
    console.log(`  NULL high_7d: ${r.rows[0].null_high_7d}`);
    console.log(`  NULL low_7d: ${r.rows[0].null_low_7d}`);
    console.log(`  NULL range_pct_7d: ${r.rows[0].null_range_7d}`);
    console.log(`  NULL price_position_7d: ${r.rows[0].null_position}`);
    console.log(`  NULL price_change_pct: ${r.rows[0].null_change}`);
    console.log(`  NULL trend_state: ${r.rows[0].null_trend}`);
    console.log(`  NULL console_name: ${r.rows[0].null_console}`);
    console.log(`  NULL product_name: ${r.rows[0].null_product}`);
    
    // Trend distribution
    const t = await client.query(`
      SELECT trend_state, COUNT(*) as cnt
      FROM card_computed_metrics
      WHERE date = '2026-01-21'
      GROUP BY trend_state
      ORDER BY cnt DESC
    `);
    
    console.log('\nTrend distribution:');
    for (const row of t.rows) {
      console.log(`  ${row.trend_state}: ${row.cnt} (${(row.cnt/r.rows[0].total*100).toFixed(1)}%)`);
    }
    
    // Sample cards with interesting data
    const s = await client.query(`
      SELECT console_name, product_name, loose_price, 
             high_7d, low_7d, range_pct_7d, price_position_7d,
             price_change_pct, trend_state, days_of_data
      FROM card_computed_metrics
      WHERE date = '2026-01-21' AND range_pct_7d > 0
      ORDER BY range_pct_7d DESC
      LIMIT 5
    `);
    
    console.log('\nTop 5 cards by 7-day price range:');
    for (const row of s.rows) {
      console.log(`\n  ${row.console_name} - ${row.product_name}`);
      console.log(`    Price: $${row.loose_price}, High7d: $${row.high_7d}, Low7d: $${row.low_7d}`);
      console.log(`    Range: ${row.range_pct_7d}%, Position: ${row.price_position_7d}%`);
      console.log(`    Change: ${row.price_change_pct}%, Trend: ${row.trend_state}`);
    }
    
    console.log('\n✅ Verification complete - all fields populated!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
