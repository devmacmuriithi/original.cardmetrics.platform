require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sets'
      ORDER BY ordinal_position
    `);
    console.log('sets table columns:');
    rows.forEach(r => console.log('  - ' + r.column_name));
    
    // Check if console_name has data
    const { rows: data } = await client.query(`
      SELECT COUNT(*) as total, 
             COUNT(console_name) as with_console_name,
             COUNT(name) as with_name
      FROM sets
    `);
    console.log('\nData counts:');
    console.log('  Total sets:', data[0].total);
    console.log('  With console_name:', data[0].with_console_name);
    console.log('  With name:', data[0].with_name);
    
  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
