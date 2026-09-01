#!/usr/bin/env node
/**
 * Compute Set-Level Metrics
 * 
 * Aggregates card-level metrics into sets_computed_metrics table.
 * Should be run AFTER compute-metrics.js and compute-price-windows.js complete.
 * 
 * Usage:
 *   node scripts/compute/compute-set-metrics.js --date=2026-01-24
 *   node scripts/compute/compute-set-metrics.js --date=all          # Process all dates
 *   node scripts/compute/compute-set-metrics.js --from-date=2026-01-20 --to-date=2026-01-24
 */

require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trading_cards';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Parse arguments like other scripts
const args = process.argv.slice(2);
const TARGET_DATE = args.find(a => a.startsWith('--date='))?.split('=')[1] || null;
const FROM_DATE = args.find(a => a.startsWith('--from-date='))?.split('=')[1] || null;
const TO_DATE = args.find(a => a.startsWith('--to-date='))?.split('=')[1] || null;

// Process a single date
async function processDate(client, date) {
  console.log(`\n📊 Processing set metrics for ${date}...`);
  
  const startTime = Date.now();
  
  // Aggregate metrics from cards into sets
  const result = await client.query(`
    WITH card_aggregates AS (
      SELECT 
        c.set_id,
        MIN(c.console_uid) as console_uid,  -- Pick representative console_uid
        COUNT(*) as cards_count,
        COUNT(cdm.loose_price) as cards_with_prices_count,
        COUNT(cdm.windows_computed_at) as cards_with_windows_count,
        
        -- Price aggregations (NULL-safe)
        AVG(cdm.loose_price) as avg_loose_price,
        CASE WHEN COUNT(cdm.loose_price) > 0 
          THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cdm.loose_price) 
          ELSE NULL 
        END as median_loose_price,
        MIN(cdm.loose_price) as min_loose_price,
        MAX(cdm.loose_price) as max_loose_price,
        CASE WHEN COUNT(cdm.loose_price) > 1 
          THEN STDDEV(cdm.loose_price) 
          ELSE NULL 
        END as std_dev_price,
        
        -- Market activity (use NUMERIC for large sums)
        COALESCE(SUM(cdm.sales_volume), 0) as total_sales_volume,
        SUM(COALESCE(cdm.loose_price, 0) * COALESCE(cdm.sales_volume, 0))::NUMERIC as total_market_value,
        
        -- Performance (from card_daily_snapshots windows)
        AVG(cdm.pct_change_7d)::NUMERIC as avg_price_change_pct_7d,
        AVG(cdm.pct_change_30d)::NUMERIC as avg_price_change_pct_30d,
        
        -- Volume-weighted change
        SUM(cdm.pct_change_7d * COALESCE(cdm.sales_volume, 1)) / NULLIF(SUM(COALESCE(cdm.sales_volume, 1)), 0)::NUMERIC as weighted_avg_change_pct_7d,
        
        -- Volatility (would need to be added to card_daily_snapshots or computed)
        -- For now, we'll compute from price changes
        AVG(ABS(cdm.pct_change_30d))::NUMERIC as avg_volatility_30d,
        COUNT(*) FILTER (WHERE ABS(cdm.pct_change_30d) > 0.10) as high_volatility_cards_count,
        
        -- Computed percentages (will calculate after aggregation)
        (COUNT(cdm.loose_price) * 100.0 / NULLIF(COUNT(*), 0)) as coverage_pct,
        (COUNT(*) FILTER (WHERE ABS(cdm.pct_change_30d) > 0.10) * 100.0 / NULLIF(COUNT(*), 0)) as high_volatility_cards_pct,
        
        -- Liquidity score (0-100) based on volume distribution
        LEAST(100, (COALESCE(SUM(cdm.sales_volume), 0) * 10.0 / NULLIF(COUNT(*), 0))) as liquidity_score
        
      FROM cards c
      LEFT JOIN card_daily_snapshots cdm ON c.card_id = cdm.card_id AND cdm.date = $1
      GROUP BY c.set_id
    ),
    up_down_counts AS (
      SELECT 
        c.set_id,
        COUNT(*) FILTER (WHERE cdm.pct_change_7d > 0.01) as cards_up_count_7d,
        COUNT(*) FILTER (WHERE cdm.pct_change_7d < -0.01) as cards_down_count_7d,
        COUNT(*) FILTER (WHERE ABS(cdm.pct_change_7d) <= 0.01) as cards_flat_count_7d
      FROM cards c
      LEFT JOIN card_daily_snapshots cdm ON c.card_id = cdm.card_id AND cdm.date = $1
      GROUP BY c.set_id
    )
    INSERT INTO sets_computed_metrics (
      set_id, console_uid, console_name, date,
      cards_count, cards_with_prices_count, cards_with_windows_count, coverage_pct,
      avg_loose_price, median_loose_price, min_loose_price, max_loose_price, 
      price_range_pct, std_dev_price,
      total_sales_volume, total_market_value, avg_daily_volume,
      avg_price_change_pct_7d, avg_price_change_pct_30d, weighted_avg_change_pct_7d,
      cards_up_count_7d, cards_down_count_7d, cards_flat_count_7d, pct_cards_up_7d,
      avg_volatility_30d, high_volatility_cards_count, high_volatility_cards_pct,
      liquidity_score,
      computed_at
    )
    SELECT 
      ca.set_id,
      ca.console_uid,
      s.console_name,
      $1::DATE as date,
      
      -- Counts
      ca.cards_count,
      ca.cards_with_prices_count,
      ca.cards_with_windows_count,
      ca.coverage_pct,
      
      -- Prices
      ca.avg_loose_price,
      ca.median_loose_price,
      ca.min_loose_price,
      ca.max_loose_price,
      CASE WHEN ca.avg_loose_price > 0 
        THEN (ca.max_loose_price - ca.min_loose_price) * 100.0 / ca.avg_loose_price 
        ELSE NULL 
      END as price_range_pct,
      ca.std_dev_price,
      
      -- Market activity
      ca.total_sales_volume,
      ca.total_market_value,
      CASE WHEN ca.cards_with_prices_count > 0 
        THEN ca.total_sales_volume * 1.0 / ca.cards_with_prices_count 
        ELSE 0 
      END as avg_daily_volume,
      
      -- Performance
      ca.avg_price_change_pct_7d,
      ca.avg_price_change_pct_30d,
      ca.weighted_avg_change_pct_7d,
      
      -- Up/down counts
      COALESCE(ud.cards_up_count_7d, 0),
      COALESCE(ud.cards_down_count_7d, 0),
      COALESCE(ud.cards_flat_count_7d, 0),
      CASE WHEN ca.cards_with_prices_count > 0 
        THEN (COALESCE(ud.cards_up_count_7d, 0)::NUMERIC / ca.cards_with_prices_count * 100)
        ELSE 0 
      END as pct_cards_up_7d,
      
      -- Volatility
      ca.avg_volatility_30d,
      ca.high_volatility_cards_count,
      ca.high_volatility_cards_pct,
      
      -- Liquidity score (0-100) based on volume distribution
      ca.liquidity_score,
      
      NOW() as computed_at
      
    FROM card_aggregates ca
    LEFT JOIN sets s ON ca.set_id = s.id
    LEFT JOIN up_down_counts ud ON ca.set_id = ud.set_id
    WHERE ca.cards_count > 0
    
    ON CONFLICT (set_id, date) DO UPDATE SET
      console_uid = EXCLUDED.console_uid,
      console_name = EXCLUDED.console_name,
      cards_count = EXCLUDED.cards_count,
      cards_with_prices_count = EXCLUDED.cards_with_prices_count,
      cards_with_windows_count = EXCLUDED.cards_with_windows_count,
      coverage_pct = EXCLUDED.coverage_pct,
      avg_loose_price = EXCLUDED.avg_loose_price,
      median_loose_price = EXCLUDED.median_loose_price,
      min_loose_price = EXCLUDED.min_loose_price,
      max_loose_price = EXCLUDED.max_loose_price,
      price_range_pct = EXCLUDED.price_range_pct,
      std_dev_price = EXCLUDED.std_dev_price,
      total_sales_volume = EXCLUDED.total_sales_volume,
      total_market_value = EXCLUDED.total_market_value,
      avg_daily_volume = EXCLUDED.avg_daily_volume,
      avg_price_change_pct_7d = EXCLUDED.avg_price_change_pct_7d,
      avg_price_change_pct_30d = EXCLUDED.avg_price_change_pct_30d,
      weighted_avg_change_pct_7d = EXCLUDED.weighted_avg_change_pct_7d,
      cards_up_count_7d = EXCLUDED.cards_up_count_7d,
      cards_down_count_7d = EXCLUDED.cards_down_count_7d,
      cards_flat_count_7d = EXCLUDED.cards_flat_count_7d,
      pct_cards_up_7d = EXCLUDED.pct_cards_up_7d,
      avg_volatility_30d = EXCLUDED.avg_volatility_30d,
      high_volatility_cards_count = EXCLUDED.high_volatility_cards_count,
      high_volatility_cards_pct = EXCLUDED.high_volatility_cards_pct,
      liquidity_score = EXCLUDED.liquidity_score,
      computed_at = EXCLUDED.computed_at
  `, [date]);
  
  const duration = Date.now() - startTime;
  console.log(`  ✅ Computed ${result.rowCount} sets in ${duration}ms`);
  
  return result.rowCount;
}

// Get dates to process
async function getDatesToProcess() {
  const client = await pool.connect();
  try {
    // If specific date requested
    if (TARGET_DATE && TARGET_DATE !== 'all') {
      return [TARGET_DATE];
    }
    
    // If date range requested
    if (FROM_DATE && TO_DATE) {
      const { rows } = await client.query(`
        SELECT DISTINCT date::TEXT as date
        FROM card_daily_snapshots
        WHERE date BETWEEN $1 AND $2
        ORDER BY date
      `, [FROM_DATE, TO_DATE]);
      return rows.map(r => r.date);
    }
    
    // Default: get all dates from snapshots
    const { rows } = await client.query(`
      SELECT DISTINCT date::TEXT as date
      FROM card_daily_snapshots
      ORDER BY date DESC
      LIMIT 30
    `);
    return rows.map(r => r.date);
    
  } finally {
    client.release();
  }
}

// Main
async function main() {
  console.log('========================================');
  console.log('Compute Set-Level Metrics');
  console.log('========================================');
  
  const dates = await getDatesToProcess();
  console.log(`\n📅 Processing ${dates.length} date(s)`);
  if (dates.length <= 5) {
    dates.forEach(d => console.log(`   - ${d}`));
  } else {
    console.log(`   From ${dates[0]} to ${dates[dates.length-1]}`);
  }
  
  const client = await pool.connect();
  
  try {
    let totalSets = 0;
    
    for (const date of dates) {
      const setsComputed = await processDate(client, date);
      totalSets += setsComputed;
    }
    
    console.log('\n========================================');
    console.log('✅ Complete!');
    console.log(`   Dates processed: ${dates.length}`);
    console.log(`   Total set-metrics computed: ${totalSets}`);
    console.log('========================================');
    console.log('\nCheck results:');
    console.log('   SELECT * FROM sets_computed_metrics ORDER BY date DESC LIMIT 5;');
    console.log('   SELECT * FROM vw_sets_performance ORDER BY pct_trending_up DESC LIMIT 10;');
    
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
