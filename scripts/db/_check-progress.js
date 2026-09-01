require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query(`
      SELECT date, COUNT(*) as cnt,
        COUNT(high_7d) as with_high_7d,
        MIN(high_7d) as min_high,
        MAX(high_7d) as max_high
      FROM card_computed_metrics
      GROUP BY date
    `);
    
    console.log('Current computed_metrics data:');
    for (const row of r.rows) {
      console.log(`  ${row.date}: ${row.cnt} rows, high_7d populated: ${row.with_high_7d}`);
    }
    
    // Check for Jan 21 specifically
    const j21 = await client.query(`SELECT COUNT(*) as cnt FROM card_computed_metrics WHERE date = '2026-01-21'`);
    console.log(`\n2026-01-21: ${j21.rows[0].cnt} rows computed before connection dropped`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
