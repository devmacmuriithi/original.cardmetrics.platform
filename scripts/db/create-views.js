/**
 * create-views.js - Create all database views
 * 
 * Usage: node create-views.js
 * 
 * This script creates all views from 07-views.sql
 * Run AFTER create-schema.js (tables must exist first)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const VIEWS_FILES = [
  'db/schemas/07-views.sql',
  'db/schemas/11-reporting-views.sql',
  'db/schemas/13-investment-metrics-multi.sql',  -- Contains vw_card_investment_primary, vw_card_investment_comparison
  'db/schemas/14-alter-metrics-multi-field.sql'  -- Contains vw_card_metrics_multi_field, vw_card_grading_opportunities
];

async function runViews() {
  const client = await pool.connect();
  
  try {
    for (const viewsFile of VIEWS_FILES) {
      const fullPath = path.join(__dirname, '..', '..', viewsFile);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`\n⚠️  ${viewsFile} not found, skipping...`);
        continue;
      }
      
      const sql = fs.readFileSync(fullPath, 'utf8');
      await client.query(sql);
      console.log(`\n📄 ${viewsFile}... ✅`);
    }
  } finally {
    client.release();
  }
}

async function listCreatedViews() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'VIEW'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE 'sql_%'
      ORDER BY table_name
    `);
    
    console.log('\n👁️ Views Created:');
    console.log('='.repeat(50));
    
    result.rows.forEach(row => {
      console.log(`  • ${row.table_name}`);
    });
    
    console.log(`\n${result.rows.length} views`);
    
  } finally {
    client.release();
  }
}

(async () => {
  console.log('Creating Views...');
  console.log('='.repeat(50));
  
  try {
    process.stdout.write('\n📄 07-views.sql... ');
    await runViews();
    console.log('✅');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Views created successfully!');
    
    await listCreatedViews();
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
