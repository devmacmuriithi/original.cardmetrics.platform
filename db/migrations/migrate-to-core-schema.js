/**
 * migrate-to-core-schema.js - Migrate to Clean Core Schema
 * 
 * This script:
 * 1. Renames card_market_daily → card_daily_snapshots
 * 2. Creates card_computed_metrics table
 * 3. Migrates existing data
 * 4. Updates dependent views
 * 
 * Usage: node migrate-to-core-schema.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 10
});

async function migrateTableNames(client) {
  console.log('\n🔄 Migrating table names...');
  
  // Check if old table exists
  const checkOld = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'card_market_daily'
    )
  `);
  
  if (!checkOld.rows[0].exists) {
    console.log('  ℹ️  card_market_daily not found (may already be renamed)');
    return;
  }
  
  // Rename table
  await client.query(`
    ALTER TABLE card_market_daily RENAME TO card_daily_snapshots
  `);
  console.log('  ✅ Renamed card_market_daily → card_daily_snapshots');
  
  // Update indexes
  await client.query(`
    ALTER INDEX IF EXISTS idx_market_daily_date RENAME TO idx_snapshots_date;
    ALTER INDEX IF EXISTS idx_market_daily_console RENAME TO idx_snapshots_console;
    ALTER INDEX IF EXISTS idx_market_daily_card RENAME TO idx_snapshots_card;
  `);
  console.log('  ✅ Updated index names');
}

async function updateDependentViews(client) {
  console.log('\n🔄 Updating dependent views...');
  
  // Recreate card_market_diff view with new table name
  await client.query(`
    DROP VIEW IF EXISTS card_market_diff;
    
    CREATE VIEW card_market_diff AS
    SELECT
      t.card_id,
      t.console_uid,
      t.console_name,
      t.product_name,
      t.date,
      t.loose_price,
      t.sales_volume,
      t.loose_price - LAG(t.loose_price) 
          OVER (PARTITION BY t.card_id ORDER BY t.date) 
          AS loose_price_diff,
      t.sales_volume - LAG(t.sales_volume) 
          OVER (PARTITION BY t.card_id ORDER BY t.date) 
          AS sales_volume_diff,
      GREATEST(
          0,
          t.sales_volume - LAG(t.sales_volume) 
              OVER (PARTITION BY t.card_id ORDER BY t.date)
      ) AS daily_sales_est
    FROM card_daily_snapshots t
  `);
  console.log('  ✅ Recreated card_market_diff view');
  
  // Update alx_market_signals_daily to reference new table
  await client.query(`
    DROP VIEW IF EXISTS vw_alx_signals;
    
    CREATE VIEW vw_alx_signals AS
    SELECT 
      ams.date,
      ams.card_id,
      ams.console_uid,
      c.console_name,
      c.product_name,
      ams.sales_volume_365,
      ams.liquidity_baseline,
      ams.liquidity_tier,
      ams.rolloff_flag,
      ams.execution_eligible
    FROM alx_market_signals_daily ams
    LEFT JOIN card_daily_snapshots c 
      ON ams.card_id = c.card_id AND ams.date = c.date
  `);
  console.log('  ✅ Created vw_alx_signals view');
}

async function computeInitialMetrics(client) {
  console.log('\n📊 Computing initial metrics...');
  
  // Check if snapshots has data
  const checkData = await client.query(`
    SELECT COUNT(*) as count FROM card_daily_snapshots
  `);
  
  if (parseInt(checkData.rows[0].count) === 0) {
    console.log('  ⚠️  No snapshot data to compute metrics');
    return;
  }
  
  console.log(`  Found ${checkData.rows[0].count} snapshot records`);
  
  // Compute metrics for all dates
  const dates = await client.query(`
    SELECT DISTINCT date 
    FROM card_daily_snapshots 
    ORDER BY date
  `);
  
  console.log(`  Computing metrics for ${dates.rows.length} dates...`);
  
  let computed = 0;
  
  for (const row of dates.rows) {
    const date = row.date.toISOString().split('T')[0];
    
    await client.query(`
      INSERT INTO card_computed_metrics (
        card_id, date,
        last_sale_price,
        avg_price_7d, avg_price_30d, avg_price_90d,
        price_change_1d, price_change_7d, price_change_30d, price_change_90d,
        high_price_30d, low_price_30d,
        volatility_score,
        liquidity_score,
        sales_velocity,
        liquidity_tier,
        execution_eligible,
        trend_direction,
        trend_strength,
        estimated_market_cap,
        days_of_data
      )
      SELECT 
        s.card_id,
        s.date,
        s.loose_price as last_sale_price,
        
        -- Moving averages
        AVG(s.loose_price) OVER (
          PARTITION BY s.card_id 
          ORDER BY s.date 
          ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) as avg_price_7d,
        AVG(s.loose_price) OVER (
          PARTITION BY s.card_id 
          ORDER BY s.date 
          ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) as avg_price_30d,
        AVG(s.loose_price) OVER (
          PARTITION BY s.card_id 
          ORDER BY s.date 
          ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
        ) as avg_price_90d,
        
        -- Price changes (will be NULL if no prior data)
        NULL as price_change_1d,
        NULL as price_change_7d,
        NULL as price_change_30d,
        NULL as price_change_90d,
        
        -- High/low
        MAX(s.loose_price) OVER (
          PARTITION BY s.card_id 
          ORDER BY s.date 
          ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) as high_price_30d,
        MIN(s.loose_price) OVER (
          PARTITION BY s.card_id 
          ORDER BY s.date 
          ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ) as low_price_30d,
        
        -- Volatility (std dev normalized)
        CASE 
          WHEN AVG(s.loose_price) OVER w30 > 0 
          THEN (STDDEV(s.loose_price) OVER w30 / AVG(s.loose_price) OVER w30)
          ELSE 0 
        END as volatility_score,
        
        -- Liquidity
        COALESCE(s.sales_volume / 365.0, 0) / 1000.0 as liquidity_score,
        s.sales_volume / 365.0 as sales_velocity,
        
        -- Liquidity tier
        CASE 
          WHEN s.sales_volume >= 1000 THEN 'High'
          WHEN s.sales_volume >= 300 THEN 'Medium'
          ELSE 'Low'
        END as liquidity_tier,
        
        -- Execution eligible (simplified)
        (s.sales_volume >= 300) as execution_eligible,
        
        -- Trend
        CASE 
          WHEN s.loose_price > LAG(s.loose_price, 1) OVER (PARTITION BY s.card_id ORDER BY s.date) 
            THEN 'up'
          WHEN s.loose_price < LAG(s.loose_price, 1) OVER (PARTITION BY s.card_id ORDER BY s.date) 
            THEN 'down'
          ELSE 'sideways'
        END as trend_direction,
        
        -- Trend strength (based on volume of change)
        CASE 
          WHEN AVG(s.loose_price) OVER w30 > 0 
          THEN ABS(s.loose_price - AVG(s.loose_price) OVER w30) / AVG(s.loose_price) OVER w30
          ELSE 0 
        END as trend_strength,
        
        -- Market cap estimate
        s.loose_price * (s.sales_volume / 365.0) * 365 as estimated_market_cap,
        
        -- Days of data
        COUNT(*) OVER (
          PARTITION BY s.card_id 
          ORDER BY s.date 
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as days_of_data
        
      FROM card_daily_snapshots s
      WHERE s.date = $1
      WINDOW w30 AS (
        PARTITION BY s.card_id 
        ORDER BY s.date 
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
      )
      ON CONFLICT (card_id, date) DO UPDATE SET
        last_sale_price = EXCLUDED.last_sale_price,
        avg_price_7d = EXCLUDED.avg_price_7d,
        avg_price_30d = EXCLUDED.avg_price_30d,
        avg_price_90d = EXCLUDED.avg_price_90d,
        volatility_score = EXCLUDED.volatility_score,
        liquidity_score = EXCLUDED.liquidity_score,
        sales_velocity = EXCLUDED.sales_velocity,
        liquidity_tier = EXCLUDED.liquidity_tier,
        execution_eligible = EXCLUDED.execution_eligible,
        trend_direction = EXCLUDED.trend_direction,
        trend_strength = EXCLUDED.trend_strength,
        estimated_market_cap = EXCLUDED.estimated_market_cap,
        computed_at = CURRENT_TIMESTAMP
    `, [date]);
    
    computed++;
    if (computed % 5 === 0) {
      console.log(`  ... computed ${computed}/${dates.rows.length} dates`);
    }
  }
  
  console.log(`  ✅ Computed metrics for ${computed} dates`);
  
  // Show sample
  const sample = await client.query(`
    SELECT 
      card_id, date, last_sale_price, 
      price_change_7d, volatility_score, liquidity_tier,
      trend_direction
    FROM card_computed_metrics
    ORDER BY date DESC
    LIMIT 5
  `);
  
  console.log('\n  Sample computed metrics:');
  sample.rows.forEach(r => {
    console.log(`    ${r.card_id} @ ${r.date}: $${r.last_sale_price} | ${r.liquidity_tier} | ${r.trend_direction}`);
  });
}

async function showFinalStats(client) {
  console.log('\n📊 Final Statistics:');
  
  const stats = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM card_daily_snapshots) as snapshots,
      (SELECT COUNT(*) FROM card_computed_metrics) as metrics,
      (SELECT COUNT(DISTINCT card_id) FROM card_daily_snapshots) as unique_cards
  `);
  
  const s = stats.rows[0];
  console.log(`  Daily snapshots: ${s.snapshots}`);
  console.log(`  Computed metrics: ${s.metrics}`);
  console.log(`  Unique cards: ${s.unique_cards}`);
}

(async () => {
  console.log('========================================');
  console.log('Migrate to Core Schema');
  console.log('========================================');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await migrateTableNames(client);
    await updateDependentViews(client);
    
    // Check if card_computed_metrics exists
    const checkMetrics = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'card_computed_metrics'
      )
    `);
    
    if (!checkMetrics.rows[0].exists) {
      console.log('\n⚠️  card_computed_metrics table not found.');
      console.log('   Run: psql $DATABASE_URL -f core-schema.sql');
      await client.query('ROLLBACK');
      process.exit(1);
    }
    
    await computeInitialMetrics(client);
    
    await client.query('COMMIT');
    
    await showFinalStats(client);
    
    console.log('\n========================================');
    console.log('✅ Migration complete!');
    console.log('========================================');
    console.log('\nNew structure:');
    console.log('  - card_daily_snapshots (raw data)');
    console.log('  - card_computed_metrics (analytics)');
    console.log('\nQuery examples:');
    console.log('  SELECT * FROM vw_card_complete LIMIT 10');
    console.log('  SELECT * FROM vw_card_metrics_current WHERE liquidity_tier = "High"');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
