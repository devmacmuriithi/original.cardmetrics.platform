const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function diagnoseJan20() {
  const client = await pool.connect();
  try {
    console.log('========================================');
    console.log('Jan 20 Diagnostic Report');
    console.log('========================================\n');

    // Check status breakdown
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        MIN(updated_at) as earliest,
        MAX(updated_at) as latest
      FROM sets_ingestion_stats 
      WHERE date = '2026-01-20'
      GROUP BY status
      ORDER BY status
    `;
    
    const statusResult = await client.query(statusQuery);
    console.log('Status Breakdown:');
    for (const row of statusResult.rows) {
      console.log(`  ${row.status}: ${row.count} sets`);
      if (row.earliest && row.latest) {
        console.log(`    Earliest: ${row.earliest}, Latest: ${row.latest}`);
      }
    }

    // Check in_progress sets (potential hangs)
    const inProgressQuery = `
      SELECT 
        console_uid,
        worker_id,
        started_at,
        EXTRACT(EPOCH FROM (NOW() - started_at))/60 as minutes_running,
        retry_count
      FROM sets_ingestion_stats 
      WHERE date = '2026-01-20' AND status = 'in_progress'
      ORDER BY started_at
    `;
    
    const inProgressResult = await client.query(inProgressQuery);
    if (inProgressResult.rows.length > 0) {
      console.log('\n⚠️  Sets stuck in_progress:');
      for (const row of inProgressResult.rows) {
        const mins = row.minutes_running !== null ? parseFloat(row.minutes_running).toFixed(1) : 'N/A';
        console.log(`  ${row.console_uid}: ${mins} mins, worker=${row.worker_id}, retries=${row.retry_count}`);
      }
    }

    // Check failed sets
    const failedQuery = `
      SELECT 
        console_uid,
        error_message,
        updated_at
      FROM sets_ingestion_stats 
      WHERE date = '2026-01-20' 
        AND status = 'failed'
        AND updated_at > NOW() - INTERVAL '2 hours'
      ORDER BY updated_at DESC
      LIMIT 10
    `;
    
    const failedResult = await client.query(failedQuery);
    if (failedResult.rows.length > 0) {
      console.log('\n❌ Recent failures:');
      for (const row of failedResult.rows) {
        console.log(`  ${row.console_uid}: ${row.error_message?.substring(0, 80)}`);
      }
    }

    // Check pending count
    const pendingQuery = `
      SELECT COUNT(*) as count 
      FROM sets_ingestion_stats 
      WHERE date = '2026-01-20' AND status = 'pending'
    `;
    const pendingResult = await client.query(pendingQuery);
    console.log(`\n⏳ Pending sets: ${pendingResult.rows[0].count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseJan20().catch(console.error);
