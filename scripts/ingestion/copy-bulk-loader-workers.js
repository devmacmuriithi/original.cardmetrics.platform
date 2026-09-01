/**
 * copy-bulk-loader-workers.js - Worker-based parallel COPY bulk loader
 * 
 * Workers partition files, download, merge, and bulk load in parallel
 * Each worker processes a unique subset of files per date
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Readable } = require('stream');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const TEMP_DIR = process.env.TEMP_DIR || './temp';

// Worker configuration
const args = process.argv.slice(2);
const startDate = args[0];
const endDate = args[1] || startDate;
const workerId = parseInt(args[2]) || 0;
const totalWorkers = parseInt(args[3]) || 1;

const WORKER_TEMP_DIR = path.join(TEMP_DIR, `worker_${workerId}`);
if (!fs.existsSync(WORKER_TEMP_DIR)) {
  fs.mkdirSync(WORKER_TEMP_DIR, { recursive: true });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5  // Conservative for multi-worker
});

if (!startDate) {
  console.error('Usage: node copy-bulk-loader-workers.js <YYYY-MM-DD> [YYYY-MM-DD] [workerId] [totalWorkers]');
  console.error('Example (3 workers):');
  console.error('  node copy-bulk-loader-workers.js 2026-01-24 2026-01-24 0 3');
  console.error('  node copy-bulk-loader-workers.js 2026-01-24 2026-01-24 1 3');
  console.error('  node copy-bulk-loader-workers.js 2026-01-24 2026-01-24 2 3');
  process.exit(1);
}

function parsePrice(priceStr) {
  if (!priceStr || priceStr === '') return null;
  const val = parseFloat(priceStr.replace(/[$,]/g, ''));
  return isNaN(val) ? null : val;
}

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

async function listAndPartitionFiles(date) {
  const prefix = `dt=${date}/`;
  const allFiles = [];
  let continuationToken = null;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));
    
    if (response.Contents) {
      allFiles.push(...response.Contents.filter(o => o.Key.endsWith('.csv')));
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken);

  // Partition by worker
  const myFiles = allFiles.filter((_, idx) => idx % totalWorkers === workerId);
  console.log(`  Worker ${workerId}: ${myFiles.length}/${allFiles.length} files`);
  return myFiles;
}

async function downloadAndMergeFiles(date, files, outputPath) {
  console.log(`\n📥 Worker ${workerId}: Downloading ${files.length} files...`);

  const outputStream = fs.createWriteStream(outputPath);
  outputStream.write('card_id,console_uid,ingest_date,payload\n');

  let totalRows = 0;
  let processed = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(batch.map(async (file) => {
      try {
        const response = await s3Client.send(
          new GetObjectCommand({ Bucket: BUCKET_NAME, Key: file.Key })
        );

        const rows = [];
        const parser = Readable.from(response.Body).pipe(csv());

        for await (const row of parser) {
          const cardId = parseInt(row.id);
          if (!cardId || isNaN(cardId)) continue;

          const payload = JSON.stringify({
            'loose-price': parsePrice(row['loose-price']),
            'graded-price': parsePrice(row['graded-price']),
            'manual-only-price': parsePrice(row['manual-only-price']),
            'bgs-10-price': parsePrice(row['bgs-10-price']),
            'retail-loose-buy': parsePrice(row['retail-loose-buy']),
            'retail-loose-sell': parsePrice(row['retail-loose-sell']),
            'sales-volume': parseInt(row['sales-volume']) || 0
          }).replace(/"/g, '""');

          rows.push(`${cardId},${row['console-name'] || ''},${date},"${payload}"`);
        }

        return rows;
      } catch (err) {
        console.warn(`  Worker ${workerId}: Failed ${file.Key}`);
        return [];
      }
    }));

    for (const lines of results) {
      for (const line of lines) {
        outputStream.write(line + '\n');
        totalRows++;
      }
    }

    processed += batch.length;
    if (processed % 500 === 0 || processed === files.length) {
      const pct = ((processed / files.length) * 100).toFixed(1);
      console.log(`  Worker ${workerId}: [${pct}%] ${processed}/${files.length} | ${totalRows.toLocaleString()} rows`);
    }
  }

  outputStream.end();
  await new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
  });

  return totalRows;
}

async function flushBatch(client, batch) {
  const values = batch.map((_, i) => 
    `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4}::jsonb)`
  ).join(',');

  const params = batch.flatMap(r => [r.ingest_date, r.console_uid, r.card_id, r.payload]);

  await client.query(
    `INSERT INTO cards_raw_ingests (ingest_date, console_uid, card_id, payload) 
     VALUES ${values}`,
    params
  );
}

async function bulkLoadFromCSV(date, csvPath) {
  const csv = require('csv-parser');
  const stream = fs.createReadStream(csvPath).pipe(csv());
  let batch = [];
  let total = 0;
  const BATCH_SIZE = 5000;

  return withTransaction(async (client) => {
    for await (const row of stream) {
      batch.push({
        ingest_date: row.ingest_date,
        console_uid: row.console_uid,
        card_id: parseInt(row.card_id),
        payload: row.payload
      });

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

    console.log(`  Worker ${workerId}: ✅ Loaded ${total.toLocaleString()} raw rows`);
    return total;
  });
}

async function extractToMarketDaily(date) {
  console.log(`  Worker ${workerId}: Extracting to market_daily...`);

  return withTransaction(async (client) => {
    const result = await client.query(`
      INSERT INTO card_market_daily (
        card_id, console_uid, date,
        loose_price, graded_price, psa10_price, bgs10_price,
        retail_loose_buy, retail_loose_sell, sales_volume
      )
      SELECT 
        card_id, console_uid, ingest_date,
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

    console.log(`  Worker ${workerId}: ✅ Extracted ${result.rowCount} rows`);
    return result.rowCount;
  });
}

async function cleanup(date) {
  await pool.query('DELETE FROM cards_raw_ingests WHERE ingest_date = $1', [date]);
}

async function processDate(date) {
  const tempFile = path.join(WORKER_TEMP_DIR, `${date}_worker${workerId}.csv`);

  console.log(`\n========================================`);
  console.log(`Worker ${workerId}: ${date}`);
  console.log(`========================================`);

  // Find and partition files
  const files = await listAndPartitionFiles(date);
  if (files.length === 0) return 0;

  // Download and merge
  await downloadAndMergeFiles(date, files, tempFile);

  // Bulk load
  await bulkLoadFromCSV(date, tempFile);

  // Extract
  const extracted = await extractToMarketDaily(date);

  // Cleanup
  await cleanup(date);
  fs.unlinkSync(tempFile);

  return extracted;
}

(async () => {
  const mainStart = Date.now();
  const dates = getDateRange(startDate, endDate);
  let total = 0;

  console.log(`\n========================================`);
  console.log(`COPY Workers - ${workerId}/${totalWorkers}`);
  console.log(`========================================`);
  console.log(`Dates: ${dates.join(', ')}`);

  try {
    for (const date of dates) {
      const count = await processDate(date);
      total += count;
    }

    const duration = ((Date.now() - mainStart) / 1000 / 60).toFixed(2);
    console.log(`\n========================================`);
    console.log(`✅ Worker ${workerId} Complete!`);
    console.log(`Total: ${total.toLocaleString()} cards`);
    console.log(`Time: ${duration} min`);
    console.log(`========================================`);

  } catch (err) {
    console.error(`\n❌ Worker ${workerId} failed:`, err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
