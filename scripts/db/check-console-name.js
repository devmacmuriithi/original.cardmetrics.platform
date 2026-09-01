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
      SELECT set_id, console_uid, console_name, cards_count, date 
      FROM sets_computed_metrics 
      WHERE date = '2026-01-24' 
      LIMIT 5
    `);
    console.log('Sample sets with console_name:');
    rows.forEach(r => console.log(r));
  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
