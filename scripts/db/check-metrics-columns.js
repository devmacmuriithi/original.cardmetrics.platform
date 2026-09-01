require('dotenv').config();
const { Pool } = require('pg');

async function checkColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1
  });
  
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'card_computed_metrics' 
      ORDER BY ordinal_position
    `);
    
    console.log('card_computed_metrics columns:\n');
    rows.forEach(c => console.log(`  ${c.column_name.padEnd(30)} ${c.data_type}`));
    console.log(`\nTotal: ${rows.length} columns`);
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
