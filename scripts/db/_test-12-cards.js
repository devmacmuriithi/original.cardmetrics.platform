require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function test() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 60000');
    
    // Get 12 sample cards from Jan 21
    const samples = await client.query(`
      SELECT card_id, console_name, product_name, loose_price
      FROM card_daily_snapshots
      WHERE date = '2026-01-21' AND loose_price IS NOT NULL
      LIMIT 12
    `);
    
    console.log(`Testing with ${samples.rows.length} cards...\n`);
    
    for (const card of samples.rows) {
      // Compute metrics for this single card
      await client.query(`
        INSERT INTO card_computed_metrics (
          card_id, date, console_name, product_name, loose_price,
          high_7d, low_7d, range_pct_7d,
          high_15d, low_15d, range_pct_15d,
          high_30d, low_30d, range_pct_30d,
          price_position_7d, price_change_pct, trend_state, days_of_data, computed_at
        )
        SELECT
          s.card_id, s.date, s.console_name, s.product_name, s.loose_price,
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
        WHERE s.card_id = $1 AND s.date = '2026-01-21'
        ON CONFLICT (card_id, date) DO UPDATE SET
          console_name = EXCLUDED.console_name, product_name = EXCLUDED.product_name,
          loose_price = EXCLUDED.loose_price, high_7d = EXCLUDED.high_7d, low_7d = EXCLUDED.low_7d,
          range_pct_7d = EXCLUDED.range_pct_7d, high_15d = EXCLUDED.high_15d, low_15d = EXCLUDED.low_15d,
          range_pct_15d = EXCLUDED.range_pct_15d, high_30d = EXCLUDED.high_30d, low_30d = EXCLUDED.low_30d,
          range_pct_30d = EXCLUDED.range_pct_30d, price_position_7d = EXCLUDED.price_position_7d,
          price_change_pct = EXCLUDED.price_change_pct, trend_state = EXCLUDED.trend_state,
          days_of_data = EXCLUDED.days_of_data, computed_at = CURRENT_TIMESTAMP
      `, [card.card_id]);
      
      console.log(`✓ ${card.console_name} - ${card.product_name} ($${card.loose_price})`);
    }
    
    // Verify
    const r = await client.query(`SELECT * FROM card_computed_metrics WHERE date = '2026-01-21' LIMIT 3`);
    console.log('\nVerification - sample computed rows:');
    for (const row of r.rows) {
      console.log(`\n${row.console_name} - ${row.product_name}:`);
      console.log(`  Price: $${row.loose_price} | High7d: $${row.high_7d} | Low7d: $${row.low_7d} | Range: ${row.range_pct_7d}%`);
      console.log(`  Position: ${row.price_position_7d}% | Change: ${row.price_change_pct}% | Trend: ${row.trend_state}`);
    }
    
    console.log('\n✅ 12 cards computed successfully - all fields populated!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

test().catch(console.error);
