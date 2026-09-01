require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 120000');
    
    // Faster: just count per date without DISTINCT on console_uid
    const r = await client.query(`
      SELECT date,
        COUNT(*) as total_cards,
        COUNT(loose_price) as with_price,
        COUNT(windows_computed_at) as with_windows
      FROM card_daily_snapshots
      GROUP BY date
      ORDER BY date
    `);

    console.log('Date       | Cards      | With Price | Windows Done');
    console.log('-----------|------------|------------|------------');
    let grandTotal = 0;
    for (const row of r.rows) {
      const d = new Date(row.date).toISOString().slice(0, 10);
      grandTotal += parseInt(row.total_cards);
      console.log(
        `${d} | ${row.total_cards.padStart(10)} | ${row.with_price.padStart(10)} | ${row.with_windows.padStart(10)}`
      );
    }
    console.log('-----------|------------|------------|------------');
    console.log(`Total: ${r.rows.length} dates, ${grandTotal.toLocaleString()} card-date rows`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e.message); pool.end(); });
