require('dotenv').config();
const { Pool } = require('pg');

async function quickCheck() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1
  });
  
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) as total_sets,
        COUNT(console_name) as with_console_name,
        COUNT(*) - COUNT(console_name) as missing_console_name
      FROM sets
    `);
    
    console.log('Sets table status:');
    console.log('  Total sets:', rows[0].total_sets);
    console.log('  With console_name:', rows[0].with_console_name);
    console.log('  Missing console_name:', rows[0].missing_console_name);
    console.log(`  Coverage: ${(rows[0].with_console_name * 100 / rows[0].total_sets).toFixed(1)}%`);
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

quickCheck();
