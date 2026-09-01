#!/usr/bin/env node
/**
 * Check Set-Level Metrics Results
 */

require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trading_cards';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const args = process.argv.slice(2);
const TARGET_DATE = args.find(a => a.startsWith('--date='))?.split('=')[1] || '2026-01-23';

async function main() {
  const client = await pool.connect();
  
  try {
    // Top sets by cards count with price data
    const { rows: topSets } = await client.query(`
      SELECT 
        set_id, 
        console_uid,
        cards_count,
        cards_with_prices_count,
        coverage_pct,
        avg_loose_price,
        avg_price_change_pct_7d,
        pct_trending_up,
        liquidity_score
      FROM sets_computed_metrics 
      WHERE date = $1 AND cards_with_prices_count > 0
      ORDER BY cards_count DESC 
      LIMIT 10
    `, [TARGET_DATE]);
    
    console.log(`\n📊 Top 10 sets by cards count (${TARGET_DATE}):`);
    console.table(topSets);
    
    // Summary stats
    const { rows: stats } = await client.query(`
      SELECT 
        COUNT(*) as total_sets,
        COUNT(*) FILTER (WHERE cards_with_prices_count > 0) as sets_with_prices,
        AVG(cards_count)::INT as avg_cards_per_set,
        MAX(cards_count) as max_cards,
        AVG(coverage_pct)::DECIMAL(5,2) as avg_coverage_pct,
        AVG(avg_loose_price)::DECIMAL(10,2) as avg_set_price,
        SUM(total_sales_volume) as total_volume_all_sets
      FROM sets_computed_metrics 
      WHERE date = $1
    `, [TARGET_DATE]);
    
    console.log(`\n📈 Summary for ${TARGET_DATE}:`);
    console.log(`  Total sets: ${stats[0].total_sets}`);
    console.log(`  Sets with prices: ${stats[0].sets_with_prices}`);
    console.log(`  Avg cards/set: ${stats[0].avg_cards_per_set}`);
    console.log(`  Max cards in set: ${stats[0].max_cards}`);
    console.log(`  Avg coverage: ${stats[0].avg_coverage_pct}%`);
    console.log(`  Avg set price: $${stats[0].avg_set_price}`);
    console.log(`  Total volume: ${stats[0].total_volume_all_sets}`);
    
    // Trending sets
    const { rows: trending } = await client.query(`
      SELECT 
        set_id,
        console_uid,
        cards_count,
        avg_price_change_pct_7d,
        pct_trending_up,
        pct_cards_up_7d
      FROM sets_computed_metrics 
      WHERE date = $1 
        AND cards_with_prices_count > 10
        AND avg_price_change_pct_7d IS NOT NULL
      ORDER BY pct_trending_up DESC
      LIMIT 10
    `, [TARGET_DATE]);
    
    console.log(`\n🔥 Top 10 Trending Sets by % Trending Up (${TARGET_DATE}):`);
    console.table(trending);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
