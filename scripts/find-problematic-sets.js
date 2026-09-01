const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function findProblematicSets() {
  const client = await pool.connect();
  try {
    console.log('========================================');
    console.log('Jan 20 Problematic Sets Analysis');
    console.log('========================================\n');

    // Sets with errors
    const errorQuery = `
      SELECT 
        console_uid,
        error_message,
        retry_count,
        updated_at,
        csv_file_path
      FROM sets_ingestion_stats 
      WHERE date = '2026-01-20' 
        AND (status = 'failed' OR error_message IS NOT NULL)
      ORDER BY retry_count DESC, updated_at DESC
      LIMIT 20
    `;
    
    const errorResult = await client.query(errorQuery);
    if (errorResult.rows.length > 0) {
      console.log(`❌ Sets with errors (${errorResult.rows.length} shown):`);
      console.log('Console UID  | Retries | Error');
      console.log('-------------|---------|----------------------------------------');
      for (const row of errorResult.rows) {
        const error = row.error_message?.substring(0, 50) || 'Unknown';
        console.log(`${row.console_uid.padEnd(12)} | ${row.retry_count.toString().padStart(7)} | ${error}`);
      }
    } else {
      console.log('✅ No failed sets found');
    }

    // Sets stuck in_progress for long time
    const stuckQuery = `
      SELECT 
        console_uid,
        worker_id,
        started_at,
        EXTRACT(EPOCH FROM (NOW() - started_at))/60 as minutes_stuck,
        csv_file_path
      FROM sets_ingestion_stats 
      WHERE date = '2026-01-20'
        AND status = 'in_progress'
        AND started_at < NOW() - INTERVAL '1 hour'
      ORDER BY started_at
    `;
    
    const stuckResult = await client.query(stuckQuery);
    console.log(`\n⚠️  Sets stuck >1 hour (${stuckResult.rows.length}):`);
    if (stuckResult.rows.length > 0) {
      console.log('Console UID  | Worker | Minutes | File');
      console.log('-------------|--------|---------|------------------------------------');
      for (const row of stuckResult.rows) {
        const mins = row.minutes_stuck ? parseFloat(row.minutes_stuck).toFixed(1) : 'N/A';
        const file = row.csv_file_path?.split('/').pop() || 'Unknown';
        console.log(`${row.console_uid.padEnd(12)} | ${(row.worker_id || 'N/A').padStart(6)} | ${mins.padStart(7)} | ${file.substring(0, 35)}`);
      }
    }

    // Summary by status
    const summaryQuery = `
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
    
    const summaryResult = await client.query(summaryQuery);
    console.log('\n📊 Summary by status:');
    for (const row of summaryResult.rows) {
      console.log(`  ${row.status}: ${row.count}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

findProblematicSets().catch(console.error);
