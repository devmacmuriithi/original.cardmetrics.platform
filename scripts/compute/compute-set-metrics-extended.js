#!/usr/bin/env node
/**
 * Compute Set-Level Metrics - Extended Version
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

// Process a single date - Extended with NULL-safe calculations
async function processDate(client, date) {
  console.log(`\n📊 Processing set metrics for ${date}...`);
  
  const startTime = Date.now();
  
  const result = await client.query(`
    WITH card_aggregates AS (
      SELECT 
        c.set_id,
        MAX(c.console_uid) as console_uid,
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
        
        -- Market activity
        COALESCE(SUM(cdm.sales_volume), 0) as total_sales_volume,
        SUM(COALESCE(cdm.loose_price, 0) * COALESCE(cdm.sales_volume, 0))::NUMERIC as total_market_value,
        
        -- Performance
        AVG(cdm.pct_change_7d) as avg_price_change_pct_7d,
        AVG(cdm.pct_change_30d) as avg_price_change_pct_30d,
        
        -- Volatility
        AVG(ABS(cdm.pct_change_30d)) as avg_volatility_30d,
        COUNT(*) FILTER (WHERE ABS(cdm.pct_change_30d) > 0.10) as high_volatility_cards_count,
        
        -- Coverage and liquidity
        (COUNT(cdm.loose_price) * 100.0 / NULLIF(COUNT(*), 0)) as coverage_pct,
        LEAST(100, (COALESCE(SUM(cdm.sales_volume), 0) * 10.0 / NULLIF(COUNT(*), 0))) as liquidity_score
        
      FROM cards c
      LEFT JOIN card_daily_snapshots cdm ON c.card_id = cdm.card_id AND cdm.date = $1
      GROUP BY c.set_id
      HAVING COUNT(*) > 0
    ),
    trend_distribution AS (
      SELECT 
        c.set_id,
        COUNT(*) FILTER (WHERE ccm.trend_state = 'up') as trending_up_count,
        COUNT(*) FILTER (WHERE ccm.trend_state = 'down') as trending_down_count,
        COUNT(*) FILTER (WHERE ccm.trend_state = 'consolidating') as consolidating_count,
        COUNT(*) FILTER (WHERE ccm.trend_state = 'breakout') as breakout_count,
        COUNT(*) FILTER (WHERE ccm.trend_state = 'breakdown') as breakdown_count
      FROM cards c
      LEFT JOIN card_computed_metrics ccm ON c.card_id = ccm.card_id AND ccm.date = $1
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
      set_id, console_uid, date,
      cards_count, cards_with_prices_count, cards_with_windows_count, coverage_pct,
      avg_loose_price, median_loose_price, min_loose_price, max_loose_price, 
      price_range_pct, std_dev_price,
      total_sales_volume, total_market_value, avg_daily_volume,
      avg_price_change_pct_7d, avg_price_change_pct_30d,
      trending_up_count, trending_down_count, consolidating_count, breakout_count, breakdown_count,
      pct_trending_up, pct_trending_down, pct_consolidating,
      cards_up_count_7d, cards_down_count_7d, cards_flat_count_7d, pct_cards_up_7d,
      avg_volatility_30d, high_volatility_cards_count, high_volatility_cards_pct,
      liquidity_score,
      computed_at
    )
    SELECT 
      ca.set_id,
      ca.console_uid,
      $1::DATE as date,
      
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
      
      -- Trend distribution
      COALESCE(td.trending_up_count, 0),
      COALESCE(td.trending_down_count, 0),
      COALESCE(td.consolidating_count, 0),
      COALESCE(td.breakout_count, 0),
      COALESCE(td.breakdown_count, 0),
      
      -- Percentages inline
      CASE WHEN ca.cards_with_prices_count > 0 
        THEN COALESCE(td.trending_up_count, 0) * 100.0 / ca.cards_with_prices_count 
        ELSE 0 
      END as pct_trending_up,
      CASE WHEN ca.cards_with_prices_count > 0 
        THEN COALESCE(td.trending_down_count, 0) * 100.0 / ca.cards_with_prices_count 
        ELSE 0 
      END as pct_trending_down,
      CASE WHEN ca.cards_with_prices_count > 0 
        THEN COALESCE(td.consolidating_count, 0) * 100.0 / ca.cards_with_prices_count 
        ELSE 0 
      END as pct_consolidating,
      
      -- Up/down counts
      COALESCE(ud.cards_up_count_7d, 0),
      COALESCE(ud.cards_down_count_7d, 0),
      COALESCE(ud.cards_flat_count_7d, 0),
      CASE WHEN ca.cards_with_prices_count > 0 
        THEN COALESCE(ud.cards_up_count_7d, 0) * 100.0 / ca.cards_with_prices_count 
        ELSE 0 
      END as pct_cards_up_7d,
      
      -- Volatility
      ca.avg_volatility_30d,
      ca.high_volatility_cards_count,
      CASE WHEN ca.cards_count > 0 
        THEN ca.high_volatility_cards_count * 100.0 / ca.cards_count 
        ELSE 0 
      END as high_volatility_cards_pct,
      ca.liquidity_score,
      
      NOW() as computed_at
      
    FROM card_aggregates ca
    LEFT JOIN trend_distribution td ON ca.set_id = td.set_id
    LEFT JOIN up_down_counts ud ON ca.set_id = ud.set_id
    
    ON CONFLICT (set_id, date) DO UPDATE SET
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
      trending_up_count = EXCLUDED.trending_up_count,
      trending_down_count = EXCLUDED.trending_down_count,
      consolidating_count = EXCLUDED.consolidating_count,
      breakout_count = EXCLUDED.breakout_count,
      breakdown_count = EXCLUDED.breakdown_count,
      pct_trending_up = EXCLUDED.pct_trending_up,
      pct_trending_down = EXCLUDED.pct_trending_down,
      pct_consolidating = EXCLUDED.pct_consolidating,
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

// Main
async function main() {
  console.log('========================================');
  console.log('Compute Set-Level Metrics (EXTENDED)');
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
