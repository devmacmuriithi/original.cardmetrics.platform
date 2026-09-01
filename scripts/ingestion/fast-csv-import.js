/**
 * fast-csv-import.js - Fast bulk CSV import to staging table
 * 
 * Uses batch INSERT for reliable performance
 * Loads CSVs into cards_raw_ingests (staging table)
 * 
 * Usage:
 *   node fast-csv-import.js --date=2026-01-24                    # Import from S3 (default)
 *   node fast-csv-import.js --date=2026-01-24 --local           # Import from local downloads
 *   node fast-csv-import.js --date=2026-01-24 --set=G47839      # Import specific set only
 *   node fast-csv-import.js --date=2026-01-24 --sport=basketball # Import basketball only
 *   node fast-csv-import.js --from-date=2026-01-17 --max-dates=5 # Import range from S3
 *   node fast-csv-import.js --file=local.csv                     # Import single local file
 *   node fast-csv-import.js --s3-path=dt=2026-01-24/           # Import S3 folder
 * 
 * Then run sync script:
 *   node sync-raw-ingests.js
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 5
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const LOCAL_DOWNLOADS_DIR = 'downloader/s3-download/downloads';

// Parse arguments
const args = process.argv.slice(2);
const dateArg = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
const fromDateArg = args.find(arg => arg.startsWith('--from-date='))?.split('=')[1];
const maxDates = parseInt(args.find(arg => arg.startsWith('--max-dates='))?.split('=')[1] || '30');
const fileArg = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
const s3PathArg = args.find(arg => arg.startsWith('--s3-path='))?.split('=')[1];
const USE_LOCAL = args.includes('--local');
const SET_FILTER = args.find(arg => arg.startsWith('--set='))?.split('=')[1];
const SPORT_FILTER = args.find(arg => arg.startsWith('--sport='))?.split('=')[1];

// Fast CSV parser for COPY format
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Transform CSV row to raw ingests format
function transformRow(headers, values, consoleUid, snapshotDate, sourceFile, sourcePath) {
  const row = {};
  headers.forEach((h, i) => row[h] = values[i]);
  
  return {
    card_id: parseInt(row.id) || null,
    product_name: row['product-name'] || null,
    console_name: row['console-name'] || null,
    console_uid: consoleUid,
    loose_price: parseFloat(row['loose-price']) || null,
    graded_price: parseFloat(row['graded-price']) || null,
    psa10_price: parseFloat(row['manual-only-price']) || null,
    bgs10_price: parseFloat(row['bgs-10-price']) || null,
    cib_price: parseFloat(row['cib-price']) || null,
    new_price: parseFloat(row['new-price']) || null,
    box_only_price: parseFloat(row['box-only-price']) || null,
    manual_only_price: parseFloat(row['manual-only-price']) || null,
    condition_17_price: parseFloat(row['condition-17-price']) || null,
    condition_18_price: parseFloat(row['condition-18-price']) || null,
    gamestop_price: parseFloat(row['gamestop-price']) || null,
    gamestop_trade_price: parseFloat(row['gamestop-trade-price']) || null,
    retail_loose_buy: parseFloat(row['retail-loose-buy']) || null,
    retail_loose_sell: parseFloat(row['retail-loose-sell']) || null,
    retail_cib_buy: parseFloat(row['retail-cib-buy']) || null,
    retail_cib_sell: parseFloat(row['retail-cib-sell']) || null,
    retail_new_buy: parseFloat(row['retail-new-buy']) || null,
    retail_new_sell: parseFloat(row['retail-new-sell']) || null,
    sales_volume: parseFloat(row['sales-volume']) || null,
    upc: row.upc || null,
    tcg_id: row['tcg-id'] || null,
    asin: row.asin || null,
    epid: row.epid || null,
    genre: row.genre || null,
    release_date: row['release-date'] || null,
    snapshot_date: snapshotDate,
    source_file: sourceFile,
    source_path: sourcePath,
    raw_csv_line: values.join(',')
  };
}

// Import single file to staging using batch INSERT (reliable and fast)
async function importFileToStaging(client, fileContent, consoleUid, snapshotDate, sourceFile, sourcePath) {
  const lines = fileContent.split('\n').filter(l => l.trim());
  if (lines.length < 2) return 0;
  
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length) {
      const row = transformRow(headers, values, consoleUid, snapshotDate, sourceFile, sourcePath);
      if (row.card_id) {
        rows.push(row);
      }
    }
  }
  
  if (rows.length === 0) return 0;
  
  // Batch insert using UNNEST (much more reliable than COPY)
  const BATCH_SIZE = 1000;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    
    const cardIds = batch.map(r => r.card_id);
    const productNames = batch.map(r => r.product_name);
    const consoleNames = batch.map(r => r.console_name);
    const consoleUids = batch.map(r => r.console_uid);
    const loosePrices = batch.map(r => r.loose_price);
    const gradedPrices = batch.map(r => r.graded_price);
    const psa10Prices = batch.map(r => r.psa10_price);
    const bgs10Prices = batch.map(r => r.bgs10_price);
    const retailBuys = batch.map(r => r.retail_loose_buy);
    const retailSells = batch.map(r => r.retail_loose_sell);
    const salesVolumes = batch.map(r => r.sales_volume);
    const cibPrices = batch.map(r => r.cib_price);
    const newPrices = batch.map(r => r.new_price);
    const boxOnlyPrices = batch.map(r => r.box_only_price);
    const manualOnlyPrices = batch.map(r => r.manual_only_price);
    const condition17Prices = batch.map(r => r.condition_17_price);
    const condition18Prices = batch.map(r => r.condition_18_price);
    const gamestopPrices = batch.map(r => r.gamestop_price);
    const gamestopTradePrices = batch.map(r => r.gamestop_trade_price);
    const retailCibBuys = batch.map(r => r.retail_cib_buy);
    const retailCibSells = batch.map(r => r.retail_cib_sell);
    const retailNewBuys = batch.map(r => r.retail_new_buy);
    const retailNewSells = batch.map(r => r.retail_new_sell);
    const upcs = batch.map(r => r.upc);
    const tcgIds = batch.map(r => r.tcg_id);
    const asins = batch.map(r => r.asin);
    const epids = batch.map(r => r.epid);
    const genres = batch.map(r => r.genre);
    const releaseDates = batch.map(r => r.release_date);
    const snapshotDates = batch.map(r => r.snapshot_date);
    const sourceFiles = batch.map(r => r.source_file);
    const sourcePaths = batch.map(r => r.source_path);
    const rawLines = batch.map(r => r.raw_csv_line);
    const processed = batch.map(() => false);
    
    await client.query(
      `INSERT INTO cards_raw_ingests 
       (card_id, product_name, console_name, console_uid, loose_price, graded_price, 
        psa10_price, bgs10_price, cib_price, new_price, box_only_price, manual_only_price,
        condition_17_price, condition_18_price, gamestop_price, gamestop_trade_price,
        retail_loose_buy, retail_loose_sell, retail_cib_buy, retail_cib_sell, retail_new_buy, retail_new_sell,
        sales_volume, upc, tcg_id, asin, epid, genre, release_date,
        snapshot_date, source_file, source_path, processed, raw_csv_line)
       SELECT * FROM UNNEST(
         $1::bigint[], $2::text[], $3::text[], $4::text[], $5::numeric[], $6::numeric[],
         $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[], $12::numeric[],
         $13::numeric[], $14::numeric[], $15::numeric[], $16::numeric[], $17::numeric[], $18::numeric[],
         $19::numeric[], $20::numeric[], $21::numeric[], $22::numeric[], $23::numeric[], $24::text[],
         $25::text[], $26::text[], $27::text[], $28::text[], $29::date[], $30::date[],
         $31::text[], $32::text[], $33::boolean[], $34::text[]
       )
       ON CONFLICT DO NOTHING`,
      [cardIds, productNames, consoleNames, consoleUids, loosePrices, gradedPrices,
       psa10Prices, bgs10Prices, cibPrices, newPrices, boxOnlyPrices, manualOnlyPrices,
       condition17Prices, condition18Prices, gamestopPrices, gamestopTradePrices,
       retailBuys, retailSells, retailCibBuys, retailCibSells, retailNewBuys, retailNewSells,
       salesVolumes, upcs, tcgIds, asins, epids, genres, releaseDates,
       snapshotDates, sourceFiles, sourcePaths, processed, rawLines]
    );
  }
  
  return rows.length;
}

// Import local file
async function importLocalFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  
  // Extract date from filename or path
  const dateMatch = filePath.match(/dt=(\d{4}-\d{2}-\d{2})/);
  const snapshotDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  
  // Extract console_uid from filename
  const uidMatch = filename.match(/_G(\d+)\.csv$/);
  const consoleUid = uidMatch ? `G${uidMatch[1]}` : 'unknown';
  
  const client = await pool.connect();
  try {
    const count = await importFileToStaging(client, content, consoleUid, snapshotDate, filename, filePath);
    console.log(`✅ Imported ${count} rows from ${filename}`);
    return count;
  } finally {
    client.release();
  }
}

// Download and import from S3
async function importFromS3(key) {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  }));
  
  const content = await response.Body.transformToString();
  
  // Extract date from S3 path
  const dateMatch = key.match(/dt=(\d{4}-\d{2}-\d{2})/);
  const snapshotDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  
  // Extract console_uid from filename
  const filename = key.split('/').pop();
  const uidMatch = filename.match(/_G(\d+)\.csv$/);
  const consoleUid = uidMatch ? `G${uidMatch[1]}` : 'unknown';
  
  const client = await pool.connect();
  try {
    const count = await importFileToStaging(client, content, consoleUid, snapshotDate, filename, `s3://${BUCKET_NAME}/${key}`);
    console.log(`✅ Imported ${count} rows from s3://${key}`);
    return count;
  } finally {
    client.release();
  }
}

// Discover and import dates from S3
async function importFromS3ByDate(targetDate) {
  const prefix = `dt=${targetDate}/`;
  let files = [];
  
  let continuationToken = null;
  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));
    
    if (response.Contents) {
      files.push(...response.Contents.filter(f => f.Key.endsWith('.csv')));
    }
    
    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken);
  
  // Filter by set if specified
  if (SET_FILTER) {
    const pattern = new RegExp(`_${SET_FILTER}\\.csv$`);
    files = files.filter(f => pattern.test(f.Key));
    console.log(`🔍 Filtered to ${files.length} files matching set ${SET_FILTER}`);
  }
  
  // Filter by sport if specified
  if (SPORT_FILTER) {
    const sportPattern = new RegExp(`^${SPORT_FILTER}-cards-`, 'i');
    files = files.filter(f => sportPattern.test(path.basename(f.Key)));
    console.log(`🏀 Filtered to ${files.length} files matching sport ${SPORT_FILTER}`);
  }
  
  console.log(`Found ${files.length} CSV files for ${targetDate}`);
  
  let total = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`  [${i+1}/${files.length}] ${file.Key}...`);
    const count = await importFromS3(file.Key);
    total += count;
  }
  
  return total;
}

// Import from local directory by date
async function importFromLocalByDate(targetDate) {
  const dateDir = path.join(LOCAL_DOWNLOADS_DIR, `dt=${targetDate}`);
  
  if (!fs.existsSync(dateDir)) {
    console.log(`❌ Local directory not found: ${dateDir}`);
    return 0;
  }
  
  let files = fs.readdirSync(dateDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(dateDir, f));
  
  // Filter by set if specified
  if (SET_FILTER) {
    const pattern = new RegExp(`_${SET_FILTER}\.csv$`);
    files = files.filter(f => pattern.test(f));
    console.log(`🔍 Filtered to ${files.length} files matching set ${SET_FILTER}`);
  }
  
  // Filter by sport if specified
  if (SPORT_FILTER) {
    const sportPattern = new RegExp(`^${SPORT_FILTER}-cards-`, 'i');
    files = files.filter(f => sportPattern.test(path.basename(f)));
    console.log(`🏀 Filtered to ${files.length} files matching sport ${SPORT_FILTER}`);
  }
  
  console.log(`Found ${files.length} CSV files locally for ${targetDate}`);
  
  let total = 0;
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const filename = path.basename(filePath);
    console.log(`  [${i+1}/${files.length}] ${filename}...`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const uidMatch = filename.match(/_G(\d+)\.csv$/);
    const consoleUid = uidMatch ? `G${uidMatch[1]}` : 'unknown';
    
    const client = await pool.connect();
    try {
      const count = await importFileToStaging(client, content, consoleUid, targetDate, filename, filePath);
      console.log(`    ✅ Imported ${count} rows`);
      total += count;
    } finally {
      client.release();
    }
  }
  
  return total;
}

// Import date range from local
async function importLocalDateRange(fromDateStr, maxDates) {
  // Discover available dates from local directory
  const availableDates = [];
  
  if (fs.existsSync(LOCAL_DOWNLOADS_DIR)) {
    const entries = fs.readdirSync(LOCAL_DOWNLOADS_DIR);
    for (const entry of entries) {
      const match = entry.match(/dt=(\d{4}-\d{2}-\d{2})/);
      if (match && fs.statSync(path.join(LOCAL_DOWNLOADS_DIR, entry)).isDirectory()) {
        availableDates.push(match[1]);
      }
    }
  }
  
  const sortedDates = availableDates.sort();
  const fromIndex = sortedDates.indexOf(fromDateStr);
  const datesToImport = fromIndex >= 0 ? sortedDates.slice(fromIndex, fromIndex + maxDates) : [];
  
  console.log(`\n📁 Importing ${datesToImport.length} dates from ${fromDateStr} (local)`);
  
  let total = 0;
  for (const date of datesToImport) {
    console.log(`\n📅 Processing ${date}...`);
    const count = await importFromLocalByDate(date);
    total += count;
  }
  
  return total;
}

// Main function
async function main() {
  console.log('========================================');
  console.log('Fast CSV Import to Staging');
  console.log('========================================');
  
  let totalImported = 0;
  
  if (fileArg) {
    // Import local file
    console.log(`\n📁 Importing local file: ${fileArg}`);
    totalImported = await importLocalFile(fileArg);
    
  } else if (s3PathArg) {
    // Import S3 folder
    console.log(`\n☁️  Importing from S3 path: ${s3PathArg}`);
    const files = [];
    let continuationToken = null;
    
    do {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: s3PathArg,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      }));
      
      if (response.Contents) {
        files.push(...response.Contents.filter(f => f.Key.endsWith('.csv')));
      }
      
      continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
    } while (continuationToken);
    
    console.log(`Found ${files.length} CSV files`);
    
    for (let i = 0; i < files.length; i++) {
      console.log(`  [${i+1}/${files.length}] ${files[i].Key}...`);
      const count = await importFromS3(files[i].Key);
      totalImported += count;
    }
    
  } else if (dateArg && USE_LOCAL) {
    // Import specific date from local
    console.log(`\n📁 Importing from LOCAL date: ${dateArg}`);
    totalImported = await importFromLocalByDate(dateArg);
    
  } else if (fromDateArg && USE_LOCAL) {
    // Import date range from local
    totalImported = await importLocalDateRange(fromDateArg, maxDates);
    
  } else if (dateArg) {
    // Import specific date from S3 (default)
    console.log(`\n☁️  Importing from S3 date: ${dateArg}`);
    console.log('   (Use --local flag to import from local downloads instead)');
    totalImported = await importFromS3ByDate(dateArg);
    
  } else if (fromDateArg) {
    // Import date range from S3 (default)
    const dates = [];
    
    // Discover available dates from S3
    let continuationToken = null;
    const availableDates = new Set();
    
    do {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Delimiter: '/',
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      }));
      
      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          const match = prefix.Prefix.match(/dt=(\d{4}-\d{2}-\d{2})/);
          if (match) availableDates.add(match[1]);
        }
      }
      
      continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
    } while (continuationToken);
    
    // Filter from date
    const sortedDates = Array.from(availableDates).sort();
    const fromIndex = sortedDates.indexOf(fromDateArg);
    const datesToImport = fromIndex >= 0 ? sortedDates.slice(fromIndex, fromIndex + maxDates) : [];
    
    console.log(`\n☁️  Importing ${datesToImport.length} dates from ${fromDateArg} (S3)`);
    console.log('   (Use --local flag to import from local downloads instead)');
    
    for (const date of datesToImport) {
      console.log(`\n📅 Processing ${date}...`);
      const count = await importFromS3ByDate(date);
      totalImported += count;
    }
    
  } else {
    console.log('\n❌ No import target specified. Usage:');
    console.log('  node fast-csv-import.js --date=2026-01-24              # From S3 (default)');
    console.log('  node fast-csv-import.js --date=2026-01-24 --local     # From local downloads');
    console.log('  node fast-csv-import.js --date=2026-01-24 --set=G47839  # Specific set only');
    console.log('  node fast-csv-import.js --date=2026-01-24 --sport=basketball  # Basketball only');
    console.log('  node fast-csv-import.js --from-date=2026-01-17 --max-dates=5');
    console.log('  node fast-csv-import.js --file=local.csv');
    console.log('  node fast-csv-import.js --s3-path=dt=2026-01-24/');
    process.exit(1);
  }
  
  console.log('\n========================================');
  console.log(`✅ Total imported: ${totalImported} rows`);
  console.log('========================================');
  console.log('\nNext step: Sync to normalized tables');
  console.log('  node sync-raw-ingests.js');
  
  await pool.end();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
