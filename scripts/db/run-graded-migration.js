require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    console.log('Adding graded price fields to card_computed_metrics...\n');
    
    const sql = fs.readFileSync('db/migrations/add-graded-prices-to-metrics.sql', 'utf8');
    await client.query(sql);
    
    console.log('✅ Migration complete!\n');
    
    // Verify columns were added
    const { rows } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'card_computed_metrics' 
        AND column_name IN ('graded_price', 'psa10_price', 'bgs10_price', 'sales_volume')
      ORDER BY column_name
    `);
    
    console.log('Columns added:');
    rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
