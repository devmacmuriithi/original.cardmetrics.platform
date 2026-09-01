require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function checkTable() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'card_daily_snapshots' 
      ORDER BY ordinal_position
    `);
    
    console.log('\ncard_daily_snapshots columns:');
    console.log('='.repeat(40));
    result.rows.forEach(row => {
      console.log(` - ${row.column_name}: ${row.data_type}`);
    });
    console.log(`\nTotal: ${result.rows.length} columns`);
  } finally {
    client.release();
  }
}

checkTable().then(() => pool.end()).catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
