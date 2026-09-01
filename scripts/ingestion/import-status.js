require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function showImportStatus() {
  const client = await pool.connect();
  
  try {
    console.log('\n========================================');
    console.log('Import Status Dashboard');
    console.log('========================================\n');
    
    // Overall progress by date
    const progressResult = await client.query(`
      SELECT * FROM vw_import_progress 
      ORDER BY date DESC 
      LIMIT 10
    `);
    
    if (progressResult.rows.length === 0) {
      console.log('No import tracking data found.');
      console.log('Run: node scripts/ingestion/init-import-queue.js --date=2026-01-24');
      return;
    }
    
    console.log('📊 Progress by Date:');
    console.log('─'.repeat(80));
    console.log('Date       | Pending | In Progress | Completed | Failed | Skipped | Records   | Workers');
    console.log('─'.repeat(80));
    
    progressResult.rows.forEach(row => {
      console.log(
        `${row.date} | ${String(row.pending).padStart(7)} | ` +
        `${String(row.in_progress).padStart(11)} | ` +
        `${String(row.completed).padStart(9)} | ` +
        `${String(row.failed).padStart(6)} | ` +
        `${String(row.skipped).padStart(7)} | ` +
        `${String(row.total_records_imported || 0).padStart(9)} | ` +
        `${row.active_workers || 0}`
      );
    });
    
    // Active workers
    console.log('\n🔧 Active Workers:');
    const workersResult = await client.query(`
      SELECT 
        worker_id,
        COUNT(*) as sets_claimed,
        MIN(started_at) as started,
        MAX(updated_at) as last_activity
      FROM sets_ingestion_stats
      WHERE status = 'in_progress' AND worker_id IS NOT NULL
      GROUP BY worker_id
      ORDER BY sets_claimed DESC
    `);
    
    if (workersResult.rows.length === 0) {
      console.log('  No active workers currently');
    } else {
      workersResult.rows.forEach(w => {
        const duration = Math.round((Date.now() - new Date(w.started)) / 60000);
        console.log(`  ${w.worker_id}: ${w.sets_claimed} sets, running ${duration} mins`);
      });
    }
    
    // Recent failures
    console.log('\n❌ Recent Failures (last 10):');
    const failuresResult = await client.query(`
      SELECT console_uid, date, error_message, updated_at
      FROM sets_ingestion_stats
      WHERE status = 'failed'
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    if (failuresResult.rows.length === 0) {
      console.log('  No failures - all good! ✅');
    } else {
      failuresResult.rows.forEach(f => {
        console.log(`  ${f.console_uid} on ${f.date}: ${f.error_message?.substring(0, 50)}...`);
      });
      console.log(`\n  To retry failed imports:`);
      console.log(`  node scripts/ingestion/reset-failed-imports.js --date=2026-01-24`);
    }
    
    // Sets with no data (skipped)
    const skippedResult = await client.query(`
      SELECT COUNT(*) as count
      FROM sets_ingestion_stats
      WHERE status = 'skipped'
    `);
    const skippedCount = skippedResult.rows[0].count;
    if (skippedCount > 0) {
      console.log(`\n⚠️  ${skippedCount} sets have no S3 data (skipped)`);
    }
    
    console.log('\n========================================');
    console.log('Commands:');
    console.log('  Launch workers: node scripts/ingestion/launch-import-workers.js --date=2026-01-24 --workers=4');
    console.log('  Single worker:  node scripts/ingestion/direct-import-from-s3-worker.js --date=2026-01-24');
    console.log('  Reset failed:   node scripts/ingestion/reset-failed-imports.js --date=2026-01-24');
    console.log('  Set details:    SELECT * FROM vw_set_import_status WHERE last_import_date = \'2026-01-24\';');
    console.log('========================================\n');
    
  } finally {
    client.release();
    await pool.end();
  }
}

showImportStatus().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
