/**
 * alx-compute-signals.js - ALX v1 Canonical Liquidity Signals
 * 
 * Computes daily liquidity signals per the ALX spec:
 * - liquidity_baseline = V / 365
 * - liquidity_tier = High/Medium/Low based on thresholds
 * - rolloff_flag = D > B_prev * 5 (ghost volatility detector)
 * - execution_eligible = V >= 300 AND (no prev OR D < B_prev * 10)
 * 
 * Usage:
 *   node alx-compute-signals.js                    # Compute for today
 *   node alx-compute-signals.js 2026-01-21         # Compute for specific date
 *   node alx-compute-signals.js 2026-01-01 2026-01-21  # Compute date range
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});

// Default thresholds (fallback if config table empty)
const DEFAULT_CONFIG = {
  rolloff_multiplier: 5,
  execution_multiplier: 10,
  high_tier_threshold: 1000,
  medium_tier_threshold: 300
};

async function loadConfig(client) {
  try {
    const result = await client.query('SELECT config_key, config_value FROM alx_signal_config');
    const config = {};
    result.rows.forEach(row => {
      config[row.config_key] = parseFloat(row.config_value);
    });
    return { ...DEFAULT_CONFIG, ...config };
  } catch (err) {
    console.log('⚠️  Using default config (config table may not exist yet)');
    return DEFAULT_CONFIG;
  }
}

async function computeSignalsForDate(client, date, config) {
  console.log(`\n📅 Computing signals for ${date}...`);
  
  // Pull 2-day window to get proper LAG() values per spec
  const query = `
    WITH daily_data AS (
      SELECT 
        date,
        card_id,
        console_uid,
        sales_volume,
        LAG(sales_volume) OVER (PARTITION BY card_id ORDER BY date) as sales_volume_prev
      FROM card_market_daily
      WHERE date >= $1::DATE - INTERVAL '1 day'
        AND date <= $1::DATE
        AND sales_volume IS NOT NULL
    ),
    computed AS (
      SELECT 
        date,
        card_id,
        console_uid,
        sales_volume,
        sales_volume_prev,
        
        -- 1) Liquidity baseline: V / 365
        ROUND(sales_volume / 365.0, 2) as liquidity_baseline,
        
        -- 2) Liquidity tier
        CASE 
          WHEN sales_volume >= $2 THEN 'High'
          WHEN sales_volume >= $3 THEN 'Medium'
          ELSE 'Low'
        END as liquidity_tier,
        
        -- 3) Roll-off flag: D > B_prev * 5
        -- D = V_prev - V (drop amount)
        -- B_prev = V_prev / 365 (yesterday's baseline)
        CASE 
          WHEN sales_volume_prev IS NULL THEN false
          WHEN (sales_volume_prev - sales_volume) > (sales_volume_prev / 365.0) * $4 
          THEN true 
          ELSE false 
        END as rolloff_flag,
        
        -- 4) Execution eligibility
        -- V >= 300 AND (V_prev IS NULL OR D < B_prev * 10)
        CASE 
          WHEN sales_volume < $3 THEN false
          WHEN sales_volume_prev IS NULL THEN true
          WHEN (sales_volume_prev - sales_volume) < (sales_volume_prev / 365.0) * $5 
          THEN true 
          ELSE false 
        END as execution_eligible
        
      FROM daily_data
      WHERE date = $1::DATE
    )
    INSERT INTO alx_market_signals_daily (
      date, card_id, console_uid, sales_volume_365,
      liquidity_baseline, liquidity_tier, rolloff_flag, execution_eligible,
      computed_at
    )
    SELECT 
      date, card_id, console_uid, sales_volume,
      liquidity_baseline, liquidity_tier, rolloff_flag, execution_eligible,
      NOW()
    FROM computed
    ON CONFLICT (date, card_id) DO UPDATE SET
      console_uid = EXCLUDED.console_uid,
      sales_volume_365 = EXCLUDED.sales_volume_365,
      liquidity_baseline = EXCLUDED.liquidity_baseline,
      liquidity_tier = EXCLUDED.liquidity_tier,
      rolloff_flag = EXCLUDED.rolloff_flag,
      execution_eligible = EXCLUDED.execution_eligible,
      computed_at = EXCLUDED.computed_at
    RETURNING 
      (SELECT COUNT(*) FROM computed) as computed_count,
      (SELECT COUNT(*) FROM computed WHERE execution_eligible = true) as eligible_count,
      (SELECT COUNT(*) FROM computed WHERE rolloff_flag = true) as rolloff_count
  `;
  
  const result = await client.query(query, [
    date,
    config.high_tier_threshold,
    config.medium_tier_threshold,
    config.rolloff_multiplier,
    config.execution_multiplier
  ]);
  
  if (result.rows.length > 0) {
    // Get counts from the RETURNING clause
    const countQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE execution_eligible = true) as eligible,
        COUNT(*) FILTER (WHERE rolloff_flag = true) as rolloff,
        COUNT(*) FILTER (WHERE liquidity_tier = 'High') as high_tier,
        COUNT(*) FILTER (WHERE liquidity_tier = 'Medium') as medium_tier,
        COUNT(*) FILTER (WHERE liquidity_tier = 'Low') as low_tier
      FROM alx_market_signals_daily 
      WHERE date = $1
    `;
    const countResult = await client.query(countQuery, [date]);
    const stats = countResult.rows[0];
    
    console.log(`  ✅ Computed ${stats.total} signals:`);
    console.log(`     High tier: ${stats.high_tier}, Medium: ${stats.medium_tier}, Low: ${stats.low_tier}`);
    console.log(`     Execution eligible: ${stats.eligible}`);
    console.log(`     Roll-off flags: ${stats.rolloff}`);
  } else {
    console.log('  ⚠️  No data found to compute signals');
  }
}

async function getDatesWithData(client, startDate, endDate) {
  const result = await client.query(`
    SELECT DISTINCT date 
    FROM card_market_daily 
    WHERE date >= $1 AND date <= $2
    ORDER BY date
  `, [startDate, endDate]);
  return result.rows.map(r => r.date.toISOString().split('T')[0]);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().split('T')[0];
}

(async () => {
  console.log('========================================');
  console.log('ALX v1: Compute Liquidity Signals');
  console.log('========================================');
  
  const args = process.argv.slice(2);
  let dates = [];
  
  if (args.length === 0) {
    // Default: today
    dates = [new Date().toISOString().split('T')[0]];
  } else if (args.length === 1) {
    // Single date
    dates = [args[0]];
  } else if (args.length === 2) {
    // Date range
    const startDate = args[0];
    const endDate = args[1];
    console.log(`📅 Range: ${startDate} to ${endDate}`);
    
    const client = await pool.connect();
    try {
      dates = await getDatesWithData(client, startDate, endDate);
      console.log(`📊 Found ${dates.length} dates with data`);
    } finally {
      client.release();
    }
  }
  
  if (dates.length === 0) {
    console.error('❌ No dates to process');
    process.exit(1);
  }
  
  const client = await pool.connect();
  
  try {
    // Load config
    const config = await loadConfig(client);
    console.log('\n⚙️  Configuration:');
    console.log(`   High tier threshold: ${config.high_tier_threshold}`);
    console.log(`   Medium tier threshold: ${config.medium_tier_threshold}`);
    console.log(`   Roll-off multiplier: ${config.rolloff_multiplier}x`);
    console.log(`   Execution multiplier: ${config.execution_multiplier}x`);
    
    // Compute signals for each date
    for (const date of dates) {
      await computeSignalsForDate(client, date, config);
    }
    
    console.log('\n========================================');
    console.log('✅ Signal computation complete!');
    console.log('========================================');
    console.log('\nNext steps:');
    console.log('  - Query: SELECT * FROM alx_market_signals_daily WHERE date = ...');
    console.log('  - Check Metabase dashboards');
    console.log('  - Review execution_eligible cards for trading');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
