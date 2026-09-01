/**
 * compute-metrics-resilient.js - Compute with automatic retry and smaller transactions
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

const DATE = process.argv[2] || '2026-01-21';
const BATCH_SIZE = 500; // Smaller batches

async function computeBatch(client, cardIds, date) {
  await client.query(`
    INSERT INTO card_computed_metrics (
      card_id, date, console_name, product_name, loose_price,
      graded_price, psa10_price, bgs10_price, sales_volume,
      high_7d, low_7d, range_pct_7d,
      high_15d, low_15d, range_pct_15d,
      high_30d, low_30d, range_pct_30d,
      price_position_7d, price_change_pct, trend_state, days_of_data, computed_at
    )
    SELECT
      s.card_id, s.date, s.console_name, s.product_name, s.loose_price,
      s.graded_price, s.psa10_price, s.bgs10_price, s.sales_volume,
      COALESCE(h7.high_price, s.loose_price),
      COALESCE(h7.low_price, s.loose_price),
      CASE WHEN COALESCE(h7.low_price, s.loose_price) > 0
        THEN LEAST(9999.99, ROUND(((COALESCE(h7.high_price, s.loose_price) - COALESCE(h7.low_price, s.loose_price))
              / COALESCE(h7.low_price, s.loose_price) * 100)::NUMERIC, 2))
        ELSE 0 END,
      COALESCE(h15.high_price, s.loose_price),
      COALESCE(h15.low_price, s.loose_price),
      CASE WHEN COALESCE(h15.low_price, s.loose_price) > 0
        THEN LEAST(9999.99, ROUND(((COALESCE(h15.high_price, s.loose_price) - COALESCE(h15.low_price, s.loose_price))
              / COALESCE(h15.low_price, s.loose_price) * 100)::NUMERIC, 2))
        ELSE 0 END,
      COALESCE(h30.high_price, s.loose_price),
      COALESCE(h30.low_price, s.loose_price),
      CASE WHEN COALESCE(h30.low_price, s.loose_price) > 0
        THEN LEAST(9999.99, ROUND(((COALESCE(h30.high_price, s.loose_price) - COALESCE(h30.low_price, s.loose_price))
              / COALESCE(h30.low_price, s.loose_price) * 100)::NUMERIC, 2))
        ELSE 0 END,
      CASE WHEN COALESCE(h7.high_price, s.loose_price) = COALESCE(h7.low_price, s.loose_price) THEN 50.0
        ELSE ROUND(((s.loose_price - COALESCE(h7.low_price, s.loose_price))
              / (COALESCE(h7.high_price, s.loose_price) - COALESCE(h7.low_price, s.loose_price)) * 100)::NUMERIC, 1)
      END,
      CASE WHEN COALESCE(earliest.price, s.loose_price) > 0
        THEN LEAST(999999.99, GREATEST(-999999.99, ROUND(((s.loose_price - COALESCE(earliest.price, s.loose_price))
              / COALESCE(earliest.price, s.loose_price) * 100)::NUMERIC, 2)))
        ELSE 0 END,
      CASE WHEN COALESCE(earliest.price, s.loose_price) > 0 THEN
        CASE WHEN ((s.loose_price - COALESCE(earliest.price, s.loose_price))
              / COALESCE(earliest.price, s.loose_price)) > 0.03 THEN 'Rising'
          WHEN ((s.loose_price - COALESCE(earliest.price, s.loose_price))
              / COALESCE(earliest.price, s.loose_price)) < -0.03 THEN 'Declining'
          ELSE 'Stable' END
        ELSE 'Stable' END,
      COALESCE(h30.day_count, 1),
      CURRENT_TIMESTAMP
    FROM card_daily_snapshots s
    LEFT JOIN LATERAL (SELECT MAX(loose_price) AS high_price, MIN(loose_price) AS low_price
      FROM card_daily_snapshots WHERE card_id = s.card_id AND date BETWEEN (s.date - 7) AND s.date AND loose_price IS NOT NULL
    ) h7 ON true
    LEFT JOIN LATERAL (SELECT MAX(loose_price) AS high_price, MIN(loose_price) AS low_price
      FROM card_daily_snapshots WHERE card_id = s.card_id AND date BETWEEN (s.date - 15) AND s.date AND loose_price IS NOT NULL
    ) h15 ON true
    LEFT JOIN LATERAL (SELECT MAX(loose_price) AS high_price, MIN(loose_price) AS low_price, COUNT(*)::int AS day_count
      FROM card_daily_snapshots WHERE card_id = s.card_id AND date BETWEEN (s.date - 30) AND s.date AND loose_price IS NOT NULL
    ) h30 ON true
    LEFT JOIN LATERAL (SELECT loose_price AS price FROM card_daily_snapshots
      WHERE card_id = s.card_id AND date < s.date AND loose_price IS NOT NULL ORDER BY date ASC LIMIT 1
    ) earliest ON true
    WHERE s.card_id = ANY($1::bigint[]) AND s.date = $2::date
    ON CONFLICT (card_id, date) DO UPDATE SET
      console_name = EXCLUDED.console_name, product_name = EXCLUDED.product_name,
      loose_price = EXCLUDED.loose_price, high_7d = EXCLUDED.high_7d, low_7d = EXCLUDED.low_7d,
      range_pct_7d = EXCLUDED.range_pct_7d, high_15d = EXCLUDED.high_15d, low_15d = EXCLUDED.low_15d,
      range_pct_15d = EXCLUDED.range_pct_15d, high_30d = EXCLUDED.high_30d, low_30d = EXCLUDED.low_30d,
      range_pct_30d = EXCLUDED.range_pct_30d, price_position_7d = EXCLUDED.price_position_7d,
      price_change_pct = EXCLUDED.price_change_pct, trend_state = EXCLUDED.trend_state,
      days_of_data = EXCLUDED.days_of_data, computed_at = CURRENT_TIMESTAMP
  `, [cardIds, date]);
}

async function main() {
  console.log(`Computing metrics for ${DATE} with batch size ${BATCH_SIZE}...\n`);
  
  let client = await pool.connect();
  await client.query('SET statement_timeout = 300000');
  
  // Get all card IDs for this date
  const result = await client.query(`
    SELECT card_id FROM card_daily_snapshots 
    WHERE date = $1::date AND loose_price IS NOT NULL 
      AND console_name IS NOT NULL AND product_name IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM card_computed_metrics WHERE card_id = card_daily_snapshots.card_id AND date = $1::date)
    ORDER BY card_id
  `, [DATE]);
  
  const allCardIds = result.rows.map(r => r.card_id);
  console.log(`Total cards to process: ${allCardIds.length.toLocaleString()}`);
  
  client.release();
  
  let processed = 0;
  let failed = 0;
  
  for (let i = 0; i < allCardIds.length; i += BATCH_SIZE) {
    const batch = allCardIds.slice(i, i + BATCH_SIZE);
    
    try {
      client = await pool.connect();
      await client.query('SET statement_timeout = 120000');
      await computeBatch(client, batch, DATE);
      client.release();
      
      processed += batch.length;
      if (processed % 10000 === 0 || i + BATCH_SIZE >= allCardIds.length) {
        console.log(`  ${processed.toLocaleString()}/${allCardIds.length.toLocaleString()} cards done`);
      }
    } catch (err) {
      failed += batch.length;
      console.error(`  ❌ Batch failed: ${err.message}`);
      if (client) client.release();
    }
    
    // Small delay to let connection pool recover
    if (i % 50000 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log(`\n✅ Done! Processed: ${processed}, Failed: ${failed}`);
  
  // Verify
  client = await pool.connect();
  const verify = await client.query(`SELECT COUNT(*) as cnt FROM card_computed_metrics WHERE date = $1::date`, [DATE]);
  console.log(`Total rows in table for ${DATE}: ${verify.rows[0].cnt}`);
  client.release();
  
  await pool.end();
}

main().catch(e => { console.error('Fatal:', e.message); pool.end(); process.exit(1); });
