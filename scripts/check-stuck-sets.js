const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function checkStuckSets() {
  const client = await pool.connect();
  try {
    console.log('========================================');
    console.log('Checking Stuck Sets on Jan 20');
    console.log('========================================\n');

    // Check sets stuck in in_progress for too long
    const stuckQuery = `
      SELECT 
        sis.console_uid,
        sis.worker_id,
        sis.started_at,
        EXTRACT(EPOCH FROM (NOW() - sis.started_at))/60 as minutes_stuck
      FROM sets_ingestion_stats sis
      WHERE sis.date = '2026-01-20'
        AND sis.status = 'in_progress'
        AND sis.started_at < NOW() - INTERVAL '30 minutes'
      ORDER BY sis.started_at
    `;
    
    const stuckResult = await client.query(stuckQuery);
    
    if (stuckResult.rows.length > 0) {
      console.log('Sets stuck in progress:');
      console.log('Console UID | Worker | Minutes Stuck');
      console.log('------------|--------|--------------');
      
      for (const row of stuckResult.rows) {
        console.log(`${row.console_uid.padEnd(12)} | ${row.worker_id || 'None'} | ${row.minutes_stuck.toFixed(1)}`);
      }
    } else {
      console.log('No sets stuck in progress for >30 minutes');
    }
    
    // Check pending sets count
    const pendingQuery = `
      SELECT COUNT(*) as pending_count
      FROM sets_ingestion_stats 
      WHERE date = '2026-01-20' AND status = 'pending'
    `;
    
    const pendingResult = await client.query(pendingQuery);
    console.log(`\nPending sets: ${pendingResult.rows[0].pending_count}`);
    
    // Check recent failures
    const failureQuery = `
      SELECT 
        console_uid,
        error_message,
        updated_at
      FROM sets_ingestion_stats 
      WHERE date = '2026-01-20' 
        AND status = 'failed'
        AND updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC
      LIMIT 5
    `;
    
    const failureResult = await client.query(failureQuery);
    if (failureResult.rows.length > 0) {
      console.log('\nRecent failures:');
      for (const row of failureResult.rows) {
        console.log(`  ${row.console_uid}: ${row.error_message}`);
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkStuckSets().catch(console.error);
