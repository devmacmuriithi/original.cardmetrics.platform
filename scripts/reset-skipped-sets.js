const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function resetSkippedSets() {
  const client = await pool.connect();
  const args = process.argv.slice(2);
  try {
    const date = args[0];
    const shouldRemove = args.includes('--remove');
    const clearAll = args.includes('--clear-all');
    const statusArg = args.find(arg => arg.startsWith('--status='));
    const targetStatus = statusArg ? statusArg.split('=')[1] : null;
    
    if (!date || date.startsWith('--')) {
      console.log('Usage: node scripts/reset-skipped-sets.js <YYYY-MM-DD> [options]');
      console.log('');
      console.log('Options:');
      console.log('  (no flag)              Reset skipped sets to pending for re-import attempt');
      console.log('  --remove               Permanently delete skipped sets from queue');
      console.log('  --clear-all            DELETE ALL sets for this date (any status)');
      console.log('  --status=pending       Target only specific status (pending|in_progress|completed|failed|skipped)');
      console.log('  --status=failed --remove   Delete only failed sets');
      return;
    }
    
    console.log('========================================');
    console.log(`Managing Skipped Sets for ${date}`);
    console.log('========================================\n');
    
    // Count sets based on targeting mode
    let countQuery, countResult, statusCount;
    
    if (clearAll) {
      countQuery = `SELECT COUNT(*) as count FROM sets_ingestion_stats WHERE date = $1`;
      countResult = await client.query(countQuery, [date]);
      statusCount = parseInt(countResult.rows[0].count);
      console.log(`Found ${statusCount} total sets (all statuses)`);
    } else if (targetStatus) {
      countQuery = `SELECT COUNT(*) as count FROM sets_ingestion_stats WHERE date = $1 AND status = $2`;
      countResult = await client.query(countQuery, [date, targetStatus]);
      statusCount = parseInt(countResult.rows[0].count);
      console.log(`Found ${statusCount} sets with status '${targetStatus}'`);
    } else {
      // Default: skipped sets
      countQuery = `SELECT COUNT(*) as count FROM sets_ingestion_stats WHERE date = $1 AND status = 'skipped'`;
      countResult = await client.query(countQuery, [date]);
      statusCount = parseInt(countResult.rows[0].count);
      console.log(`Found ${statusCount} skipped sets`);
    }
    
    if (statusCount === 0) {
      console.log('No sets to process.');
      return;
    }
    
    if (clearAll) {
      // Delete ALL sets for this date (any status)
      const allCountQuery = `SELECT status, COUNT(*) as count FROM sets_ingestion_stats WHERE date = $1 GROUP BY status`;
      const allCountResult = await client.query(allCountQuery, [date]);
      
      console.log('Current status breakdown:');
      let totalToDelete = 0;
      for (const row of allCountResult.rows) {
        console.log(`  ${row.status}: ${row.count}`);
        totalToDelete += parseInt(row.count);
      }
      
      const deleteAllQuery = `DELETE FROM sets_ingestion_stats WHERE date = $1`;
      const deleteResult = await client.query(deleteAllQuery, [date]);
      console.log(`\n✅ Permanently deleted ALL ${deleteResult.rowCount} sets for ${date}`);
      console.log('To re-import, reinitialize the queue: node scripts/db/clear-and-init-queue.js --sport=basketball --date=' + date);
      
    } else if (targetStatus) {
      // Target specific status
      const statusCountQuery = `SELECT COUNT(*) as count FROM sets_ingestion_stats WHERE date = $1 AND status = $2`;
      const statusCountResult = await client.query(statusCountQuery, [date, targetStatus]);
      const statusCount = parseInt(statusCountResult.rows[0].count);
      
      console.log(`Found ${statusCount} sets with status '${targetStatus}'`);
      
      if (statusCount === 0) {
        console.log('Nothing to process.');
        return;
      }
      
      if (shouldRemove) {
        // Delete sets with specific status
        const deleteStatusQuery = `DELETE FROM sets_ingestion_stats WHERE date = $1 AND status = $2`;
        const deleteResult = await client.query(deleteStatusQuery, [date, targetStatus]);
        console.log(`✅ Deleted ${deleteResult.rowCount} sets with status '${targetStatus}'`);
      } else {
        // Reset specific status to pending
        const resetStatusQuery = `
          UPDATE sets_ingestion_stats 
          SET status = 'pending', error_message = NULL, retry_count = 0, updated_at = NOW()
          WHERE date = $1 AND status = $2
        `;
        const resetResult = await client.query(resetStatusQuery, [date, targetStatus]);
        console.log(`✅ Reset ${resetResult.rowCount} sets from '${targetStatus}' to 'pending'`);
      }
      
    } else if (shouldRemove) {
      // Permanently delete skipped sets
      const deleteQuery = `
        DELETE FROM sets_ingestion_stats 
        WHERE date = $1 AND status = 'skipped'
      `;
      
      const deleteResult = await client.query(deleteQuery, [date]);
      console.log(`✅ Permanently deleted ${deleteResult.rowCount} skipped sets`);
      console.log('These sets will NOT be imported (assumed to have no S3 data).');
    } else {
      // Reset skipped sets to pending
      const resetQuery = `
        UPDATE sets_ingestion_stats 
        SET status = 'pending', 
            error_message = NULL,
            retry_count = 0,
            updated_at = NOW()
        WHERE date = $1 AND status = 'skipped'
      `;
      
      const resetResult = await client.query(resetQuery, [date]);
      console.log(`✅ Reset ${resetResult.rowCount} sets to 'pending'`);
      console.log('Re-run workers to try importing these sets again.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

resetSkippedSets().catch(console.error);
