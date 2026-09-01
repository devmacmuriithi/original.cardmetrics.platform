/**
 * maintenance.js - Step 4: VACUUM ANALYZE and cleanup
 * 
 * Keeps database performant for Metabase queries
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 2
});

const MODERN_TABLES = [
  'cards', 'sets', 'players', 'teams', 'leagues', 'sports',
  'manufacturers', 'card_types', 'variations', 'card_attributes',
  'card_grades', 'grading_companies',
  'card_daily_snapshots', 'card_computed_metrics',
  'market_indices', 'market_index_constituents', 'market_index_values',
  'alx_signal_config', 'alx_market_signals_daily'
];

async function vacuumAnalyze(tables) {
  console.log('\n🧹 VACUUM ANALYZE...');
  
  const client = await pool.connect();
  try {
    for (const table of tables) {
      const start = Date.now();
      console.log(`  ${table}...`);
      await client.query(`VACUUM ANALYZE ${table}`);
      console.log(`    ✓ ${Date.now() - start}ms`);
    }
  } finally {
    client.release();
  }
}

async function getTableStats() {
  console.log('\n📊 Table Statistics:');
  
  const client = await pool.connect();
  try {
    for (const table of MODERN_TABLES) {
      try {
        const result = await client.query(`
          SELECT 
            COUNT(*) as rows,
            pg_size_pretty(pg_total_relation_size($1)) as size
          FROM ${table}
        `, [table]);
        
        const stats = result.rows[0];
        console.log(`  ${table}:`);
        console.log(`    Rows: ${parseInt(stats.rows).toLocaleString()}`);
        console.log(`    Size: ${stats.size}`);
      } catch (err) {
        console.log(`  ${table}: Not found`);
      }
    }
  } finally {
    client.release();
  }
}

async function cleanupOldData(daysToKeep = 30) {
  console.log(`\n🗑️  Cleaning old snapshot data older than ${daysToKeep} days...`);
  
  try {
    const result = await pool.query(`
      DELETE FROM card_daily_snapshots 
      WHERE date < CURRENT_DATE - INTERVAL '${daysToKeep} days'
    `);
    
    console.log(`  Removed ${result.rowCount} rows from card_daily_snapshots`);
  } catch (err) {
    console.log(`  ⚠️  Could not cleanup: ${err.message}`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  console.log('========================================');
  console.log('Database Maintenance');
  console.log('========================================');

  try {
    switch (command) {
      case 'stats':
        await getTableStats();
        break;
        
      case 'vacuum':
        await vacuumAnalyze(['cards', 'card_daily_snapshots', 'card_computed_metrics']);
        break;
        
      case 'cleanup':
        await cleanupOldData(parseInt(args[1]) || 30);
        break;
        
      case 'all':
      default:
        await getTableStats();
        await vacuumAnalyze(['cards', 'card_daily_snapshots', 'card_computed_metrics']);
        await cleanupOldData(30);
        await getTableStats();
    }

    console.log('\n✅ Done!');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
