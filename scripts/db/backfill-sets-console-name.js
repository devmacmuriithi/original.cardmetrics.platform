#!/usr/bin/env node
/**
 * Backfill console_name for existing sets from cards data
 * 
 * Usage: node scripts/db/backfill-sets-console-name.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function backfill() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('Backfill sets.console_name from cards');
    console.log('========================================\n');
    
    // Increase statement timeout
    await client.query('SET statement_timeout = 300000'); // 5 minutes
    
    // Get count of sets missing console_name
    const { rows: [{ count }] } = await client.query(`
      SELECT COUNT(*) FROM sets WHERE console_name IS NULL
    `);
    console.log(`Sets missing console_name: ${count}`);
    
    // Process in smaller batches to avoid timeout
    console.log('\nUpdating sets in batches...');
    let totalUpdated = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await client.query(`
        WITH batch AS (
          SELECT s.id, MIN(c.raw_console_name) as console_name
          FROM sets s
          JOIN cards c ON c.set_id = s.id
          WHERE s.console_name IS NULL
            AND c.raw_console_name IS NOT NULL
          GROUP BY s.id
          LIMIT 1000
        )
        UPDATE sets
        SET console_name = batch.console_name
        FROM batch
        WHERE sets.id = batch.id
      `);
      
      totalUpdated += result.rowCount;
      hasMore = result.rowCount > 0;
      
      if (hasMore) {
        console.log(`  Updated ${totalUpdated} sets so far...`);
      }
    }
    
    console.log(`\n✅ Total updated: ${totalUpdated} sets`);
    
    // Show sample results
    console.log('\nSample updated sets:');
    const { rows: samples } = await client.query(`
      SELECT id, console_uid, console_name, name 
      FROM sets 
      WHERE console_name IS NOT NULL 
      LIMIT 5
    `);
    samples.forEach(s => {
      console.log(`  ${s.console_uid}: ${s.console_name}`);
    });
    
    // Show remaining nulls
    const { rows: [{ remaining }] } = await client.query(`
      SELECT COUNT(*) FROM sets WHERE console_name IS NULL
    `);
    console.log(`\nSets still missing console_name: ${remaining}`);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill();
