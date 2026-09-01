require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query(`
      SELECT date, COUNT(*) as cnt
      FROM card_daily_snapshots
      WHERE date < '2026-01-01'
      GROUP BY date
      ORDER BY date
    `);
    
    console.log('Dates before 2026:');
    for (const row of r.rows) {
      console.log(`  ${row.date.toISOString().slice(0,10)} | ${row.cnt} rows`);
    }
    
    // Now actually query 2025-12-28 directly
    if (r.rows.length > 0) {
      const target = r.rows[0].date; // Get actual date object
      console.log(`\nQuerying for ${target.toISOString().slice(0,10)} using date object...`);
      const r2 = await client.query(`SELECT COUNT(*) as c FROM card_daily_snapshots WHERE date = $1`, [target]);
      console.log(`Result: ${r2.rows[0].c}`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
