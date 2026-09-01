require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function showSets() {
  const client = await pool.connect();
  try {
    console.log('=== SETS TABLE SAMPLE DATA ===\n');
    
    const result = await client.query(`
      SELECT s.console_uid, s.slug, s.name, s.csv_path, s.url, sp.name as sport
      FROM sets s
      LEFT JOIN sports sp ON s.sport_id = sp.id
      LIMIT 15
    `);
    
    console.log(`Found ${result.rowCount} sample sets:\n`);
    result.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.name}`);
      console.log(`   console_uid: ${row.console_uid}`);
      console.log(`   sport: ${row.sport}`);
      console.log(`   csv_path: ${row.csv_path}`);
      console.log(`   S3 path example: dt=2026-01-24/${row.csv_path}`);
      console.log('');
    });
    
    const countResult = await client.query('SELECT COUNT(*) as total FROM sets');
    console.log(`\nTotal sets in database: ${countResult.rows[0].total}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

showSets().catch(console.error);
