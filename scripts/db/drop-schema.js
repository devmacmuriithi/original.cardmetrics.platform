/**
 * drop-schema.js - Drop all modern schema tables
 * 
 * Usage: node drop-schema.js [--force]
 * Add --force to skip confirmation prompt
 * 
 * Note: This drops TABLES only. Use drop-views.js for views.
 */

require('dotenv').config();
const { Pool } = require('pg');
const readline = require('readline');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const TABLES_TO_DROP = [
  // Staging
  'cards_raw_ingests',
  // ALX Signals
  'alx_market_signals_daily',
  'alx_signal_config',
  // Indices
  'market_index_constituents',
  'market_index_values',
  'market_indices',
  // Core Facts
  'card_computed_metrics',
  'card_daily_snapshots',
  // Card attributes & grades
  'card_attributes',
  'card_grades',
  // Dimensions
  'cards',
  'card_types',
  'grading_companies',
  'leagues',
  'manufacturers',
  'players',
  'sets',
  'sports',
  'teams',
  'variations',
  // Legacy (if they exist)
  'sets_master',
  'card_market_daily'
];

function confirmDrop() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(
      '\n⚠️  WARNING: This will DELETE all TABLES:\n' +
      '   - alx_market_signals_daily, alx_signal_config\n' +
      '   - market_indices, market_index_constituents, market_index_values\n' +
      '   - card_computed_metrics, card_daily_snapshots\n' +
      '   - cards, sets, players, teams, leagues, sports\n' +
      '   - manufacturers, card_types, variations\n' +
      '   - card_grades, card_attributes\n' +
      '   - (and any legacy tables)\n\n' +
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
  
  console.log('Drop Milestone 2 Schema');
  console.log('=======================');
  
  if (!force) {
    const confirmed = await confirmDrop();
    if (!confirmed) {
      console.log('\n❌ Aborted.');
      process.exit(0);
    }
  }
  
  try {
    const client = await pool.connect();
    
    console.log('\nDropping tables...');
    for (const table of TABLES_TO_DROP) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`  ✓ Dropped: ${table}`);
      } catch (err) {
        // Table doesn't exist - fine
      }
    }
    
    console.log('\n✅ Tables dropped successfully!');
    
    client.release();
    await pool.end();
    process.exit(0);
    
  } catch (err) {
    console.error('\n❌ Error dropping schema:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
