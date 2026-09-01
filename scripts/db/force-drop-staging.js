/**
 * force-drop-staging.js - Force drop cards_raw_ingests table
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function forceDropStaging() {
  const client = await pool.connect();
  
  try {
    console.log('Force dropping cards_raw_ingests...');
    
    // Terminate any connections using the table
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = current_database()
      AND pid <> pg_backend_pid()
    `);
    
    // Force drop with CASCADE
    await client.query('DROP TABLE IF EXISTS cards_raw_ingests CASCADE');
    
    console.log('✅ cards_raw_ingests dropped successfully');
    
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

(async () => {
  try {
    await forceDropStaging();
    process.exit(0);
  } catch (err) {
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
