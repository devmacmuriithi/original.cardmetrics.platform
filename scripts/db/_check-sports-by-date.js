require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 120000');
    
    // Check what console_uids look like on Jan 19-21 vs a normal date
    for (const date of ['2026-01-18', '2026-01-19', '2026-01-20', '2026-01-21', '2026-01-22']) {
      const r = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT console_uid) as sets,
          COUNT(DISTINCT LEFT(console_uid, 1)) as uid_prefixes
        FROM card_daily_snapshots WHERE date = $1
      `, [date]);
      console.log(`${date}: ${r.rows[0].total} rows, ${r.rows[0].sets} sets`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e.message); pool.end(); });
