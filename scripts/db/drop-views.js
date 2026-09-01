/**
 * drop-views.js - Drop all database views
 * 
 * Usage: node drop-views.js [--force]
 * Add --force to skip confirmation prompt
 * 
 * Note: This drops VIEWS only. Use drop-schema.js for tables.
 */

require('dotenv').config();
const { Pool } = require('pg');
const readline = require('readline');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const VIEWS_TO_DROP = [
  'vw_rolloff_alerts',
  'vw_execution_eligible',
  'vw_liquidity_distribution',
  'vw_signals_summary',
  'vw_market_enriched',
  'vw_cards_full',
  'vw_cards_enriched',
  'vw_card_complete',
  'vw_card_metrics_current',
  'vw_index_comparison',
  'vw_index_composition',
  'vw_index_performance',
  // Legacy
  'card_market_diff'
];

function confirmDrop() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(
      '\n⚠️  WARNING: This will DELETE all VIEWS:\n' +
      '   - vw_rolloff_alerts, vw_execution_eligible\n' +
      '   - vw_liquidity_distribution, vw_signals_summary\n' +
      '   - vw_market_enriched, vw_cards_full\n' +
      '   - vw_cards_enriched, vw_card_complete\n' +
      '   - vw_card_metrics_current\n' +
      '   - vw_index_comparison, vw_index_composition\n' +
      '   - vw_index_performance\n' +
      '   - (and any legacy views)\n\n' +
      '   Type "yes" to confirm: ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'yes');
      }
    );
  });
}

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  
  console.log('Drop Views');
  console.log('='.repeat(50));
  
  if (!force) {
    const confirmed = await confirmDrop();
    if (!confirmed) {
      console.log('\n❌ Aborted.');
      process.exit(0);
    }
  }
  
  try {
    const client = await pool.connect();
    
    console.log('\nDropping views...');
    for (const view of VIEWS_TO_DROP) {
      try {
        await client.query(`DROP VIEW IF EXISTS ${view} CASCADE`);
        console.log(`  ✓ Dropped: ${view}`);
      } catch (err) {
        // View doesn't exist - fine
      }
    }
    
    console.log('\n✅ Views dropped successfully!');
    
    client.release();
    
  } catch (err) {
    console.error('\n❌ Error dropping views:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
