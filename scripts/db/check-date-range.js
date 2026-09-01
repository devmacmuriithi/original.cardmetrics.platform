require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('=== Date Range in card_daily_snapshots ===\n');
    
    const result = await client.query(`
      SELECT 
        MIN(date) as earliest,
        MAX(date) as latest,
        COUNT(DISTINCT date) as unique_dates,
        COUNT(*) as total_snapshots
      FROM card_daily_snapshots
    `);
    
    console.log(`Date range: ${result.rows[0].earliest} to ${result.rows[0].latest}`);
    console.log(`Unique dates: ${result.rows[0].unique_dates}`);
    console.log(`Total snapshots: ${result.rows[0].total_snapshots}`);
    
    console.log('\n=== All Dates ===');
    const dates = await client.query(`
      SELECT date, COUNT(*) as snapshots
      FROM card_daily_snapshots
      GROUP BY date
      ORDER BY date
    `);
    
    dates.rows.forEach(r => {
      console.log(`  ${r.date}: ${r.snapshots} snapshots`);
    });
    
    console.log('\n=== Sample Card Data ===');
    const sample = await client.query(`
      SELECT card_id, date, loose_price
      FROM card_daily_snapshots
      WHERE loose_price IS NOT NULL
      ORDER BY date DESC, card_id
      LIMIT 10
    `);
    
    sample.rows.forEach(r => {
      console.log(`  Card ${r.card_id} on ${r.date}: $${r.loose_price}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
