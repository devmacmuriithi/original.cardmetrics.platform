require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query("SELECT viewname FROM pg_views WHERE viewname LIKE 'reports_%'");
    console.log('Reporting views found:');
    for (const row of r.rows) {
      console.log(' -', row.viewname);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
