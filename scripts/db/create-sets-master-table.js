require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('Creating sets_master table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS sets_master (
        console_uid TEXT PRIMARY KEY,
        slug TEXT,
        category TEXT,
        page_name TEXT,
        url TEXT,
        csv_path TEXT
      )
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sets_category ON sets_master(category)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sets_slug ON sets_master(slug)
    `);
    
    console.log('✅ sets_master table created');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
