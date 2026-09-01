const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function check() {
  const client = await pool.connect();
  try {
    // Check basketball sport
    const sportRes = await client.query("SELECT * FROM sports WHERE LOWER(name) = 'basketball'");
    console.log('Basketball sport record:', sportRes.rows);
    
    // Count sets with sport_id = basketball
    if (sportRes.rows.length > 0) {
      const basketballId = sportRes.rows[0].id;
      const setsRes = await client.query('SELECT COUNT(*) FROM sets WHERE sport_id = $1', [basketballId]);
      console.log('Basketball sets count:', setsRes.rows[0].count);
    }
    
    // Check sets with NULL sport_id
    const nullRes = await client.query('SELECT COUNT(*) FROM sets WHERE sport_id IS NULL');
    console.log('Sets with NULL sport_id:', nullRes.rows[0].count);
    
    // Sample csv_path values
    const sampleRes = await client.query("SELECT console_uid, csv_path FROM sets WHERE sport_id = 1 LIMIT 5");
    console.log('Sample csv_path values:', sampleRes.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
