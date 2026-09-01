/**
 * direct-import-from-s3-worker.js - Parallel Worker for S3 Import
 * 
 * Uses sets_ingestion_stats table for coordination:
 * - Claims pending sets atomically (prevents race conditions)
 * - Tracks progress per set/date
 * - Supports resume from failures
 * 
 * Run multiple workers in parallel:
 *   node direct-import-from-s3-worker.js --date=2026-01-24 --sport=basketball &
 *   node direct-import-from-s3-worker.js --date=2026-01-24 --sport=basketball &
 *   node direct-import-from-s3-worker.js --date=2026-01-24 --sport=basketball &
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const { Readable } = require('stream');
const csv = require('csv-parser');
const { parseCardName } = require('../utils/card-parser');
const os = require('os');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 20
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Parse command line arguments
const args = process.argv.slice(2);
const dateArg = args.find(arg => arg.startsWith('--date='));
const datesArg = args.find(arg => arg.startsWith('--dates='));
const sportArg = args.find(arg => arg.startsWith('--sport='));
const workerIdArg = args.find(arg => arg.startsWith('--worker-id='));
const maxSetsArg = args.find(arg => arg.startsWith('--max-sets='));
const DRY_RUN = args.includes('--dry-run');

// Parse dates - support single or multiple
const DATES = datesArg 
  ? datesArg.split('=')[1].split(',').map(d => d.trim())
  : [dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0]];

const TARGET_SPORT = sportArg ? sportArg.split('=')[1] : null;
const MAX_SETS = maxSetsArg ? parseInt(maxSetsArg.split('=')[1]) : Infinity;

// Generate unique worker ID
const WORKER_ID = workerIdArg ? workerIdArg.split('=')[1] : `${os.hostname()}:${process.pid}`;

// Stats for this worker (by date)
const workerStats = {
  byDate: {},
  totalSetsProcessed: 0,
  totalSetsSucceeded: 0,
  totalSetsFailed: 0,
  totalSetsSkipped: 0,
  totalRecords: 0,
  startTime: Date.now()
};

// Helper to get or create date stats
function getDateStats(date) {
  if (!workerStats.byDate[date]) {
    workerStats.byDate[date] = {
      setsProcessed: 0,
      setsSucceeded: 0,
      setsFailed: 0,
      setsSkipped: 0,
      records: 0
    };
  }
  return workerStats.byDate[date];
}

// Cache for manufacturer and player lookups
const manufacturerCache = new Map();
const playerCache = new Map();

async function claimNextSet(client) {
  // Try to claim from any of the target dates
  for (const date of DATES) {
    const result = await client.query(
      `SELECT * FROM claim_next_pending_set($1, $2)`,
      [WORKER_ID, date]
    );
    if (result.rows[0]) {
      return { ...result.rows[0], _date: date };
    }
  }
  return null;
}

async function findS3File(consoleUid, date, csvPath) {
  const prefix = `dt=${date}/`;
  // csvPath from database already includes "basketball-cards-" prefix
  const expectedKey = `${prefix}${csvPath}`;
  
  // Try to head the object to see if it exists
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: expectedKey })
    );
    return { Key: expectedKey, Size: response.ContentLength };
  } catch (err) {
    // File doesn't exist with expected pattern, try listing
    return null;
  }
}

function parsePrice(priceStr) {
  if (!priceStr || priceStr === '') return null;
  const val = parseFloat(priceStr.replace(/[$,]/g, ''));
  return isNaN(val) ? null : val;
}

async function downloadAndProcess(key, date, consoleUid, setInfo) {
  console.log(`  [${WORKER_ID}] Downloading ${key}...`);
  
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );

  const rows = [];
  const parser = Readable.from(response.Body).pipe(csv());

  for await (const row of parser) {
    const cardId = parseInt(row.id);
    if (!cardId || isNaN(cardId)) continue;

    let parsedData = { playerName: null, cardNumber: null, setName: null, variant: null };
    try {
      parsedData = parseCardName(row['product-name'] || '');
    } catch (parseErr) {
      // Continue without parsed data
    }

    rows.push({
      card_id: cardId,
      console_uid: consoleUid,
      date: date,
      product_name: row['product-name'] || '',
      console_name: row['console-name'] || '',
      ...parsedData,
      loose_price: parsePrice(row['loose-price']),
      graded_price: parsePrice(row['graded-price']),
      psa10_price: parsePrice(row['manual-only-price']),
      bgs10_price: parsePrice(row['bgs-10-price']),
      sales_volume: parseInt(row['sales-volume']) || 0,
      upc: row['upc'] || null,
      release_date: row['release-date'] || null
    });
  }

  return rows;
}

async function resolveManufacturerId(client, manufacturerName) {
  if (!manufacturerName) return 1;
  const key = manufacturerName.toLowerCase();
  if (manufacturerCache.has(key)) return manufacturerCache.get(key);

  const result = await client.query(
    `SELECT id FROM manufacturers WHERE LOWER(name) = $1 OR LOWER(slug) = $1 LIMIT 1`,
    [key]
  );
  const id = result.rows[0]?.id || 1;
  manufacturerCache.set(key, id);
  return id;
}

async function ensurePlayer(client, playerName) {
  if (!playerName) return null;
  const slug = playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (playerCache.has(slug)) return playerCache.get(slug);

  const nameParts = playerName.trim().split(/\s+/);
  const firstName = nameParts[0] || null;
  const lastName = nameParts.slice(1).join(' ') || null;

  const result = await client.query(`
    INSERT INTO players (full_name, slug, first_name, last_name)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (slug) DO UPDATE SET last_updated = CURRENT_TIMESTAMP
    RETURNING id
  `, [playerName, slug, firstName, lastName]);

  const id = result.rows[0]?.id || null;
  playerCache.set(slug, id);
  return id;
}

async function ensureSetAndCards(client, consoleUid, setInfo, rows) {
  // Ensure set exists
  await client.query(`
    INSERT INTO sets (console_uid, name, slug, sport_id)
    VALUES ($1, $2, $3, (SELECT id FROM sports WHERE LOWER(name) = LOWER($4)))
    ON CONFLICT (console_uid) DO UPDATE SET
      name = EXCLUDED.name,
      last_updated = CURRENT_TIMESTAMP
  `, [consoleUid, setInfo?.set_name || consoleUid, setInfo?.slug || consoleUid, TARGET_SPORT || 'basketball']);

  const setResult = await client.query(`SELECT id FROM sets WHERE console_uid = $1`, [consoleUid]);
  const setId = setResult.rows[0]?.id;
  if (!setId) throw new Error(`Could not get set_id for ${consoleUid}`);

  // Deduplicate cards
  const uniqueCards = [...new Map(rows.map(r => [r.card_id, r])).values()];

  // Resolve players
  for (const card of uniqueCards) {
    card._playerId = await ensurePlayer(client, card.playerName);
    card._manufacturerId = await resolveManufacturerId(client, card.manufacturer);
  }

  // Batch insert cards
  const BATCH_SIZE = 1000;
  for (let i = 0; i < uniqueCards.length; i += BATCH_SIZE) {
    const batch = uniqueCards.slice(i, i + BATCH_SIZE);
    const consoleUids = batch.map(r => r.console_uid);
    const cardIds = batch.map(r => r.card_id);
    const productNames = batch.map(r => r.product_name);
    const consoleNames = batch.map(r => r.console_name);
    const dates = batch.map(r => r.date);
    const playerNames = batch.map(r => r.playerName || null);
    const cardNumbers = batch.map(r => r.cardNumber || null);
    const setNames = batch.map(r => r.setName || null);
    const variants = batch.map(r => r.variant || null);
    const playerIds = batch.map(r => r._playerId || null);
    const manufacturerIds = batch.map(r => r._manufacturerId || 1);

    await client.query(`
      INSERT INTO cards (card_id, set_id, sport_id, manufacturer_id, console_uid, raw_product_name, raw_console_name, first_seen_date, player_name, card_number, set_name, variation, player_id)
      SELECT * FROM UNNEST($1::bigint[], $2::int[], $3::int[], $4::int[], $5::text[], $6::text[], $7::text[], $8::date[], $9::text[], $10::text[], $11::text[], $12::text[], $13::int[])
      AS t(card_id, set_id, sport_id, manufacturer_id, console_uid, raw_product_name, raw_console_name, first_seen_date, player_name, card_number, set_name, variation, player_id)
      ON CONFLICT (card_id) DO UPDATE SET
        console_uid = EXCLUDED.console_uid,
        player_name = EXCLUDED.player_name,
        card_number = EXCLUDED.card_number,
        set_name = EXCLUDED.set_name,
        variation = EXCLUDED.variation,
        player_id = EXCLUDED.player_id,
        manufacturer_id = EXCLUDED.manufacturer_id
    `, [cardIds, Array(batch.length).fill(setId), Array(batch.length).fill(setInfo?.sport_id || 1), manufacturerIds, consoleUids, productNames, consoleNames, dates, playerNames, cardNumbers, setNames, variants, playerIds]);
  }

  // Denormalize - DISABLED during bulk import for performance
  // Run manually after all imports complete: SELECT denormalize_all_cards();
  // if (uniqueCards.length > 0) {
  //   await client.query(`SELECT denormalize_all_cards()`);
  // }

  return uniqueCards.length;
}

async function loadToSnapshots(client, rows) {
  const BATCH_SIZE = 500;
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map((_, idx) => 
      `($${idx*11+1}, $${idx*11+2}, $${idx*11+3}, $${idx*11+4}, $${idx*11+5}, 
        $${idx*11+6}, $${idx*11+7}, $${idx*11+8}, $${idx*11+9}, $${idx*11+10}, $${idx*11+11})`
    ).join(',');

    const params = batch.flatMap(r => [
      r.card_id, r.console_uid, r.date, r.product_name, r.console_name,
      r.loose_price, r.graded_price, r.psa10_price, r.bgs10_price, 
      r.sales_volume, r.upc
    ]);

    await client.query(
      `INSERT INTO card_daily_snapshots (
        card_id, console_uid, date, product_name, console_name,
        loose_price, graded_price, psa10_price, bgs10_price, sales_volume, upc
      ) VALUES ${values}
       ON CONFLICT (card_id, date) DO UPDATE SET
         product_name = EXCLUDED.product_name,
         loose_price = EXCLUDED.loose_price,
         graded_price = EXCLUDED.graded_price,
         psa10_price = EXCLUDED.psa10_price,
         bgs10_price = EXCLUDED.bgs10_price,
         sales_volume = EXCLUDED.sales_volume`,
      params
    );
  }
}

async function processSet(client, setInfo) {
  const { console_uid, set_name, csv_path, _date } = setInfo;
  const dateStats = getDateStats(_date);
  
  console.log(`\n[${WORKER_ID}] Processing ${console_uid} on ${_date}: ${set_name || 'Unknown Set'}`);
  
  try {
    // Find S3 file
    const s3File = await findS3File(console_uid, _date, csv_path);
    
    if (!s3File) {
      console.log(`  [${WORKER_ID}] No S3 data found for ${console_uid}`);
      await client.query(`SELECT mark_import_skipped($1, $2, $3)`, 
        [console_uid, _date, 'No CSV file in S3']);
      dateStats.setsSkipped++;
      workerStats.totalSetsSkipped++;
      return { success: false, skipped: true };
    }

    if (DRY_RUN) {
      console.log(`  [${WORKER_ID}] DRY RUN - would import ${s3File.Key}`);
      return { success: true, dryRun: true, records: 0 };
    }

    // Download and process
    const rows = await downloadAndProcess(s3File.Key, _date, console_uid, setInfo);
    
    if (rows.length === 0) {
      console.log(`  [${WORKER_ID}] No valid rows found in file`);
      await client.query(`SELECT mark_import_skipped($1, $2, $3)`, 
        [console_uid, _date, 'Empty or invalid CSV']);
      dateStats.setsSkipped++;
      workerStats.totalSetsSkipped++;
      return { success: false, skipped: true };
    }

    console.log(`  [${WORKER_ID}] Downloaded ${rows.length} rows, saving to database...`);

    // Save to database
    await ensureSetAndCards(client, console_uid, setInfo, rows);
    await loadToSnapshots(client, rows);

    // Mark as completed
    await client.query(`SELECT mark_import_completed($1, $2, $3, $4, $5)`, 
      [console_uid, _date, rows.length, s3File.Key, s3File.Size]);

    console.log(`  [${WORKER_ID}] ✅ Completed: ${rows.length} records`);
    
    dateStats.setsSucceeded++;
    dateStats.records += rows.length;
    workerStats.totalSetsSucceeded++;
    workerStats.totalRecords += rows.length;
    
    return { success: true, records: rows.length };

  } catch (err) {
    console.error(`  [${WORKER_ID}] ❌ Error: ${err.message}`);
    await client.query(`SELECT mark_import_failed($1, $2, $3)`, 
      [console_uid, _date, err.message]);
    dateStats.setsFailed++;
    workerStats.totalSetsFailed++;
    return { success: false, error: err.message };
  }
}

async function runWorker() {
  console.log(`\n========================================`);
  console.log(`S3 Import Worker: ${WORKER_ID}`);
  console.log(`Dates: ${DATES.join(', ')}`);
  if (TARGET_SPORT) console.log(`Sport: ${TARGET_SPORT}`);
  if (DRY_RUN) console.log('⚠️  DRY RUN MODE');
  console.log(`========================================\n`);

  const client = await pool.connect();

  try {
    // Initialize queue for ALL dates
    let totalInitialized = 0;
    for (const date of DATES) {
      const initResult = await client.query(
        `SELECT init_ingestion_queue($1, $2) as count`,
        [date, TARGET_SPORT]
      );
      totalInitialized += parseInt(initResult.rows[0].count);
    }
    if (totalInitialized > 0) {
      console.log(`Initialized ${totalInitialized} sets across ${DATES.length} dates`);
    }

    // Process sets until no more pending
    let setInfo;
    let processed = 0;
    
    while ((setInfo = await claimNextSet(client)) && processed < MAX_SETS) {
      processed++;
      workerStats.totalSetsProcessed++;
      getDateStats(setInfo._date).setsProcessed++;
      
      const result = await processSet(client, setInfo);
      
      if (!result.success && !result.skipped && !result.dryRun) {
        console.log(`  [${WORKER_ID}] Continuing to next set despite error...`);
      }
    }

    // Print summary
    const duration = ((Date.now() - workerStats.startTime) / 1000).toFixed(1);
    console.log(`\n========================================`);
    console.log(`Worker Summary: ${WORKER_ID}`);
    console.log(`========================================`);
    
    // Per-date breakdown
    Object.entries(workerStats.byDate).forEach(([date, stats]) => {
      console.log(`\n${date}:`);
      console.log(`  Processed: ${stats.setsProcessed} | Succeeded: ${stats.setsSucceeded} | Failed: ${stats.setsFailed} | Skipped: ${stats.setsSkipped}`);
      console.log(`  Records: ${stats.records.toLocaleString()}`);
    });
    
    console.log(`\nTotals:`);
    console.log(`  Sets processed: ${workerStats.totalSetsProcessed}`);
    console.log(`  Sets succeeded: ${workerStats.totalSetsSucceeded}`);
    console.log(`  Sets failed: ${workerStats.totalSetsFailed}`);
    console.log(`  Sets skipped (no data): ${workerStats.totalSetsSkipped}`);
    console.log(`  Total records: ${workerStats.totalRecords.toLocaleString()}`);
    console.log(`  Duration: ${duration}s`);
    console.log(`========================================`);

    // Final denormalize after all sets processed
    console.log(`[${WORKER_ID}] Running final denormalize...`);
    await client.query(`SELECT denormalize_all_cards()`);
    console.log(`[${WORKER_ID}] Denormalize complete`);

  } catch (err) {
    console.error(`\n❌ [${WORKER_ID}] Fatal error:`, err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runWorker().catch(console.error);
