/**
 * merge-csvs.js - Step 1: Merge all CSVs per day into ONE snapshot file
 * 
 * Downloads all CSVs from S3 for a date, merges into single standardized CSV
 * Output: YYYY-MM-DD_snapshot.csv with columns: card_id, console_uid, ingest_date, payload
 * 
 * Usage:
 *   node merge-csvs.js 2026-01-21 2026-01-22                    # All files
 *   node merge-csvs.js 2026-01-21 2026-01-22 basketball_sets.csv # From CSV
 *   node merge-csvs.js 2026-01-21 2026-01-22 --slug=topps-woven  # By slug pattern
 *   node merge-csvs.js 2026-01-21 2026-01-22 --uid=G87796       # By console_uid
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2
});

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Resolve filter source: CSV file, slug pattern, or console_uid
async function resolveFilterSource(filterArg) {
  if (!filterArg) return null;

  // Option 1: --slug=pattern
  if (filterArg.startsWith('--slug=')) {
    const slugPattern = filterArg.replace('--slug=', '');
    console.log(`Looking up slug pattern: ${slugPattern}`);
    const result = await pool.query(
      'SELECT console_uid, csv_path FROM sets_master WHERE slug ILIKE $1',
      [`%${slugPattern}%`]
    );
    console.log(`  Found ${result.rowCount} matching sets`);
    return result.rows.map(r => r.console_uid);
  }

  // Option 2: --uid=console_uid
  if (filterArg.startsWith('--uid=')) {
    const uid = filterArg.replace('--uid=', '');
    console.log(`Looking up console_uid: ${uid}`);
    const result = await pool.query(
      'SELECT console_uid FROM sets_master WHERE console_uid = $1',
      [uid]
    );
    if (result.rowCount === 0) {
      console.warn(`  Console_uid ${uid} not found in database`);
      return null;
    }
    console.log(`  Found 1 matching set`);
    return [uid];
  }

  // Option 3: CSV file
  if (fs.existsSync(filterArg)) {
    console.log(`Loading console_uids from ${filterArg}...`);
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filterArg)
        .pipe(csv())
        .on('data', (row) => {
          if (row.console_uid) rows.push(row.console_uid);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    console.log(`  Loaded ${rows.length} console_uids`);
    return rows;
  }

  // Unknown filter
  console.warn(`Unknown filter: ${filterArg}`);
  return null;
}

function parsePrice(priceStr) {
  if (!priceStr || priceStr === '') return null;
  const val = parseFloat(priceStr.replace(/[$,]/g, ''));
  return isNaN(val) ? null : val;
}

async function listFilesForDate(date, allowedConsoleUids = null) {
  const prefix = `dt=${date}/`;
  const files = [];
  let continuationToken = null;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));
    
    if (response.Contents) {
      let matching = response.Contents.filter(o => o.Key.endsWith('.csv'));
      
      // If allowed console_uids provided, filter by them
      if (allowedConsoleUids && allowedConsoleUids.length > 0) {
        matching = matching.filter(o => {
          // Extract console_uid from filename: {slug}_{console_uid}.csv
          const filename = o.Key.split('/').pop(); // Get just the filename
          return allowedConsoleUids.some(uid => filename.includes(uid));
        });
      }
      
      files.push(...matching);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken);

  return files;
}

async function downloadAndParseFile(key) {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );

  const rows = [];
  const parser = Readable.from(response.Body).pipe(csv());

  for await (const row of parser) {
    const cardId = parseInt(row.id);
    if (!cardId || isNaN(cardId)) continue;

    const consoleUid = row['console-name'] || '';
    
    const payload = {
      'loose-price': parsePrice(row['loose-price']),
      'graded-price': parsePrice(row['graded-price']),
      'manual-only-price': parsePrice(row['manual-only-price']),
      'bgs-10-price': parsePrice(row['bgs-10-price']),
      'retail-loose-buy': parsePrice(row['retail-loose-buy']),
      'retail-loose-sell': parsePrice(row['retail-loose-sell']),
      'sales-volume': parseInt(row['sales-volume']) || 0
    };

    rows.push({
      card_id: cardId,
      console_uid: consoleUid,
      payload: JSON.stringify(payload)
    });
  }

  return rows;
}

async function mergeCSVFiles(date, outputPath, allowedConsoleUids = null) {
  console.log(`\n📅 Merging CSVs for ${date}...`);
  
  const files = await listFilesForDate(date, allowedConsoleUids);
  console.log(`  Found ${files.length} CSV files`);

  if (allowedConsoleUids) {
    console.log(`  (Filtered to ${allowedConsoleUids.length} console_uids from sets file)`);
  }

  if (files.length === 0) {
    console.log('  No files found, skipping');
    return 0;
  }

  const outputStream = fs.createWriteStream(outputPath);
  outputStream.write('card_id,console_uid,ingest_date,payload\n');

  let totalRows = 0;
  let processedFiles = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (file) => {
      try {
        const rows = await downloadAndParseFile(file.Key);
        return rows.map(r => `${r.card_id},${r.console_uid},${date},"${r.payload.replace(/"/g, '""')}"`);
      } catch (err) {
        console.warn(`  Warning: Failed ${file.Key}: ${err.message}`);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    for (const lines of batchResults) {
      for (const line of lines) {
        outputStream.write(line + '\n');
        totalRows++;
      }
    }

    processedFiles += batch.length;
    const pct = ((processedFiles / files.length) * 100).toFixed(1);
    if (processedFiles % 500 === 0 || processedFiles === files.length) {
      console.log(`  [${pct}%] ${processedFiles}/${files.length} files | ${totalRows.toLocaleString()} rows`);
    }
  }

  outputStream.end();
  await new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
  });

  console.log(`  ✅ Merged ${totalRows.toLocaleString()} rows → ${outputPath}`);
  return totalRows;
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

(async () => {
  const args = process.argv.slice(2);
  const startDate = args[0];
  const endDate = args[1] || startDate;
  const filterArg = args[2];  // CSV file, --slug=pattern, or --uid=xxx
  const outputDir = args[3] || TEMP_DIR;

  if (!startDate) {
    console.error('Usage: node merge-csvs.js <YYYY-MM-DD> [YYYY-MM-DD] [filter] [output-dir]');
    console.error('');
    console.error('Filters:');
    console.error('  basketball_sets.csv          Load from CSV file');
    console.error('  --slug=topps-woven           Match slug pattern');
    console.error('  --uid=G87796                 Specific console_uid');
    console.error('');
    console.error('Examples:');
    console.error('  node merge-csvs.js 2026-01-21 2026-01-22');
    console.error('  node merge-csvs.js 2026-01-21 2026-01-22 basketball_sets.csv');
    console.error('  node merge-csvs.js 2026-01-21 2026-01-22 --slug=prizm');
    console.error('  node merge-csvs.js 2026-01-21 2026-01-22 --uid=G78842');
    process.exit(1);
  }

  // Resolve filter source (DB query or CSV file)
  const allowedConsoleUids = await resolveFilterSource(filterArg);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('CSV Merge Tool');
  console.log('==============');
  console.log(`Date range: ${startDate} to ${endDate}`);
  if (filterArg) console.log(`Filter: ${filterArg}`);
  if (allowedConsoleUids) console.log(`Matching ${allowedConsoleUids.length} console_uids`);
  console.log(`Output: ${outputDir}`);

  const dates = getDateRange(startDate, endDate);
  const results = [];

  try {
    for (const date of dates) {
      const outputPath = path.join(outputDir, `${date}_snapshot.csv`);
      const rowCount = await mergeCSVFiles(date, outputPath, allowedConsoleUids);
      results.push({ date, rowCount, path: outputPath });
    }

    console.log('\n========================================');
    console.log('Merge complete!');
    console.log('========================================');
    results.forEach(r => {
      console.log(`${r.date}: ${r.rowCount.toLocaleString()} rows → ${r.path}`);
    });
    console.log(`\nNext: node copy-bulk-loader.js ${startDate} ${endDate}`);

  } finally {
    await pool.end();
  }
})();
