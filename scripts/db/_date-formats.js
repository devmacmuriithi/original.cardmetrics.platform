require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    // Get exact date values from the database
    const r = await client.query(`
      SELECT DISTINCT date, COUNT(*) as cnt
      FROM card_daily_snapshots
      GROUP BY date
      ORDER BY date
    `);
    
    console.log('All dates in database:');
    for (const row of r.rows) {
      const iso = row.date.toISOString();
      const local = row.date.toString();
      console.log(`  ${iso} | ${local} | ${row.cnt} rows`);
    }
    
    // Try different date formats
    console.log('\nTrying different query formats:');
    
    const tests = [
      `SELECT COUNT(*) as c FROM card_daily_snapshots WHERE date = '2025-12-28'`,
      `SELECT COUNT(*) as c FROM card_daily_snapshots WHERE date = '2025-12-28'::date`,
      `SELECT COUNT(*) as c FROM card_daily_snapshots WHERE date = DATE '2025-12-28'`,
    ];
    
    for (const sql of tests) {
      const result = await client.query(sql);
      console.log(`  ${sql.slice(60)}... => ${result.rows[0].c}`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
