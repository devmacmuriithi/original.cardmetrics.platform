require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function listTables() {
  try {
    const res = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 DATABASE TABLES:\n');
    res.rows.forEach(row => {
      console.log(`  • ${row.table_name} (${row.table_type})`);
    });
    
    // Check specific tables
    const hasCards = res.rows.some(r => r.table_name === 'cards');
    const hasSets = res.rows.some(r => r.table_name === 'sets');
    const hasCardComputedMetrics = res.rows.some(r => r.table_name === 'card_computed_metrics');
    
    console.log('\n🔍 LOOKING FOR:');
    console.log(`  cards table: ${hasCards ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`  sets table: ${hasSets ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`  card_computed_metrics: ${hasCardComputedMetrics ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    pool.end();
  }
}

listTables();
