#!/usr/bin/env node
/**
 * Update sets_computed_metrics.console_name from sets table
 * 
 * Since both tables have console_uid, we can join and update
 * the console_name field in sets_computed_metrics from sets.console_name
 * 
 * Usage: node scripts/db/update-set-metrics-console-name.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function updateConsoleNames() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('Update sets_computed_metrics.console_name');
    console.log('========================================\n');
    
    // Check current state
    const { rows: [before] } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(console_name) as with_name,
        COUNT(*) - COUNT(console_name) as missing
      FROM sets_computed_metrics
    `);
    
    console.log('Before update:');
    console.log(`  Total rows: ${before.total}`);
    console.log(`  With console_name: ${before.with_name}`);
    console.log(`  Missing console_name: ${before.missing}\n`);
    
    // Update console_name from sets table using set_id
    console.log('Updating console_name from sets table...');
    const result = await client.query(`
      UPDATE sets_computed_metrics scm
      SET console_name = s.console_name
      FROM sets s
      WHERE scm.set_id = s.id
        AND s.console_name IS NOT NULL
        AND scm.console_name IS NULL
    `);
    
    console.log(`✅ Updated ${result.rowCount} rows\n`);
    
    // Check after state
    const { rows: [after] } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(console_name) as with_name,
        COUNT(*) - COUNT(console_name) as missing
      FROM sets_computed_metrics
    `);
    
    console.log('After update:');
    console.log(`  Total rows: ${after.total}`);
    console.log(`  With console_name: ${after.with_name}`);
    console.log(`  Missing console_name: ${after.missing}\n`);
    
    // Show sample
    console.log('Sample updated rows:');
    const { rows: samples } = await client.query(`
      SELECT scm.set_id, scm.console_uid, scm.console_name, scm.date
      FROM sets_computed_metrics scm
      WHERE scm.console_name IS NOT NULL
      ORDER BY scm.date DESC
      LIMIT 5
    `);
    samples.forEach(s => {
      console.log(`  ${s.console_uid} (${s.date}): ${s.console_name}`);
    });
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

updateConsoleNames();
