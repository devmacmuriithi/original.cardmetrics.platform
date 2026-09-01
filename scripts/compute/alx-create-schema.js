/**
 * alx-create-schema.js - Create ALX v1 Liquidity Signals Schema
 * 
 * Creates:
 *   - alx_signal_config (seeded with defaults)
 *   - alx_market_signals_daily (output table)
 * 
 * Usage: node alx-create-schema.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  console.log('Creating ALX v1 Schema...');
  console.log('=======================\n');
  
  try {
    const client = await pool.connect();
    
    // Read and execute schema SQL
    const schemaPath = path.join(__dirname, 'alx-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema creation...');
    await client.query(schemaSQL);
    
    console.log('\n✅ Schema created successfully!');
    
    // Verify tables
    const result = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('alx_signal_config', 'alx_market_signals_daily')
      ORDER BY table_name
    `);
    
    console.log('\nCreated objects:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name} (${row.table_type})`);
    });
    
    // Show config values
    const configResult = await client.query('SELECT * FROM alx_signal_config');
    console.log('\nConfiguration (alx_signal_config):');
    configResult.rows.forEach(row => {
      console.log(`  ${row.config_key}: ${row.config_value} (${row.description})`);
    });
    
    console.log('\n========================================');
    console.log('Next: Run the compute script');
    console.log('  node alx-compute-signals.js [date]');
    console.log('========================================');
    
    client.release();
    
  } catch (err) {
    console.error('\n❌ Error creating schema:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
