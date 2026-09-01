/**
 * Verify card_daily_snapshots data integrity:
 * 1. Row counts per date
 * 2. Check for duplicates (card_id + date)
 * 3. Check for duplicate card_id within same date (shouldn't exist due to PK)
 * 4. Anomaly detection (dates with unusually high/low counts)
 */
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 300000'); // 5 min

    // 1. Date summary
    console.log('=== 1. RECORDS PER DATE ===\n');
    const dates = await client.query(`
      SELECT date, COUNT(*) as total,
        COUNT(loose_price) as with_price,
        COUNT(windows_computed_at) as with_windows
      FROM card_daily_snapshots
      GROUP BY date ORDER BY date
    `);

    let grandTotal = 0;
    for (const row of dates.rows) {
      const d = new Date(row.date).toISOString().slice(0, 10);
      grandTotal += parseInt(row.total);
      console.log(`  ${d}  ${row.total.padStart(10)} cards  |  ${row.with_price.padStart(10)} priced  |  ${row.with_windows.padStart(10)} windows`);
    }
    console.log(`\n  TOTAL: ${dates.rows.length} dates, ${grandTotal.toLocaleString()} rows\n`);

    // 2. Check PK constraint (card_id, date) — if PK exists, duplicates are impossible
    console.log('=== 2. PRIMARY KEY CHECK ===\n');
    const pkCheck = await client.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'card_daily_snapshots'::regclass AND contype = 'p'
    `);
    if (pkCheck.rows.length > 0) {
      console.log(`  ✅ Primary key exists: "${pkCheck.rows[0].conname}"`);
      console.log('  Duplicates on (card_id, date) are IMPOSSIBLE with PK enforced.\n');
    } else {
      console.log('  ⚠️  No primary key found! Checking for duplicates...\n');
    }

    // 3. Even with PK, check if same card appears multiple times on same date
    //    (This would only happen if PK was dropped/recreated)
    console.log('=== 3. DUPLICATE CHECK (card_id + date) ===\n');
    const dupes = await client.query(`
      SELECT card_id, date, COUNT(*) as cnt
      FROM card_daily_snapshots
      GROUP BY card_id, date
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    if (dupes.rows.length === 0) {
      console.log('  ✅ No duplicates found (card_id + date is unique)\n');
    } else {
      console.log(`  ❌ Found ${dupes.rows.length}+ duplicate card_id+date combos:`);
      for (const row of dupes.rows) {
        console.log(`    card_id=${row.card_id} date=${row.date} count=${row.cnt}`);
      }
      console.log();
    }

    // 4. Check for same product appearing multiple times on same date under different card_ids
    console.log('=== 4. DUPLICATE PRODUCT NAMES CHECK (same product_name + console_uid + date) ===\n');
    const prodDupes = await client.query(`
      SELECT date, console_uid, product_name, COUNT(*) as cnt
      FROM card_daily_snapshots
      WHERE product_name IS NOT NULL
      GROUP BY date, console_uid, product_name
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 10
    `);
    if (prodDupes.rows.length === 0) {
      console.log('  ✅ No duplicate product names within same set+date\n');
    } else {
      console.log(`  ⚠️  Found ${prodDupes.rows.length}+ product name duplicates (same name, same set, same date):`);
      for (const row of prodDupes.rows) {
        const d = new Date(row.date).toISOString().slice(0, 10);
        console.log(`    ${d} | ${row.console_uid} | "${row.product_name}" x${row.cnt}`);
      }
      console.log();
    }

    // 5. Anomaly detection — dates with counts far from median
    console.log('=== 5. ANOMALY DETECTION ===\n');
    const counts = dates.rows.map(r => parseInt(r.total));
    const sorted = [...counts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const anomalies = dates.rows.filter(r => {
      const c = parseInt(r.total);
      return c > median * 3 || c < median * 0.1;
    });
    if (anomalies.length === 0) {
      console.log(`  ✅ No anomalies (median: ${median.toLocaleString()} cards/date)\n`);
    } else {
      console.log(`  ⚠️  ${anomalies.length} dates with unusual counts (median: ${median.toLocaleString()}):`);
      for (const row of anomalies) {
        const d = new Date(row.date).toISOString().slice(0, 10);
        const c = parseInt(row.total);
        const ratio = (c / median).toFixed(1);
        console.log(`    ${d}: ${c.toLocaleString()} cards (${ratio}x median)`);
      }
      console.log();
    }

    // 6. Total unique cards across all dates
    console.log('=== 6. UNIQUE CARDS ACROSS ALL DATES ===\n');
    const uniq = await client.query('SELECT COUNT(DISTINCT card_id) as unique_cards FROM card_daily_snapshots');
    console.log(`  Unique card_ids: ${parseInt(uniq.rows[0].unique_cards).toLocaleString()}\n`);

    console.log('=== DONE ===');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Error:', e.message); pool.end(); });
