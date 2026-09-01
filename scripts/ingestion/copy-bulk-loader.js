/**
 * copy-bulk-loader.js - Step 2 & 3: Bulk Load via COPY + JSON Extract
 * 
 * Step 2: COPY cards_raw_ingests FROM '/path/to/YYYY-MM-DD_snapshot.csv'
 * Step 3: INSERT INTO card_market_daily via JSON extraction
 * 
 * Sequential version (single process)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = process.env.TEMP_DIR || './temp';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10
});

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().split('T')[0];
}

function getDateRange(start, end) {
  const dates = [];
  let current = start;
  while (current <= end) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function bulkLoadFromCSV(client, date, csvPath) {
  console.log(`\n📥 Step 2: COPY loading ${date}...`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`  ❌ File not found: ${csvPath}`);
    console.error(`  Run: node merge-csvs.js ${date} ${date}`);
    return 0;
  }

  // Clear existing data for this date
  await client.query('DELETE FROM cards_raw_ingests WHERE ingest_date = $1', [date]);

  // Use pg COPY FROM STDIN
  const copyQuery = `COPY cards_raw_ingests(ingest_date, console_uid, card_id, payload) FROM STDIN WITH (FORMAT csv, HEADER true)`;
  const stream = client.query(copyQuery);
  
  const fileStream = fs.createReadStream(csvPath);
  
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    
    fileStream.on('data', (chunk) => {
      stream.write(chunk);
      rowCount += (chunk.toString().match(/\n/g) || []).length;
    });
    
    fileStream.on('end', () => {
      stream.end();
    });
    
    stream.on('finish', () => {
      console.log(`  ✅ COPY loaded ~${rowCount} rows`);
      resolve(rowCount);
    });
    
    stream.on('error', reject);
    fileStream.on('error', reject);
  });
}

// Fallback: Batch insert if COPY doesn't work
async function bulkLoadFallback(client, date, csvPath) {
  const csv = require('csv-parser');
  const { Readable } = require('stream');

  await client.query('DELETE FROM cards_raw_ingests WHERE ingest_date = $1', [date]);

  const stream = fs.createReadStream(csvPath).pipe(csv());
  let batch = [];
  let total = 0;
  const BATCH_SIZE = 5000;

  for await (const row of stream) {
    batch.push([
      row.ingest_date,
      row.console_uid,
      parseInt(row.card_id),
      row.payload
    ]);

    if (batch.length >= BATCH_SIZE) {
      await flushBatch(client, batch);
      total += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await flushBatch(client, batch);
    total += batch.length;
  }

  console.log(`  ✅ Loaded ${total.toLocaleString()} rows (fallback)`);
  return total;
}

async function flushBatch(client, batch) {
  const values = batch.map((_, i) => 
    `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4}::jsonb)`
  ).join(',');

  const params = batch.flat();

  await client.query(
    `INSERT INTO cards_raw_ingests (ingest_date, console_uid, card_id, payload) 
     VALUES ${values}`,
    params
  );
}

async function extractToMarketDaily(client, date) {
  console.log(`\n📤 Step 3: Extracting to card_market_daily...`);

  const result = await client.query(`
    INSERT INTO card_market_daily (
      card_id, console_uid, date,
      loose_price, graded_price, psa10_price, bgs10_price,
      retail_loose_buy, retail_loose_sell, sales_volume
    )
    SELECT 
      card_id,
      console_uid,
      ingest_date,
      (payload->>'loose-price')::numeric,
      (payload->>'graded-price')::numeric,
      (payload->>'manual-only-price')::numeric,
      (payload->>'bgs-10-price')::numeric,
      (payload->>'retail-loose-buy')::numeric,
      (payload->>'retail-loose-sell')::numeric,
      (payload->>'sales-volume')::numeric
    FROM cards_raw_ingests
    WHERE ingest_date = $1
    ON CONFLICT (card_id, date) DO UPDATE SET
      loose_price = EXCLUDED.loose_price,
      graded_price = EXCLUDED.graded_price,
      psa10_price = EXCLUDED.psa10_price,
      bgs10_price = EXCLUDED.bgs10_price,
      retail_loose_buy = EXCLUDED.retail_loose_buy,
      retail_loose_sell = EXCLUDED.retail_loose_sell,
      sales_volume = EXCLUDED.sales_volume
  `, [date]);

  console.log(`  ✅ Extracted ${result.rowCount} rows`);
  return result.rowCount;
}

async function cleanupRawData(date) {
  const result = await pool.query(
    'DELETE FROM cards_raw_ingests WHERE ingest_date = $1',
    [date]
  );
  console.log(`  🗑️  Cleaned up ${result.rowCount} raw rows`);
}

async function processDate(date, keepRaw = false) {
  const csvPath = path.join(TEMP_DIR, `${date}_snapshot.csv`);

  console.log(`\n========================================`);
  console.log(`Processing ${date}`);
  console.log(`========================================`);

  const startTime = Date.now();

  return withTransaction(async (client) => {
    // Try COPY first, fallback to batch
    let rawCount;
    try {
      rawCount = await bulkLoadFromCSV(client, date, csvPath);
    } catch (err) {
      console.warn(`  COPY failed, using batch insert: ${err.message}`);
      rawCount = await bulkLoadFallback(client, date, csvPath);
    }

    if (rawCount === 0) {
      console.log('  No data loaded');
      return 0;
    }

    const extracted = await extractToMarketDaily(client, date);
    
    if (!keepRaw) {
      await cleanupRawData(date);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`  ✅ Completed in ${duration}s`);

    return extracted;
  });
}

(async () => {
  const args = process.argv.slice(2);
  const startDate = args[0];
  const endDate = args[1] || startDate;
  const keepRaw = args.includes('--keep-raw');

  if (!startDate) {
    console.error('Usage: node copy-bulk-loader.js <YYYY-MM-DD> [YYYY-MM-DD] [--keep-raw]');
    process.exit(1);
  }

  console.log('COPY Bulk Loader (Sequential)');
  console.log('=============================');
  console.log(`Date range: ${startDate} to ${endDate}`);

  const dates = getDateRange(startDate, endDate);
  let total = 0;

  try {
    for (const date of dates) {
      const count = await processDate(date, keepRaw);
      total += count;
    }

    console.log('\n🧹 VACUUM ANALYZE...');
    const client = await pool.connect();
    await client.query('VACUUM ANALYZE card_market_daily');
    client.release();

    console.log('\n========================================');
    console.log('Complete!');
    console.log(`Total cards: ${total.toLocaleString()}`);
    console.log('========================================');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
