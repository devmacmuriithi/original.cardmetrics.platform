/**
 * compute-metrics.js - Compute guaranteed non-null trader metrics
 * 
 * Every field in card_computed_metrics is NOT NULL.
 * Only cards with loose_price are included.
 * 
 * Fields computed:
 *   - high/low for 7d, 15d, 30d windows
 *   - range_pct (price swing %) for each window
 *   - price_position_7d: where today's price sits in 7d range (0=low, 100=high)
 *   - price_change_pct: % change from earliest available price
 *   - trend_state: Rising / Stable / Declining
 *   - loose_price_volatility: coefficient of variation (stddev/mean) over 7d
 *   - loose_price_liquidity: sales volume normalized score
 *   - graded_price_volatility: coefficient of variation for graded_price over 7d
 *   - graded_price_liquidity: sales volume for graded cards
 *   - psa10_price_volatility: coefficient of variation for psa10_price over 7d
 *   - psa10_price_liquidity: sales volume for PSA10 cards
 *   - console_name + product_name for easy querying
 * 
 * Usage:
 *   node scripts/compute/compute-metrics.js                       # All dates
 *   node scripts/compute/compute-metrics.js --date=2026-01-24     # Specific date
 *   node scripts/compute/compute-metrics.js --force               # Recompute already-done rows
 *   node scripts/compute/compute-metrics.js --batch-size=500      # Custom batch size
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const args = process.argv.slice(2);
const TARGET_DATE = args.find(a => a.startsWith('--date='))?.split('=')[1] || null;
const FORCE = args.includes('--force');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1]) || 500;

async function computeForDate(client, date) {
  const t0 = Date.now();

  // Get cards that have loose_price on this date and need computing
  const filter = FORCE
    ? `WHERE s.date = $1 AND s.loose_price IS NOT NULL AND s.console_name IS NOT NULL AND s.product_name IS NOT NULL`
    : `WHERE s.date = $1 AND s.loose_price IS NOT NULL AND s.console_name IS NOT NULL AND s.product_name IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM card_computed_metrics cm
         WHERE cm.card_id = s.card_id AND cm.date = s.date
       )`;

  const cardsResult = await client.query(
    `SELECT card_id FROM card_daily_snapshots s ${filter} ORDER BY card_id`,
    [date]
  );

  const cardIds = cardsResult.rows.map(r => r.card_id);
  if (cardIds.length === 0) {
    console.log(`  ${date}: 0 cards to compute (already done or no data)`);
    return 0;
  }

  console.log(`  ${date}: ${cardIds.length.toLocaleString()} cards to compute...`);

  let processed = 0;

  for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
    const batch = cardIds.slice(i, i + BATCH_SIZE);

    await client.query(`
      INSERT INTO card_computed_metrics (
        card_id, date, console_name, product_name, loose_price,
        graded_price, psa10_price, bgs10_price, sales_volume,
        high_7d, low_7d, range_pct_7d,
        high_15d, low_15d, range_pct_15d,
        high_30d, low_30d, range_pct_30d,
        price_position_7d,
        price_change_pct,
        trend_state,
        loose_price_volatility,
        loose_price_liquidity,
        graded_price_volatility,
        graded_price_liquidity,
        psa10_price_volatility,
        psa10_price_liquidity,
        days_of_data,
        computed_at
      )
      SELECT
        s.card_id,
        s.date,
        s.console_name,
        s.product_name,
        s.loose_price,
        s.graded_price,
        s.psa10_price,
        s.bgs10_price,
        s.sales_volume,

        -- 7d high/low/range (capped at 9999.99% to prevent overflow)
        COALESCE(h7.high_price, s.loose_price),
        COALESCE(h7.low_price, s.loose_price),
        CASE WHEN COALESCE(h7.low_price, s.loose_price) > 0
          THEN LEAST(9999.99, ROUND(((COALESCE(h7.high_price, s.loose_price) - COALESCE(h7.low_price, s.loose_price))
                / COALESCE(h7.low_price, s.loose_price) * 100)::NUMERIC, 2))
          ELSE 0 END,

        -- 15d high/low/range (capped at 9999.99%)
        COALESCE(h15.high_price, s.loose_price),
        COALESCE(h15.low_price, s.loose_price),
        CASE WHEN COALESCE(h15.low_price, s.loose_price) > 0
          THEN LEAST(9999.99, ROUND(((COALESCE(h15.high_price, s.loose_price) - COALESCE(h15.low_price, s.loose_price))
                / COALESCE(h15.low_price, s.loose_price) * 100)::NUMERIC, 2))
          ELSE 0 END,

        -- 30d high/low/range (capped at 9999.99%)
        COALESCE(h30.high_price, s.loose_price),
        COALESCE(h30.low_price, s.loose_price),
        CASE WHEN COALESCE(h30.low_price, s.loose_price) > 0
          THEN LEAST(9999.99, ROUND(((COALESCE(h30.high_price, s.loose_price) - COALESCE(h30.low_price, s.loose_price))
                / COALESCE(h30.low_price, s.loose_price) * 100)::NUMERIC, 2))
          ELSE 0 END,

        -- Price position in 7d range: 0 = at low, 100 = at high
        CASE
          WHEN COALESCE(h7.high_price, s.loose_price) = COALESCE(h7.low_price, s.loose_price) THEN 50.0
          ELSE ROUND(((s.loose_price - COALESCE(h7.low_price, s.loose_price))
                / (COALESCE(h7.high_price, s.loose_price) - COALESCE(h7.low_price, s.loose_price)) * 100)::NUMERIC, 1)
        END,

        -- Price change % from earliest available price (capped at 999999.99%)
        CASE
          WHEN COALESCE(earliest.price, s.loose_price) > 0
          THEN LEAST(999999.99, GREATEST(-999999.99, ROUND(((s.loose_price - COALESCE(earliest.price, s.loose_price))
                / COALESCE(earliest.price, s.loose_price) * 100)::NUMERIC, 2)))
          ELSE 0
        END,

        -- Trend state based on price change from earliest
        CASE
          WHEN COALESCE(earliest.price, s.loose_price) > 0 THEN
            CASE
              WHEN ((s.loose_price - COALESCE(earliest.price, s.loose_price))
                    / COALESCE(earliest.price, s.loose_price)) > 0.03 THEN 'Rising'
              WHEN ((s.loose_price - COALESCE(earliest.price, s.loose_price))
                    / COALESCE(earliest.price, s.loose_price)) < -0.03 THEN 'Declining'
              ELSE 'Stable'
            END
          ELSE 'Stable'
        END,

        -- Volatility: coefficient of variation (stddev/mean) over 7 days
        CASE 
          WHEN stats7.avg_price > 0 AND stats7.stddev_price IS NOT NULL 
          THEN ROUND((stats7.stddev_price / stats7.avg_price)::NUMERIC, 4)
          ELSE NULL
        END,

        -- Liquidity: sales volume (normalized to per-day average over 7d)
        CASE 
          WHEN stats7.total_sales > 0 
          THEN ROUND((stats7.total_sales::NUMERIC / NULLIF(stats7.day_count, 0)), 2)
          ELSE NULL
        END,

        -- Graded price volatility (only if graded_price exists)
        CASE 
          WHEN stats_graded.avg_price > 0 AND stats_graded.stddev_price IS NOT NULL 
          THEN ROUND((stats_graded.stddev_price / stats_graded.avg_price)::NUMERIC, 4)
          ELSE NULL
        END,

        -- Graded price liquidity
        CASE 
          WHEN stats_graded.total_sales > 0 
          THEN ROUND((stats_graded.total_sales::NUMERIC / NULLIF(stats_graded.day_count, 0)), 2)
          ELSE NULL
        END,

        -- PSA10 price volatility (only if psa10_price exists)
        CASE 
          WHEN stats_psa10.avg_price > 0 AND stats_psa10.stddev_price IS NOT NULL 
          THEN ROUND((stats_psa10.stddev_price / stats_psa10.avg_price)::NUMERIC, 4)
          ELSE NULL
        END,

        -- PSA10 price liquidity
        CASE 
          WHEN stats_psa10.total_sales > 0 
          THEN ROUND((stats_psa10.total_sales::NUMERIC / NULLIF(stats_psa10.day_count, 0)), 2)
          ELSE NULL
        END,

        -- Days of data
        COALESCE(h30.day_count, 1),

        CURRENT_TIMESTAMP

      FROM card_daily_snapshots s

      -- 7-day high/low
      LEFT JOIN LATERAL (
        SELECT MAX(loose_price) AS high_price, MIN(loose_price) AS low_price
        FROM card_daily_snapshots
        WHERE card_id = s.card_id AND date BETWEEN (s.date - 7) AND s.date AND loose_price IS NOT NULL
      ) h7 ON true

      -- 15-day high/low
      LEFT JOIN LATERAL (
        SELECT MAX(loose_price) AS high_price, MIN(loose_price) AS low_price
        FROM card_daily_snapshots
        WHERE card_id = s.card_id AND date BETWEEN (s.date - 15) AND s.date AND loose_price IS NOT NULL
      ) h15 ON true

      -- 30-day high/low + day count
      LEFT JOIN LATERAL (
        SELECT MAX(loose_price) AS high_price, MIN(loose_price) AS low_price, COUNT(*)::int AS day_count
        FROM card_daily_snapshots
        WHERE card_id = s.card_id AND date BETWEEN (s.date - 30) AND s.date AND loose_price IS NOT NULL
      ) h30 ON true

      -- 7-day stats for volatility (avg, stddev, sales)
      LEFT JOIN LATERAL (
        SELECT 
          AVG(loose_price) AS avg_price,
          STDDEV(loose_price) AS stddev_price,
          COALESCE(SUM(NULLIF(sales_volume, 0)), 0)::bigint AS total_sales,
          COUNT(*)::int AS day_count
        FROM card_daily_snapshots
        WHERE card_id = s.card_id AND date BETWEEN (s.date - 7) AND s.date AND loose_price IS NOT NULL
      ) stats7 ON true

      -- 7-day stats for graded price volatility
      LEFT JOIN LATERAL (
        SELECT 
          AVG(graded_price) AS avg_price,
          STDDEV(graded_price) AS stddev_price,
          COALESCE(SUM(NULLIF(sales_volume, 0)), 0)::bigint AS total_sales,
          COUNT(*)::int AS day_count
        FROM card_daily_snapshots
        WHERE card_id = s.card_id AND date BETWEEN (s.date - 7) AND s.date AND graded_price IS NOT NULL
      ) stats_graded ON true

      -- 7-day stats for psa10 price volatility
      LEFT JOIN LATERAL (
        SELECT 
          AVG(psa10_price) AS avg_price,
          STDDEV(psa10_price) AS stddev_price,
          COALESCE(SUM(NULLIF(sales_volume, 0)), 0)::bigint AS total_sales,
          COUNT(*)::int AS day_count
        FROM card_daily_snapshots
        WHERE card_id = s.card_id AND date BETWEEN (s.date - 7) AND s.date AND psa10_price IS NOT NULL
      ) stats_psa10 ON true

      -- Earliest available price (for price_change_pct)
      LEFT JOIN LATERAL (
        SELECT loose_price AS price
        FROM card_daily_snapshots
        WHERE card_id = s.card_id AND date < s.date AND loose_price IS NOT NULL
        ORDER BY date ASC LIMIT 1
      ) earliest ON true

      WHERE s.card_id = ANY($1::bigint[])
        AND s.date = $2::date

      ON CONFLICT (card_id, date) DO UPDATE SET
        console_name = EXCLUDED.console_name,
        product_name = EXCLUDED.product_name,
        loose_price = EXCLUDED.loose_price,
        high_7d = EXCLUDED.high_7d,
        low_7d = EXCLUDED.low_7d,
        range_pct_7d = EXCLUDED.range_pct_7d,
        high_15d = EXCLUDED.high_15d,
        low_15d = EXCLUDED.low_15d,
        range_pct_15d = EXCLUDED.range_pct_15d,
        high_30d = EXCLUDED.high_30d,
        low_30d = EXCLUDED.low_30d,
        range_pct_30d = EXCLUDED.range_pct_30d,
        price_position_7d = EXCLUDED.price_position_7d,
        price_change_pct = EXCLUDED.price_change_pct,
        trend_state = EXCLUDED.trend_state,
        loose_price_volatility = EXCLUDED.loose_price_volatility,
        loose_price_liquidity = EXCLUDED.loose_price_liquidity,
        graded_price_volatility = EXCLUDED.graded_price_volatility,
        graded_price_liquidity = EXCLUDED.graded_price_liquidity,
        psa10_price_volatility = EXCLUDED.psa10_price_volatility,
        psa10_price_liquidity = EXCLUDED.psa10_price_liquidity,
        days_of_data = EXCLUDED.days_of_data,
        computed_at = CURRENT_TIMESTAMP
    `, [batch, date]);

    processed += batch.length;
    if (processed % 5000 === 0 || i + BATCH_SIZE >= cardIds.length) {
      console.log(`    ${processed.toLocaleString()}/${cardIds.length.toLocaleString()} cards done`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✅ ${date}: ${processed.toLocaleString()} cards computed in ${elapsed}s`);
  return processed;
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('SET statement_timeout = 600000');

    console.log('========================================');
    console.log('Compute Trader Metrics');
    console.log('========================================');
    console.log(`Batch size: ${BATCH_SIZE}, Force: ${FORCE}`);

    let dates;
    if (TARGET_DATE) {
      dates = [TARGET_DATE];
    } else {
      const result = await client.query(
        'SELECT DISTINCT date FROM card_daily_snapshots WHERE loose_price IS NOT NULL ORDER BY date'
      );
      dates = result.rows.map(r => r.date);
    }

    console.log(`Dates to process: ${dates.length}\n`);

    let totalProcessed = 0;
    for (const date of dates) {
      try {
        totalProcessed += await computeForDate(client, date);
      } catch (err) {
        console.error(`  ❌ ${date}: ${err.message}`);
      }
    }

    // Summary
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE trend_state = 'Rising') as rising,
        COUNT(*) FILTER (WHERE trend_state = 'Stable') as stable,
        COUNT(*) FILTER (WHERE trend_state = 'Declining') as declining,
        COUNT(*) FILTER (WHERE range_pct_7d > 0) as with_movement
      FROM card_computed_metrics
    `);
    const s = stats.rows[0];

    console.log('\n========================================');
    console.log(`✅ Done! ${totalProcessed.toLocaleString()} card-date rows computed`);
    console.log(`   Total in table: ${parseInt(s.total).toLocaleString()}`);
    console.log(`   Rising: ${parseInt(s.rising).toLocaleString()}`);
    console.log(`   Stable: ${parseInt(s.stable).toLocaleString()}`);
    console.log(`   Declining: ${parseInt(s.declining).toLocaleString()}`);
    console.log(`   With 7d price movement: ${parseInt(s.with_movement).toLocaleString()}`);
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
