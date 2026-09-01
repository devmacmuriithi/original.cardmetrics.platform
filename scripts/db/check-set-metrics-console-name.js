require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    console.log('========================================');
    console.log('Check sets_computed_metrics console_name');
    console.log('========================================\n');
    
    // Count null vs non-null console_name
    const { rows: counts } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(console_name) as with_console_name,
        COUNT(*) - COUNT(console_name) as missing_console_name,
        COUNT(DISTINCT date) as dates_count
      FROM sets_computed_metrics
    `);
    console.log('Console_name stats:');
    console.log('  Total rows:', counts[0].total);
    console.log('  With console_name:', counts[0].with_console_name);
    console.log('  Missing console_name:', counts[0].missing_console_name);
    console.log('  Dates processed:', counts[0].dates_count);
    
    // Breakdown by date
    console.log('\nBreakdown by date:');
    const { rows: byDate } = await client.query(`
      SELECT 
        date,
        COUNT(*) as total_sets,
        COUNT(console_name) as with_console_name,
        COUNT(*) - COUNT(console_name) as missing_console_name
      FROM sets_computed_metrics
      GROUP BY date
      ORDER BY date DESC
      LIMIT 10
    `);
    byDate.forEach(d => {
      console.log(`  ${d.date}: ${d.missing_console_name}/${d.total_sets} missing (${d.with_console_name} have names)`);
    });
    
    // Sample rows missing console_name
    if (counts[0].missing_console_name > 0) {
      console.log('\nSample rows missing console_name:');
      const { rows: samples } = await client.query(`
        SELECT scm.set_id, scm.console_uid, scm.date, s.name, s.console_name as sets_table_console_name
        FROM sets_computed_metrics scm
        LEFT JOIN sets s ON scm.set_id = s.id
        WHERE scm.console_name IS NULL
        ORDER BY scm.date DESC
        LIMIT 5
      `);
      samples.forEach(s => {
        console.log(`  Set ${s.set_id} (${s.console_uid}): "${s.name}"`);
        console.log(`    sets.console_name: ${s.sets_table_console_name || 'NULL'}`);
      });
    }
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
