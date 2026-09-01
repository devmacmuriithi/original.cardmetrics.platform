require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('Adding loose_avg_7d column...');
    await client.query('ALTER TABLE card_computed_metrics ADD COLUMN IF NOT EXISTS loose_avg_7d NUMERIC(12,2)');
    console.log('✅ loose_avg_7d added');
    
    console.log('Adding psa10_avg_7d column...');
    await client.query('ALTER TABLE card_computed_metrics ADD COLUMN IF NOT EXISTS psa10_avg_7d NUMERIC(12,2)');
    console.log('✅ psa10_avg_7d added');
    
    console.log('Adding graded_avg_7d column...');
    await client.query('ALTER TABLE card_computed_metrics ADD COLUMN IF NOT EXISTS graded_avg_7d NUMERIC(12,2)');
    console.log('✅ graded_avg_7d added');
    
    console.log('\nAll columns added successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
