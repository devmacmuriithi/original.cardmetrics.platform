/**
 * alx-create-views.js - Create ALX v1 Metabase Command Center Views
 * 
 * Creates:
 *   - vw_rolloff_alerts (Don't Panic Panel)
 *   - vw_execution_eligible (Safe to Trade Leaderboard)
 *   - vw_liquidity_distribution (Exchange Breadth)
 *   - vw_signals_summary (Daily health check)
 * 
 * Usage: node alx-create-views.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false }
});

(async () => {
  console.log('Creating ALX v1 Metabase Views...');
  console.log('=================================\n');
  
  try {
    const client = await pool.connect();
    
    // Read and execute views SQL
    const viewsPath = path.join(__dirname, 'alx-views.sql');
    const viewsSQL = fs.readFileSync(viewsPath, 'utf8');
    
    console.log('Executing view creation...');
    await client.query(viewsSQL);
    
    console.log('\n✅ Views created successfully!');
    
    // Verify views
    const result = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'vw_%'
      ORDER BY table_name
    `);
    
    console.log('\nCreated views:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Test sample queries
    console.log('\n--- Sample Data Preview ---');
    
    // Check if there's data
    const dataCheck = await client.query(`
      SELECT COUNT(*) as count FROM alx_market_signals_daily
    `);
    
    if (parseInt(dataCheck.rows[0].count) > 0) {
      console.log(`\nFound ${dataCheck.rows[0].count} signal records`);
      
      // Show summary
      const summary = await client.query(`
        SELECT * FROM vw_signals_summary LIMIT 5
      `);
      
      if (summary.rows.length > 0) {
        console.log('\nLatest signals summary:');
        summary.rows.forEach(row => {
          console.log(`  ${row.date}: ${row.total_cards} cards, ${row.eligible_count} eligible, ${row.rolloff_count} rolloffs`);
        });
      }
    } else {
      console.log('\n⚠️  No data in alx_market_signals_daily yet');
      console.log('   Run: node alx-compute-signals.js <date>');
    }
    
    console.log('\n========================================');
    console.log('Metabase Query Examples:');
    console.log('========================================');
    console.log('\n1. Roll-off Alerts (today):');
    console.log('   SELECT * FROM vw_rolloff_alerts');
    console.log('\n2. Execution Eligible:');
    console.log('   SELECT * FROM vw_execution_eligible LIMIT 100');
    console.log('\n3. Liquidity Distribution:');
    console.log('   SELECT * FROM vw_liquidity_distribution');
    console.log('\n4. Daily Summary:');
    console.log('   SELECT * FROM vw_signals_summary');
    console.log('========================================');
    
    client.release();
    
  } catch (err) {
    console.error('\n❌ Error creating views:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
