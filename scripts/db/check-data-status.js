require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function checkData() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT date) as dates_loaded,
        MIN(date) as earliest_date,
        MAX(date) as latest_date,
        COUNT(DISTINCT card_id) as unique_cards
      FROM card_daily_snapshots
    `);
    console.log('\n📊 CARD_DAILY_SNAPSHOTS STATUS:');
    console.log('─────────────────────────────────');
    console.log(`Total records: ${result.rows[0].total_records}`);
    console.log(`Dates loaded: ${result.rows[0].dates_loaded}`);
    console.log(`Date range: ${result.rows[0].earliest_date} to ${result.rows[0].latest_date}`);
    console.log(`Unique cards: ${result.rows[0].unique_cards}`);
    
    const dates = await client.query(`
      SELECT date, COUNT(*) as records
      FROM card_daily_snapshots
      GROUP BY date
      ORDER BY date DESC
      LIMIT 15
    `);
    console.log('\n📅 Dates loaded (most recent first):');
    dates.rows.forEach(r => console.log(`  ${r.date}: ${r.records} records`));
    
    const missing = await client.query(`
      SELECT COUNT(*) as null_prices
      FROM card_daily_snapshots
      WHERE loose_price IS NULL AND graded_price IS NULL 
        AND psa10_price IS NULL AND bgs10_price IS NULL
    `);
    console.log(`\n⚠️ Records with no price data: ${missing.rows[0].null_prices}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

checkData();
