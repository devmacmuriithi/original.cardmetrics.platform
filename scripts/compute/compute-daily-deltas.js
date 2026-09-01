/**
 * compute-daily-deltas.js - Compute yesterday/today/diff for all price fields
 * 
 * Usage: node compute-daily-deltas.js [--date=YYYY-MM-DD] [--batch-size=500]
 * 
 * This script:
 * 1. Reads card_daily_snapshots for target date and prior day
 * 2. Computes yesterday/today/diff for all price fields
 * 3. Populates card_daily_deltas table with denormalized reference fields
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 500;
const TARGET_DATE = process.argv.find(arg => arg.startsWith('--date='))?.split('=')[1];

// Price fields to compute deltas for
const PRICE_FIELDS = [
  'loose_price',
  'graded_price',
  'psa10_price',
  'bgs10_price',
  'cib_price',
  'new_price',
  'box_only_price',
  'manual_only_price',
  'condition_17_price',
  'condition_18_price',
  'gamestop_price',
  'gamestop_trade_price',
  'retail_loose_buy',
  'retail_loose_sell',
  'retail_cib_buy',
  'retail_cib_sell',
  'retail_new_buy',
  'retail_new_sell',
  'sales_volume'
];

// Compute deltas for a specific date
async function computeDeltasForDate(client, date) {
  console.log(`\n📊 Computing daily deltas for ${date}...`);
  
  // Get the prior day that has data (might not be exactly yesterday if gaps)
  const priorDateResult = await client.query(`
    SELECT MAX(date) as prior_date 
    FROM card_daily_snapshots 
    WHERE date < $1
  `, [date]);
  
  const priorDate = priorDateResult.rows[0].prior_date;
  
  if (!priorDate) {
    console.log(`   ⚠️  No prior day data found before ${date}`);
    console.log(`   Storing today's data without delta calculations...`);
  } else {
    console.log(`   Using prior day: ${priorDate}`);
  }
  
  // Clear existing data for this date
  await client.query('DELETE FROM card_daily_deltas WHERE date = $1', [date]);
  
  // Get all cards with snapshots for this date
  const cardsResult = await client.query(`
    SELECT DISTINCT card_id 
    FROM card_daily_snapshots 
    WHERE date = $1
    ORDER BY card_id
  `, [date]);
  
  const cards = cardsResult.rows;
  console.log(`   Found ${cards.length} cards with data for ${date}`);
  
  let processed = 0;
  let withPriorData = 0;
  
  // Process in batches
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    const cardIds = batch.map(c => c.card_id);
    
    // Build the INSERT query dynamically
    const todayFields = PRICE_FIELDS.map(f => `t.${f}`).join(',\n        ');
    
    // Build the INSERT query with proper inline calculations
    const insertColumns = PRICE_FIELDS.flatMap(f => [
      `${f}_yesterday`,
      `${f}_today`,
      `${f}_diff`,
      `${f}_diff_pct`
    ]).join(',\n        ');
    
    // For VALUES clause, we need to repeat the CASE expressions inline
    const insertValues = PRICE_FIELDS.flatMap(f => {
      if (priorDate) {
        return [
          `y.${f}`,
          `t.${f}`,
          `CASE WHEN y.${f} IS NOT NULL THEN t.${f} - y.${f} ELSE NULL END`,
          `CASE WHEN y.${f} IS NOT NULL AND y.${f} > 0 THEN GREATEST(-9999.99, LEAST(9999.99, ROUND(((t.${f} - y.${f}) / y.${f} * 100)::numeric, 2))) ELSE NULL END`
        ];
      } else {
        return ['NULL', `t.${f}`, 'NULL', 'NULL'];
      }
    }).join(',\n        ');
    
    const query = `
      INSERT INTO card_daily_deltas (
        card_id, console_uid, date, console_name, product_name,
        ${insertColumns},
        has_prior_day_data,
        computed_at
      )
      SELECT 
        t.card_id,
        t.console_uid,
        $2 as date,
        t.console_name,
        t.product_name,
        ${insertValues},
        ${priorDate ? 'TRUE' : 'FALSE'} as has_prior_day_data,
        CURRENT_TIMESTAMP
      FROM card_daily_snapshots t
      ${priorDate ? `
      LEFT JOIN card_daily_snapshots y 
        ON y.card_id = t.card_id 
        AND y.date = $3
      ` : ''}
      WHERE t.date = $2
      AND t.card_id = ANY($1)
      ON CONFLICT (card_id, date) DO UPDATE SET
        loose_price_yesterday = EXCLUDED.loose_price_yesterday,
        loose_price_today = EXCLUDED.loose_price_today,
        loose_price_diff = EXCLUDED.loose_price_diff,
        loose_price_diff_pct = EXCLUDED.loose_price_diff_pct,
        graded_price_yesterday = EXCLUDED.graded_price_yesterday,
        graded_price_today = EXCLUDED.graded_price_today,
        graded_price_diff = EXCLUDED.graded_price_diff,
        graded_price_diff_pct = EXCLUDED.graded_price_diff_pct,
        psa10_price_yesterday = EXCLUDED.psa10_price_yesterday,
        psa10_price_today = EXCLUDED.psa10_price_today,
        psa10_price_diff = EXCLUDED.psa10_price_diff,
        psa10_price_diff_pct = EXCLUDED.psa10_price_diff_pct,
        bgs10_price_yesterday = EXCLUDED.bgs10_price_yesterday,
        bgs10_price_today = EXCLUDED.bgs10_price_today,
        bgs10_price_diff = EXCLUDED.bgs10_price_diff,
        bgs10_price_diff_pct = EXCLUDED.bgs10_price_diff_pct,
        cib_price_yesterday = EXCLUDED.cib_price_yesterday,
        cib_price_today = EXCLUDED.cib_price_today,
        cib_price_diff = EXCLUDED.cib_price_diff,
        cib_price_diff_pct = EXCLUDED.cib_price_diff_pct,
        new_price_yesterday = EXCLUDED.new_price_yesterday,
        new_price_today = EXCLUDED.new_price_today,
        new_price_diff = EXCLUDED.new_price_diff,
        new_price_diff_pct = EXCLUDED.new_price_diff_pct,
        has_prior_day_data = EXCLUDED.has_prior_day_data,
        computed_at = CURRENT_TIMESTAMP
    `;
    
    const params = priorDate 
      ? [cardIds, date, priorDate]
      : [cardIds, date];
    
    await client.query(query, params);
    
    processed += batch.length;
    
    // Count how many had prior day data in this batch
    if (priorDate) {
      const countResult = await client.query(`
        SELECT COUNT(*) as cnt 
        FROM card_daily_deltas 
        WHERE date = $1 
        AND card_id = ANY($2)
        AND has_prior_day_data = TRUE
      `, [date, cardIds]);
      withPriorData += parseInt(countResult.rows[0].cnt);
    }
    
    if (processed % 1000 === 0 || processed === cards.length) {
      console.log(`   Processed ${processed}/${cards.length} cards... (${withPriorData} with prior day data)`);
    }
  }
  
  console.log(`   ✅ Computed deltas for ${processed} cards (${withPriorData} with prior day comparisons)`);
  return processed;
}

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('Compute Daily Price Deltas');
    console.log('========================================');
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Price fields: ${PRICE_FIELDS.length} fields`);
    
    if (TARGET_DATE) {
      await computeDeltasForDate(client, TARGET_DATE);
    } else {
      // Get all unique dates from snapshots
      const datesResult = await client.query(
        'SELECT DISTINCT date FROM card_daily_snapshots ORDER BY date'
      );
      
      console.log(`\nFound ${datesResult.rows.length} dates to process`);
      
      for (const row of datesResult.rows) {
        await computeDeltasForDate(client, row.date);
      }
    }
    
    console.log('\n========================================');
    console.log('✅ All daily deltas computed successfully!');
    console.log('========================================');
    
    // Show summary
    const summaryResult = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE has_prior_day_data = TRUE) as with_prior_data,
        COUNT(DISTINCT date) as dates
      FROM card_daily_deltas
    `);
    
    const s = summaryResult.rows[0];
    console.log(`\nSummary:`);
    console.log(`  Total delta records: ${s.total_records}`);
    console.log(`  Records with prior day data: ${s.with_prior_data}`);
    console.log(`  Dates covered: ${s.dates}`);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
