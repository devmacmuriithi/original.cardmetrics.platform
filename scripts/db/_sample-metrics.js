/**
 * Sample 12 cards and compute the "unique" computed_metrics fields
 * to validate whether they're relevant/meaningful.
 * 
 * Fields tested:
 *   - momentum: (avg_30d - avg_90d) / avg_90d
 *   - trend_state: Rising / Stable / Declining
 *   - volatility_score: stddev_30d / avg_30d
 *   - price_stddev_30d: raw stddev over 30 days
 *   - high_price_30d / low_price_30d
 *   - liquidity_score: sales_velocity / 100 (capped at 1)
 *   - sales_velocity: sales_volume / days_of_data
 *   - execution_eligible: enough data + low volatility
 *   - estimated_market_cap: loose_price * sales_velocity * 365
 */
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 120000');

    // Pick a date with good data (latest full date)
    const dateRes = await client.query(`
      SELECT date FROM card_daily_snapshots
      WHERE avg_3d IS NOT NULL
      GROUP BY date ORDER BY date DESC LIMIT 1
    `);

    let targetDate;
    if (dateRes.rows.length > 0) {
      targetDate = new Date(dateRes.rows[0].date).toISOString().slice(0, 10);
    } else {
      // Fallback: use latest date with data
      const fallback = await client.query(`
        SELECT date FROM card_daily_snapshots
        WHERE loose_price IS NOT NULL
        GROUP BY date ORDER BY date DESC LIMIT 1
      `);
      targetDate = new Date(fallback.rows[0].date).toISOString().slice(0, 10);
    }

    console.log(`\nTarget date: ${targetDate}\n`);

    // Sample 12 cards that have price data on multiple dates (for meaningful calculations)
    const sample = await client.query(`
      SELECT s.card_id, s.product_name, s.console_name, s.loose_price, s.sales_volume,
             s.avg_3d, s.avg_7d, s.avg_14d, s.avg_30d, s.avg_60d, s.avg_90d,
             s.data_points_3d, s.data_points_7d, s.data_points_30d, s.data_points_90d
      FROM card_daily_snapshots s
      WHERE s.date = $1
        AND s.loose_price IS NOT NULL
        AND s.loose_price > 1.00
        AND s.sales_volume IS NOT NULL
        AND s.sales_volume > 0
      ORDER BY RANDOM()
      LIMIT 12
    `, [targetDate]);

    if (sample.rows.length === 0) {
      console.log('No cards found with price + volume data on this date.');
      console.log('Trying without volume filter...');
      const sample2 = await client.query(`
        SELECT s.card_id, s.product_name, s.console_name, s.loose_price, s.sales_volume,
               s.avg_3d, s.avg_7d, s.avg_14d, s.avg_30d, s.avg_60d, s.avg_90d,
               s.data_points_3d, s.data_points_7d, s.data_points_30d, s.data_points_90d
        FROM card_daily_snapshots s
        WHERE s.date = $1
          AND s.loose_price IS NOT NULL
          AND s.loose_price > 1.00
        ORDER BY RANDOM()
        LIMIT 12
      `, [targetDate]);
      sample.rows = sample2.rows;
    }

    console.log(`Sampled ${sample.rows.length} cards\n`);
    console.log('='.repeat(120));

    for (const card of sample.rows) {
      // Get price history for this card (last 90 days)
      const history = await client.query(`
        SELECT date, loose_price, sales_volume
        FROM card_daily_snapshots
        WHERE card_id = $1 AND date <= $2 AND loose_price IS NOT NULL
        ORDER BY date DESC
        LIMIT 90
      `, [card.card_id, targetDate]);

      const prices = history.rows.map(r => parseFloat(r.loose_price));
      const daysOfData = prices.length;

      // --- Compute unique fields ---

      // Averages (from card_daily_snapshots if available, else compute)
      const avg30 = card.avg_30d ? parseFloat(card.avg_30d) : (prices.length >= 2 ? prices.slice(0, 30).reduce((a, b) => a + b, 0) / Math.min(prices.length, 30) : null);
      const avg90 = card.avg_90d ? parseFloat(card.avg_90d) : (prices.length >= 3 ? prices.reduce((a, b) => a + b, 0) / prices.length : null);

      // Momentum: (avg_30d - avg_90d) / avg_90d
      let momentum = null;
      if (avg30 && avg90 && avg90 > 0.01) {
        momentum = ((avg30 - avg90) / avg90).toFixed(4);
      }

      // Trend state
      let trendState = null;
      if (momentum !== null) {
        const m = parseFloat(momentum);
        trendState = m > 0.05 ? 'Rising' : m < -0.05 ? 'Declining' : 'Stable';
      }

      // Volatility: stddev_30d / avg_30d
      const prices30 = prices.slice(0, Math.min(30, prices.length));
      let volatility = null;
      let stddev30 = null;
      if (prices30.length >= 2 && avg30 && avg30 > 0.01) {
        const mean = prices30.reduce((a, b) => a + b, 0) / prices30.length;
        const variance = prices30.reduce((a, b) => a + (b - mean) ** 2, 0) / prices30.length;
        stddev30 = Math.sqrt(variance);
        volatility = (stddev30 / avg30).toFixed(4);
      }

      // High/Low 30d
      const high30 = prices30.length > 0 ? Math.max(...prices30) : null;
      const low30 = prices30.length > 0 ? Math.min(...prices30) : null;

      // Liquidity
      const salesVol = card.sales_volume ? parseFloat(card.sales_volume) : 0;
      const salesVelocity = daysOfData > 0 ? (salesVol / Math.max(daysOfData, 1)).toFixed(2) : 0;
      const liquidityScore = Math.min(parseFloat(salesVelocity) / 100, 1.0).toFixed(4);

      // Execution eligible
      const execEligible = daysOfData >= 7 && avg30 > 0.01 && volatility && parseFloat(volatility) < 0.5;

      // Market cap estimate
      const loosePrice = parseFloat(card.loose_price);
      const marketCap = (loosePrice * parseFloat(salesVelocity) * 365).toFixed(2);

      // --- Display ---
      console.log(`\nCard ID: ${card.card_id}`);
      console.log(`  Product:  ${card.product_name}`);
      console.log(`  Set:      ${card.console_name}`);
      console.log(`  Price:    $${loosePrice.toFixed(2)}  |  Days of data: ${daysOfData}`);
      console.log(`  ---`);
      console.log(`  avg_30d:           ${avg30 ? '$' + avg30.toFixed(2) : 'NULL'}`);
      console.log(`  avg_90d:           ${avg90 ? '$' + avg90.toFixed(2) : 'NULL'}`);
      console.log(`  momentum:          ${momentum ?? 'NULL'}  (${trendState ?? 'N/A'})`);
      console.log(`  volatility_score:  ${volatility ?? 'NULL'}`);
      console.log(`  stddev_30d:        ${stddev30 ? '$' + stddev30.toFixed(2) : 'NULL'}`);
      console.log(`  high_30d:          ${high30 ? '$' + high30.toFixed(2) : 'NULL'}`);
      console.log(`  low_30d:           ${low30 ? '$' + low30.toFixed(2) : 'NULL'}`);
      console.log(`  sales_velocity:    ${salesVelocity}/day`);
      console.log(`  liquidity_score:   ${liquidityScore}`);
      console.log(`  exec_eligible:     ${execEligible}`);
      console.log(`  est_market_cap:    $${parseFloat(marketCap).toLocaleString()}`);
      console.log(`  ---`);
      console.log(`  Price history (last 5): ${prices.slice(0, 5).map(p => '$' + p.toFixed(2)).join(' → ')}`);
    }

    console.log('\n' + '='.repeat(120));
    console.log('\nDone! Review the fields above to decide which are relevant.\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Error:', e.message); pool.end(); });
