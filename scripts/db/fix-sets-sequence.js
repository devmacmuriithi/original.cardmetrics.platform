require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('Fixing sets table sequence...');
    
    // Get max id
    const maxResult = await client.query('SELECT MAX(id) as max_id FROM sets');
    const maxId = maxResult.rows[0].max_id || 0;
    
    console.log(`  Max id in table: ${maxId}`);
    
    // Reset sequence
    await client.query(`SELECT setval('sets_id_seq', ${maxId}, true)`);
    
    // Verify
    const seqResult = await client.query("SELECT currval('sets_id_seq') as current");
    console.log(`  Sequence reset to: ${seqResult.rows[0].current}`);
    console.log('✅ Sequence fixed. Now you can run load-sets.js');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
