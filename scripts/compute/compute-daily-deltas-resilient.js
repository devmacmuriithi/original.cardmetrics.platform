/**
 * compute-daily-deltas-resilient.js - Resilient version with retry logic
 * 
 * Usage: node compute-daily-deltas-resilient.js --date=YYYY-MM-DD [--batch-size=200]
 */

require('dotenv').config();
const { Pool } = require('pg');

const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 200;
const TARGET_DATE = process.argv.find(arg => arg.startsWith('--date='))?.split('=')[1];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  statement_timeout: 300000 // 5 minutes
});

const PRICE_FIELDS = [
  'loose_price', 'graded_price', 'psa10_price', 'bgs10_price', 'cib_price', 'new_price',
  'box_only_price', 'manual_only_price', 'condition_17_price', 'condition_18_price',
  'gamestop_price', 'gamestop_trade_price', 'retail_loose_buy', 'retail_loose_sell',
  'retail_cib_buy', 'retail_cib_sell', 'retail_new_buy', 'retail_new_sell', 'sales_volume'
];

async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.log(`   Retry ${attempt}/${maxRetries} after error: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

async function computeDeltasForDate(client, date) {
  console.log(`\n📊 Computing daily deltas for ${date}...`);
  
  const priorDateResult = await client.query(`
    SELECT MAX(date) as prior_date 
    FROM card_daily_snapshots 
    WHERE date < $1
  `, [date]);
  
  const priorDate = priorDateResult.rows[0].prior_date;
  
  if (!priorDate) {
    console.log(`   ⚠️  No prior day data found before ${date}`);
  } else {
    console.log(`   Using prior day: ${priorDate}`);
  }
  
  // Check for existing progress
  const existingResult = await client.query(
    'SELECT COUNT(*) as cnt FROM card_daily_deltas WHERE date = $1',
    [date]
  );
  const existingCount = parseInt(existingResult.rows[0].cnt);
  
  if (existingCount > 0) {
    console.log(`   Found ${existingCount} existing records. Keeping and adding missing...`);
  }
  
  // Get cards needing computation (not in deltas yet)
  const cardsResult = await withRetry(() => client.query(`
    SELECT DISTINCT s.card_id 
    FROM card_daily_snapshots s
    LEFT JOIN card_daily_deltas d 
      ON d.card_id = s.card_id AND d.date = $1
    WHERE s.date = $1 AND d.card_id IS NULL
    ORDER BY s.card_id
  `, [date]));
  
  const cards = cardsResult.rows;
  console.log(`   Found ${cards.length} cards needing delta computation`);
  
  if (cards.length === 0) {
    console.log(`   ✅ All cards already have deltas for ${date}`);
    return existingCount;
  }
  
  let processed = 0;
  let withPriorData = 0;
  let lastError = null;
  
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    const cardIds = batch.map(c => c.card_id);
    
    try {
      await withRetry(async () => {
        const todayFields = PRICE_FIELDS.map(f => `t.${f}`).join(',\n        ');
        const insertColumns = PRICE_FIELDS.flatMap(f => [
          `${f}_yesterday`, `${f}_today`, `${f}_diff`, `${f}_diff_pct`
        ]).join(',\n        ');
        
        const insertValues = PRICE_FIELDS.flatMap(f => {
          if (priorDate) {
            return [
              `y.${f}`, `t.${f}`,
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
            ${insertColumns}, has_prior_day_data, computed_at
          )
          SELECT 
            t.card_id, t.console_uid, $2 as date, t.console_name, t.product_name,
            ${insertValues}, ${priorDate ? 'TRUE' : 'FALSE'} as has_prior_day_data, CURRENT_TIMESTAMP
          FROM card_daily_snapshots t
          ${priorDate ? `LEFT JOIN card_daily_snapshots y ON y.card_id = t.card_id AND y.date = $3` : ''}
          WHERE t.date = $2 AND t.card_id = ANY($1)
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
            has_prior_day_data = EXCLUDED.has_prior_day_data,
            computed_at = CURRENT_TIMESTAMP
        `;
        
        const params = priorDate ? [cardIds, date, priorDate] : [cardIds, date];
        await client.query(query, params);
      });
      
      processed += batch.length;
      
      // Count prior day data for this batch
      if (priorDate) {
        const countResult = await client.query(`
          SELECT COUNT(*) as cnt 
          FROM card_daily_deltas 
          WHERE date = $1 AND card_id = ANY($2) AND has_prior_day_data = TRUE
        `, [date, cardIds]);
        withPriorData += parseInt(countResult.rows[0].cnt);
      }
      
      if (processed % 1000 === 0 || processed === cards.length) {
        console.log(`   Processed ${processed}/${cards.length}... (${withPriorData} with prior day data)`);
      }
      
      lastError = null;
    } catch (err) {
      lastError = err;
      console.log(`   ⚠️  Batch failed after retries: ${err.message}`);
      console.log(`   Continuing with next batch...`);
    }
  }
  
  console.log(`   ✅ Computed deltas for ${processed} cards (${withPriorData} with prior day comparisons)`);
  if (lastError) {
    console.log(`   ⚠️  Some batches failed - run again to complete missing data`);
  }
  return processed;
}

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('Compute Daily Price Deltas (Resilient)');
    console.log('========================================');
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Price fields: ${PRICE_FIELDS.length} fields`);
    
    if (TARGET_DATE) {
      await computeDeltasForDate(client, TARGET_DATE);
    } else {
      console.log('❌ Please specify --date=YYYY-MM-DD');
      process.exit(1);
    }
    
    console.log('\n========================================');
    console.log('✅ Daily delta computation complete!');
    console.log('========================================');
    
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
