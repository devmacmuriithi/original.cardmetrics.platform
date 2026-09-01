/**
 * create-schema.js - Create all modern schema tables
 * 
 * Usage: node create-schema.js
 * 
 * This script executes SQL schema files in the correct dependency order:
 * 1. 02-normalized-schema.sql - Dimensions (sports, leagues, teams, players, sets, cards)
 * 2. 03-core-schema.sql - Facts (card_daily_snapshots, card_computed_metrics)
 * 3. 05-fingerprint-indices-schema.sql - Fingerprints + indices
 * 4. 06-alx-signals-schema.sql - ALX signals
 * 5. 07-views.sql - All views
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  statement_timeout: 60000 // 60 second timeout per query
});

const SCHEMAS = [
  { file: 'db/schemas/01-tables.sql', name: 'All Tables (Dimensions, Cards, Daily Data)' },
  { file: 'db/schemas/02-metrics.sql', name: 'All Metrics Tables' },
  { file: 'db/schemas/03-views.sql', name: 'All Views' }
  // Note: 04-indices.sql is available separately for performance optimization later
];

async function runSchema(filePath) {
  const fullPath = path.join(__dirname, '..', '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log('⚠️  Skipping (not found)');
    return true;
  }
  
  const sql = fs.readFileSync(fullPath, 'utf8');
  const client = await pool.connect();
  
  try {
    // Set statement timeout for this session
    await client.query('SET statement_timeout = 60000');
    await client.query(sql);
    return true;
  } catch (err) {
    // If it times out, try running line by line
    if (err.message.includes('timeout')) {
      console.log('\n   ⚠️  Timeout - trying individual statements...');
      const statements = sql.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (stmtErr) {
          if (!stmtErr.message.includes('does not exist')) {
            throw stmtErr;
          }
        }
      }
      return true;
    }
    throw err;
  } finally {
    client.release();
  }
}

async function listCreatedTables() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE 'sql_%'
      ORDER BY table_type, table_name
    `);
    
    console.log('\n📊 Tables & Views Created:');
    console.log('='.repeat(50));
    
    result.rows.forEach(row => {
      const icon = row.table_type === 'BASE TABLE' ? '📦' : '👁️';
      console.log(`  ${icon} ${row.table_name}`);
    });
    
    const tables = result.rows.filter(r => r.table_type === 'BASE TABLE').length;
    const views = result.rows.filter(r => r.table_type === 'VIEW').length;
    
    console.log(`\n${tables} tables, ${views} views`);
    
  } finally {
    client.release();
  }
}

(async () => {
  console.log('Creating Modern Schema...');
  console.log('='.repeat(50));
  
  try {
    for (const schema of SCHEMAS) {
      process.stdout.write(`\n📄 ${schema.name}... `);
      await runSchema(schema.file);
      console.log('✅');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All schemas created successfully!');
    
    await listCreatedTables();
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
  
  await pool.end();
  console.log('\n✅ Schema creation complete!');
  process.exit(0);
})();
