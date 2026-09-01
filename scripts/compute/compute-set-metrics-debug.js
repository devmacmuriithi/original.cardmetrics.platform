#!/usr/bin/env node
/**
 * Compute Set-Level Metrics - DEBUG VERSION
 */

require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trading_cards';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const args = process.argv.slice(2);
const TARGET_DATE = args.find(a => a.startsWith('--date='))?.split('=')[1] || null;

// Process a single date - SIMPLIFIED
async function processDate(client, date) {
  console.log(`\n📊 Processing set metrics for ${date}...`);
  
  const startTime = Date.now();
  
  // Simplified query - just counts and basic prices
  const result = await client.query(`
    WITH card_aggregates AS (
      SELECT 
        c.set_id,
        MAX(c.console_uid) as console_uid,
        COUNT(*) as cards_count,
        COUNT(cdm.loose_price) as cards_with_prices_count,
        COUNT(cdm.windows_computed_at) as cards_with_windows_count,
        AVG(cdm.loose_price) as avg_loose_price,
        MIN(cdm.loose_price) as min_loose_price,
        MAX(cdm.loose_price) as max_loose_price,
        COALESCE(SUM(cdm.sales_volume), 0) as total_sales_volume
      FROM cards c
      LEFT JOIN card_daily_snapshots cdm ON c.card_id = cdm.card_id AND cdm.date = $1
      GROUP BY c.set_id
      HAVING COUNT(*) > 0
    )
    INSERT INTO sets_computed_metrics (
      set_id, console_uid, date,
      cards_count, cards_with_prices_count, cards_with_windows_count,
      avg_loose_price, min_loose_price, max_loose_price,
      total_sales_volume,
      computed_at
    )
    SELECT 
      ca.set_id,
      ca.console_uid,
      $1::DATE as date,
      ca.cards_count,
      ca.cards_with_prices_count,
      ca.cards_with_windows_count,
      ca.avg_loose_price,
      ca.min_loose_price,
      ca.max_loose_price,
      ca.total_sales_volume,
      NOW() as computed_at
    FROM card_aggregates ca
    ON CONFLICT (set_id, date) DO UPDATE SET
      cards_count = EXCLUDED.cards_count,
      cards_with_prices_count = EXCLUDED.cards_with_prices_count,
      cards_with_windows_count = EXCLUDED.cards_with_windows_count,
      avg_loose_price = EXCLUDED.avg_loose_price,
      min_loose_price = EXCLUDED.min_loose_price,
      max_loose_price = EXCLUDED.max_loose_price,
      total_sales_volume = EXCLUDED.total_sales_volume,
      computed_at = EXCLUDED.computed_at
  `, [date]);
  
  const duration = Date.now() - startTime;
  console.log(`  ✅ Computed ${result.rowCount} sets in ${duration}ms`);
  
  return result.rowCount;
}

// Main
async function main() {
  console.log('========================================');
  console.log('Compute Set-Level Metrics (DEBUG)');
  console.log('========================================');
  
  if (!TARGET_DATE) {
    console.error('Please specify --date=YYYY-MM-DD');
    process.exit(1);
  }
  
  console.log(`\n📅 Processing date: ${TARGET_DATE}`);
  
  const client = await pool.connect();
  
  try {
    const setsComputed = await processDate(client, TARGET_DATE);
    
    console.log('\n========================================');
    console.log('✅ Complete!');
    console.log(`   Sets computed: ${setsComputed}`);
    console.log('========================================');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
