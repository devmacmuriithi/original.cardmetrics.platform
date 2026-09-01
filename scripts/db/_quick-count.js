require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const date = process.argv[2] || '2026-01-03';
pool.query(
  `SELECT COUNT(*) as total_rows, COUNT(DISTINCT card_id) as unique_cards, COUNT(DISTINCT console_uid) as sets,
   COUNT(avg_3d) as with_windows
   FROM card_daily_snapshots WHERE date=$1`,
  [date]
).then(r => { console.log('Date:', date); console.log(r.rows[0]); pool.end(); }).catch(e => { console.error(e.message); pool.end(); });
