/**
 * compute-price-windows.js - Compute rolling averages & % changes on card_daily_snapshots
 * 
 * Usage:
 *   node scripts/compute/compute-price-windows.js                    # All dates
 *   node scripts/compute/compute-price-windows.js --date=2026-01-25  # Specific date
 *   node scripts/compute/compute-price-windows.js --batch-size=500   # Custom batch
 *   node scripts/compute/compute-price-windows.js --force            # Recompute even if already done
 * 
 * This populates the rolling avg + pct change columns directly on card_daily_snapshots.
 * Run this AFTER ingestion. It does NOT modify raw price data.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch-size='))?.split('=')[1]) || 300;
const TARGET_DATE = process.argv.find(a => a.startsWith('--date='))?.split('=')[1] || null;
const FORCE = process.argv.includes('--force');

// Minimum data points required for each window to produce a meaningful average
const WINDOWS = [
  { days: 3,  col: '3d',  minPoints: 2 },
  { days: 7,  col: '7d',  minPoints: 3 },
  { days: 14, col: '14d', minPoints: 5 },
  { days: 30, col: '30d', minPoints: 10 },
  { days: 60, col: '60d', minPoints: 15 },
  { days: 90, col: '90d', minPoints: 20 },
];

async function computeForDate(client, date) {
  const t0 = Date.now();

  // Get card_ids that need computing for this date
  const filter = FORCE
    ? `WHERE date = $1 AND loose_price IS NOT NULL`
    : `WHERE date = $1 AND loose_price IS NOT NULL AND windows_computed_at IS NULL`;

  const cardsResult = await client.query(
    `SELECT card_id FROM card_daily_snapshots ${filter} ORDER BY card_id`,
    [date]
  );

  const cardIds = cardsResult.rows.map(r => r.card_id);
  if (cardIds.length === 0) {
    console.log(`  ${date}: 0 cards to compute (already done or no data)`);
    return 0;
  }

  console.log(`  ${date}: ${cardIds.length} cards to compute...`);

  let processed = 0;

  for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
    const batch = cardIds.slice(i, i + BATCH_SIZE);

    // For each card in the batch, compute all windows in one UPDATE
    // This uses subqueries to calculate each window's avg, count, and pct change
    await client.query(`
      UPDATE card_daily_snapshots s
      SET
        -- Rolling averages (NULL if below minimum data points)
        avg_3d  = sub.avg_3d,  data_points_3d  = sub.dp_3d,
        avg_7d  = sub.avg_7d,  data_points_7d  = sub.dp_7d,
        avg_14d = sub.avg_14d, data_points_14d = sub.dp_14d,
        avg_30d = sub.avg_30d, data_points_30d = sub.dp_30d,
        avg_60d = sub.avg_60d, data_points_60d = sub.dp_60d,
        avg_90d = sub.avg_90d, data_points_90d = sub.dp_90d,

        -- % changes
        pct_change_3d  = sub.pct_3d,
        pct_change_7d  = sub.pct_7d,
        pct_change_14d = sub.pct_14d,
        pct_change_30d = sub.pct_30d,
        pct_change_60d = sub.pct_60d,
        pct_change_90d = sub.pct_90d,

        windows_computed_at = CURRENT_TIMESTAMP
      FROM (
        SELECT
          t.card_id,

          -- 3-day window
          w3.cnt  AS dp_3d,
          CASE WHEN w3.cnt >= ${WINDOWS[0].minPoints} THEN ROUND(w3.avg_p, 2) END AS avg_3d,
          CASE WHEN p3.loose_price IS NOT NULL AND p3.loose_price > 0
            THEN ROUND(((t_price.loose_price - p3.loose_price) / p3.loose_price * 100)::numeric, 2) END AS pct_3d,

          -- 7-day window
          w7.cnt  AS dp_7d,
          CASE WHEN w7.cnt >= ${WINDOWS[1].minPoints} THEN ROUND(w7.avg_p, 2) END AS avg_7d,
          CASE WHEN p7.loose_price IS NOT NULL AND p7.loose_price > 0
            THEN ROUND(((t_price.loose_price - p7.loose_price) / p7.loose_price * 100)::numeric, 2) END AS pct_7d,

          -- 14-day window
          w14.cnt AS dp_14d,
          CASE WHEN w14.cnt >= ${WINDOWS[2].minPoints} THEN ROUND(w14.avg_p, 2) END AS avg_14d,
          CASE WHEN p14.loose_price IS NOT NULL AND p14.loose_price > 0
            THEN ROUND(((t_price.loose_price - p14.loose_price) / p14.loose_price * 100)::numeric, 2) END AS pct_14d,

          -- 30-day window
          w30.cnt AS dp_30d,
          CASE WHEN w30.cnt >= ${WINDOWS[3].minPoints} THEN ROUND(w30.avg_p, 2) END AS avg_30d,
          CASE WHEN p30.loose_price IS NOT NULL AND p30.loose_price > 0
            THEN ROUND(((t_price.loose_price - p30.loose_price) / p30.loose_price * 100)::numeric, 2) END AS pct_30d,

          -- 60-day window
          w60.cnt AS dp_60d,
          CASE WHEN w60.cnt >= ${WINDOWS[4].minPoints} THEN ROUND(w60.avg_p, 2) END AS avg_60d,
          CASE WHEN p60.loose_price IS NOT NULL AND p60.loose_price > 0
            THEN ROUND(((t_price.loose_price - p60.loose_price) / p60.loose_price * 100)::numeric, 2) END AS pct_60d,

          -- 90-day window
          w90.cnt AS dp_90d,
          CASE WHEN w90.cnt >= ${WINDOWS[5].minPoints} THEN ROUND(w90.avg_p, 2) END AS avg_90d,
          CASE WHEN p90.loose_price IS NOT NULL AND p90.loose_price > 0
            THEN ROUND(((t_price.loose_price - p90.loose_price) / p90.loose_price * 100)::numeric, 2) END AS pct_90d

        FROM UNNEST($1::bigint[]) AS t(card_id)

        -- Current price for this card on this date
        JOIN card_daily_snapshots t_price
          ON t_price.card_id = t.card_id AND t_price.date = $2::date

        -- Rolling averages: count + avg over each window
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt, AVG(loose_price) AS avg_p
          FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date BETWEEN ($2::date - 3) AND $2::date AND loose_price IS NOT NULL
        ) w3 ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt, AVG(loose_price) AS avg_p
          FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date BETWEEN ($2::date - 7) AND $2::date AND loose_price IS NOT NULL
        ) w7 ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt, AVG(loose_price) AS avg_p
          FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date BETWEEN ($2::date - 14) AND $2::date AND loose_price IS NOT NULL
        ) w14 ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt, AVG(loose_price) AS avg_p
          FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date BETWEEN ($2::date - 30) AND $2::date AND loose_price IS NOT NULL
        ) w30 ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt, AVG(loose_price) AS avg_p
          FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date BETWEEN ($2::date - 60) AND $2::date AND loose_price IS NOT NULL
        ) w60 ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt, AVG(loose_price) AS avg_p
          FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date BETWEEN ($2::date - 90) AND $2::date AND loose_price IS NOT NULL
        ) w90 ON true

        -- % change: find the most recent price before each window boundary
        LEFT JOIN LATERAL (
          SELECT loose_price FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date <= ($2::date - 3) AND loose_price IS NOT NULL
          ORDER BY date DESC LIMIT 1
        ) p3 ON true
        LEFT JOIN LATERAL (
          SELECT loose_price FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date <= ($2::date - 7) AND loose_price IS NOT NULL
          ORDER BY date DESC LIMIT 1
        ) p7 ON true
        LEFT JOIN LATERAL (
          SELECT loose_price FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date <= ($2::date - 14) AND loose_price IS NOT NULL
          ORDER BY date DESC LIMIT 1
        ) p14 ON true
        LEFT JOIN LATERAL (
          SELECT loose_price FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date <= ($2::date - 30) AND loose_price IS NOT NULL
          ORDER BY date DESC LIMIT 1
        ) p30 ON true
        LEFT JOIN LATERAL (
          SELECT loose_price FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date <= ($2::date - 60) AND loose_price IS NOT NULL
          ORDER BY date DESC LIMIT 1
        ) p60 ON true
        LEFT JOIN LATERAL (
          SELECT loose_price FROM card_daily_snapshots
          WHERE card_id = t.card_id AND date <= ($2::date - 90) AND loose_price IS NOT NULL
          ORDER BY date DESC LIMIT 1
        ) p90 ON true

      ) sub
      WHERE s.card_id = sub.card_id AND s.date = $2::date
    `, [batch, date]);

    processed += batch.length;
    if (processed % 1000 === 0 || i + BATCH_SIZE >= cardIds.length) {
      console.log(`    ${processed}/${cardIds.length} cards done`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✅ ${date}: ${processed} cards computed in ${elapsed}s`);
  return processed;
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('SET statement_timeout = 600000'); // 10 min

    console.log('========================================');
    console.log('Compute Price Windows');
    console.log('========================================');
    console.log(`Batch size: ${BATCH_SIZE}, Force: ${FORCE}`);

    let dates;
    if (TARGET_DATE) {
      dates = [TARGET_DATE];
    } else {
      const result = await client.query(
        'SELECT DISTINCT date FROM card_daily_snapshots ORDER BY date'
      );
      dates = result.rows.map(r => r.date);
    }

    console.log(`\nDates to process: ${dates.length}`);

    let totalProcessed = 0;
    for (const date of dates) {
      try {
        totalProcessed += await computeForDate(client, date);
      } catch (err) {
        console.error(`  ❌ ${date}: ${err.message}`);
      }
    }

    console.log('\n========================================');
    console.log(`✅ Done! ${totalProcessed} card-date rows computed`);
    console.log('========================================');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
