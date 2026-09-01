require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sqlFile = process.argv[2];

if (!sqlFile) { console.error('Usage: node _run-migration.js <file.sql>'); process.exit(1); }

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 300000'); // 5 min
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log(`Running ${sqlFile}...`);
    await client.query(sql);
    console.log('✅ Done!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Error:', e.message); pool.end(); process.exit(1); });
