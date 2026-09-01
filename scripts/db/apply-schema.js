require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');

const schemaFile = process.argv[2] || 'db/schemas/20-ingestion-tracking.sql';
const fullPath = path.resolve(schemaFile);

if (!fs.existsSync(fullPath)) {
  console.error(`Schema file not found: ${fullPath}`);
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function applySchema() {
  const client = await pool.connect();
  try {
    console.log(`Applying schema: ${schemaFile}`);
    const sql = fs.readFileSync(fullPath, 'utf8');
    await client.query(sql);
    console.log('✅ Schema applied successfully');
  } catch (err) {
    console.error('❌ Error applying schema:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applySchema();
