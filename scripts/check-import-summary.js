const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function getImportSummary() {
  const client = await pool.connect();
  try {
    console.log('========================================');
    console.log('Basketball Import Summary by Date');
    console.log('========================================\n');

    // Get import stats by date
    const statsQuery = `
      SELECT 
        date,
        COUNT(*) as total_sets,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN imported_records END), 0) as records_imported
      FROM sets_ingestion_stats sis
      JOIN sets s ON sis.console_uid = s.console_uid
      JOIN sports sp ON s.sport_id = sp.id
      WHERE LOWER(sp.name) = 'basketball'
      GROUP BY date
      ORDER BY date DESC
    `;
    
    const statsResult = await client.query(statsQuery);
    
    console.log('Date       | Sets | Done | InProg | Pend | Fail | Skip | Records');
    console.log('-----------|------|------|--------|------|------|------|----------');
    
    let totalSets = 0;
    let totalCompleted = 0;
    let totalRecords = 0;
    
    for (const row of statsResult.rows) {
      const date = new Date(row.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      
      console.log(`${date.padEnd(11)} | ${row.total_sets.toString().padStart(4)} | ${row.completed.toString().padStart(4)} | ${row.in_progress.toString().padStart(6)} | ${row.pending.toString().padStart(4)} | ${row.failed.toString().padStart(4)} | ${row.skipped.toString().padStart(4)} | ${row.records_imported.toString().padStart(8)}`);
      
      totalSets += parseInt(row.total_sets);
      totalCompleted += parseInt(row.completed);
      totalRecords += parseInt(row.records_imported);
    }
    
    console.log('-----------|------|------|--------|------|------|------|----------');
    console.log(`TOTAL      | ${totalSets.toString().padStart(4)} | ${totalCompleted.toString().padStart(4)} |        |      |      |      | ${totalRecords.toString().padStart(8)}`);
    
    console.log('\n📊 Overall Progress:');
    const completionRate = ((totalCompleted / totalSets) * 100).toFixed(1);
    console.log(`  ${totalCompleted}/${totalSets} sets completed (${completionRate}%)`);
    console.log(`  ${totalRecords.toLocaleString()} records imported`);
    
    // Get recent activity
    console.log('\n🕒 Recent Activity (last hour):');
    const recentQuery = `
      SELECT 
        date,
        COUNT(*) as sets_completed,
        SUM(imported_records) as records_added
      FROM sets_ingestion_stats 
      WHERE status = 'completed' 
        AND updated_at >= NOW() - INTERVAL '1 hour'
      GROUP BY date
      ORDER BY date DESC
    `;
    
    const recentResult = await client.query(recentQuery);
    if (recentResult.rows.length > 0) {
      for (const row of recentResult.rows) {
        const date = new Date(row.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        console.log(`  ${date}: +${row.sets_completed} sets, +${row.records_added} records`);
      }
    } else {
      console.log('  No activity in the last hour');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

getImportSummary().catch(console.error);
