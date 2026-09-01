/**
 * run-sql-schema.js - Execute SQL schema files using Node.js with environment
 * 
 * Reads DATABASE_URL from .env and executes SQL files
 * No manual password entry needed
 * 
 * Usage:
 *   node run-sql-schema.js db/schemas/02-normalized-schema.sql
 *   node run-sql-schema.js db/schemas/03-core-schema.sql
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runSchema(sqlFilePath) {
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ File not found: ${sqlFilePath}`);
    process.exit(1);
  }

  console.log(`\n📄 Executing: ${path.basename(sqlFilePath)}`);
  console.log('=' .repeat(50));

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    const client = await pool.connect();
    
    await client.query(sql);
    
    console.log(`✅ Schema executed successfully!`);
    client.release();
    
  } catch (err) {
    console.error(`❌ Error executing schema:`, err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// If called directly with a file argument
if (process.argv[2]) {
  runSchema(process.argv[2]);
} else {
  console.log('Usage: node run-sql-schema.js <path-to-sql-file>');
  console.log('');
  console.log('Examples:');
  console.log('  node run-sql-schema.js db/schemas/02-normalized-schema.sql');
  console.log('  node run-sql-schema.js db/schemas/03-core-schema.sql');
  process.exit(1);
}
