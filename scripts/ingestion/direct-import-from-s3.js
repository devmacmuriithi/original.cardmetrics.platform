/**
 * direct-import-from-s3.js - Direct S3 Import for Any Sport/Set
 * 
 * Imports card data directly from S3 to database using sets table as reference.
 * Supports filtering by sport, specific console_uid, or date ranges.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const { Readable } = require('stream');
const csv = require('csv-parser');
const { parseCardName } = require('../utils/card-parser');

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
  max: 5
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const MAX_DATES = 30;

// Parse command line arguments
const args = process.argv.slice(2);
const sportArg = args.find(arg => arg.startsWith('--sport='));
const consoleUidArg = args.find(arg => arg.startsWith('--console-uid='));
const singleDateArg = args.find(arg => arg.startsWith('--date='));
const datesArg = args.find(arg => arg.startsWith('--dates='));
const maxDatesArg = args.find(arg => arg.startsWith('--max-dates='));
const fromDateArg = args.find(arg => arg.startsWith('--from-date='));
const SKIP_CLEANUP = args.includes('--no-cleanup');
const DRY_RUN = args.includes('--dry-run');

const TARGET_SPORT = sportArg ? sportArg.split('=')[1] : null;
const TARGET_CONSOLE_UID = consoleUidArg ? consoleUidArg.split('=')[1] : null;
const TARGET_DATES = singleDateArg ? [singleDateArg.split('=')[1]] : 
                    datesArg ? datesArg.split('=')[1].split(',') : null;
const userMaxDates = maxDatesArg ? parseInt(maxDatesArg.split('=')[1]) : null;
const fromDate = fromDateArg ? fromDateArg.split('=')[1] : null;

// Track import statistics
const importStats = {
  totalSets: 0,
  setsWithData: 0,
  setsWithoutData: [],
  totalDates: 0,
  totalRows: 0,
  totalFiles: 0,
  errors: []
};

// Load console_uids from sets table with optional filters
async function loadConsoleUids(client) {
  let query = `
    SELECT s.console_uid, s.slug, s.name, sp.name as sport_name
    FROM sets s
    LEFT JOIN sports sp ON s.sport_id = sp.id
    WHERE s.console_uid IS NOT NULL
  `;
  const params = [];
  
  if (TARGET_SPORT) {
    query += ` AND LOWER(sp.name) = LOWER($${params.length + 1})`;
    params.push(TARGET_SPORT);
  }
  
  if (TARGET_CONSOLE_UID) {
    query += ` AND s.console_uid = $${params.length + 1}`;
    params.push(TARGET_CONSOLE_UID);
  }
  
  query += ` ORDER BY s.console_uid`;
  
  const result = await client.query(query, params);
  console.log(`Loaded ${result.rows.length} sets from database${TARGET_SPORT ? ` (sport: ${TARGET_SPORT})` : ''}${TARGET_CONSOLE_UID ? ` (console_uid: ${TARGET_CONSOLE_UID})` : ''}`);
  
  importStats.totalSets = result.rows.length;
  
  return result.rows;
}

// Discover available dates from S3 bucket
async function discoverAvailableDates() {
  console.log('\n🔍 Discovering available dates from S3...');
  
  const dates = new Set();
  let continuationToken = null;
  let pageCount = 0;
  
  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Delimiter: '/',
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));
    
    pageCount++;
    
    if (response.CommonPrefixes) {
      for (const prefix of response.CommonPrefixes) {
        const match = prefix.Prefix.match(/dt=(\d{4}-\d{2}-\d{2})/);
        if (match) dates.add(match[1]);
      }
    }
    
    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken && pageCount < 100);
  
  const sortedDates = Array.from(dates).sort().reverse();
  
  let filteredDates = sortedDates;
  if (fromDate) {
    const fromIndex = sortedDates.indexOf(fromDate);
    if (fromIndex >= 0) {
      filteredDates = sortedDates.slice(fromIndex);
      console.log(`  Resuming from ${fromDate}, ${filteredDates.length} dates remaining`);
    } else {
      console.log(`  Warning: ${fromDate} not found, using all dates`);
    }
  }
  
  const limit = userMaxDates || MAX_DATES;
  const limitedDates = filteredDates.slice(0, limit);
  
  console.log(`  Found ${dates.size} total dates, using ${limitedDates.length} (max: ${limit})`);
  if (limitedDates.length > 0) {
    console.log(`  Dates: ${limitedDates.slice(0, 5).join(', ')}${limitedDates.length > 5 ? '...' : ''}`);
  }
  
  importStats.totalDates = limitedDates.length;
  return limitedDates;
}

async function findFiles(consoleUids, date) {
  const prefix = `dt=${date}/`;
  const files = [];
  let continuationToken = null;
  let pageCount = 0;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));
    
    pageCount++;
    if (response.Contents) {
      const matching = response.Contents.filter(o => {
        if (!o.Key.endsWith('.csv')) return false;
        return consoleUids.some(uid => o.Key.includes(uid));
      });
      files.push(...matching);
      
      if (pageCount % 5 === 0) {
        console.log(`    Listed ${files.length} files so far...`);
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken);

  return files;
}

function parsePrice(priceStr) {
  if (!priceStr || priceStr === '') return null;
  const val = parseFloat(priceStr.replace(/[$,]/g, ''));
  return isNaN(val) ? null : val;
}

async function downloadAndTransform(key, date, consoleUid, fileIndex, totalFiles) {
  console.log(`    [${fileIndex}/${totalFiles}] Downloading ${key.split('/').pop()}...`);
  
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );

  const rows = [];
  const parser = Readable.from(response.Body).pipe(csv());
  
  let debugCount = 0;

  for await (const row of parser) {
    const cardId = parseInt(row.id);
    if (!cardId || isNaN(cardId)) continue;

    const loosePrice = parsePrice(row['loose-price']);
    const salesVol = parseInt(row['sales-volume']) || 0;
    
    if (debugCount < 3) {
      console.log(`      [DEBUG] Card ${cardId}: loose-price='${row['loose-price']}' parsed=${loosePrice}, sales-volume='${row['sales-volume']}' parsed=${salesVol}`);
      debugCount++;
    }

    let parsedData = { playerName: null, cardNumber: null, setName: null, variant: null };
    try {
      parsedData = parseCardName(row['product-name'] || '');
    } catch (parseErr) {
      if (debugCount < 3) {
        console.log(`      [WARN] Failed to parse product name for card ${cardId}: ${parseErr.message}`);
      }
    }

    rows.push({
      card_id: cardId,
      console_uid: consoleUid,
      date: date,
      product_name: row['product-name'] || '',
      console_name: row['console-name'] || '',
      ...parsedData,
      loose_price: loosePrice,
      cib_price: parsePrice(row['cib-price']),
      new_price: parsePrice(row['new-price']),
      graded_price: parsePrice(row['graded-price']),
      box_only_price: parsePrice(row['box-only-price']),
      psa10_price: parsePrice(row['manual-only-price']),
      bgs10_price: parsePrice(row['bgs-10-price']),
      condition_17_price: parsePrice(row['condition-17-price']),
      condition_18_price: parsePrice(row['condition-18-price']),
      gamestop_price: parsePrice(row['gamestop-price']),
      gamestop_trade_price: parsePrice(row['gamestop-trade-price']),
      retail_loose_buy: parsePrice(row['retail-loose-buy']),
      retail_loose_sell: parsePrice(row['retail-loose-sell']),
      retail_cib_buy: parsePrice(row['retail-cib-buy']),
      retail_cib_sell: parsePrice(row['retail-cib-sell']),
      retail_new_buy: parsePrice(row['retail-new-buy']),
      retail_new_sell: parsePrice(row['retail-new-sell']),
      upc: row['upc'] || null,
      sales_volume: salesVol,
      genre: row['genre'] || null,
      tcg_id: row['tcg-id'] || null,
      asin: row['asin'] || null,
      epid: row['epid'] || null,
      release_date: row['release-date'] || null
    });
  }
  
  const withPrices = rows.filter(r => r.loose_price !== null).length;
  console.log(`      Total: ${rows.length}, With loose_price: ${withPrices} (${((withPrices/rows.length)*100).toFixed(1)}%)`);

  return rows;
}

// Cache for manufacturer and player lookups
const manufacturerCache = new Map();
const playerCache = new Map();

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

async function ensureSetsAndCards(client, consoleUid, setInfo, rows) {
  // Get sport_id from setInfo or default to 1 (Basketball)
  const sportId = setInfo?.sport_id || 1;
  
  // Ensure set exists
  await client.query(`
    INSERT INTO sets (console_uid, name, slug, sport_id, manufacturer_id)
    VALUES ($1, $2, $3, $4, 1)
    ON CONFLICT (console_uid) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      sport_id = EXCLUDED.sport_id,
      last_updated = CURRENT_TIMESTAMP
  `, [consoleUid, setInfo?.name || consoleUid, setInfo?.slug || consoleUid, sportId]);

  // Get set_id
  const setResult = await client.query(`SELECT id FROM sets WHERE console_uid = $1`, [consoleUid]);
  const setId = setResult.rows[0]?.id;
  if (!setId) return;

  // Deduplicate cards
  const uniqueCards = [...new Map(rows.map(r => [r.card_id, r])).values()];

  // Resolve players and manufacturers
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
    `, [cardIds, Array(batch.length).fill(setId), Array(batch.length).fill(sportId), consoleUids, manufacturerIds, productNames, consoleNames, dates, playerNames, cardNumbers, setNames, variants, playerIds]);
  }
  
  // Denormalize
  console.log(`    Denormalizing ${uniqueCards.length} cards...`);
  await client.query(`SELECT denormalize_all_cards()`);
}

async function loadToSnapshots(client, rows) {
  const BATCH_SIZE = 500;
  
  const cardIds = [...new Set(rows.map(r => r.card_id))];
  const cardDataResult = await client.query(
    `SELECT id, raw_product_name, raw_console_name FROM cards WHERE id = ANY($1)`,
    [cardIds]
  );
  const cardDataMap = new Map(cardDataResult.rows.map(r => [r.id, r]));
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map((_, idx) => 
      `($${idx*29+1}, $${idx*29+2}, $${idx*29+3}, $${idx*29+4}, $${idx*29+5}, $${idx*29+6}, $${idx*29+7}, $${idx*29+8}, $${idx*29+9}, $${idx*29+10}, $${idx*29+11}, $${idx*29+12}, $${idx*29+13}, $${idx*29+14}, $${idx*29+15}, $${idx*29+16}, $${idx*29+17}, $${idx*29+18}, $${idx*29+19}, $${idx*29+20}, $${idx*29+21}, $${idx*29+22}, $${idx*29+23}, $${idx*29+24}, $${idx*29+25}, $${idx*29+26}, $${idx*29+27}, $${idx*29+28}, $${idx*29+29})`
    ).join(',');

    const params = batch.flatMap(r => {
      const cardData = cardDataMap.get(r.card_id);
      return [
        r.card_id, r.console_uid, r.date, 
        cardData?.raw_product_name || r.product_name || null,
        cardData?.raw_console_name || r.console_name || null,
        r.loose_price, r.cib_price, r.new_price, r.graded_price, r.box_only_price,
        r.psa10_price, r.bgs10_price, r.condition_17_price, r.condition_18_price, r.gamestop_price,
        r.gamestop_trade_price, r.retail_loose_buy, r.retail_loose_sell, r.retail_cib_buy, r.retail_cib_sell,
        r.retail_new_buy, r.retail_new_sell, r.upc, r.sales_volume, r.genre,
        r.tcg_id, r.asin, r.epid, r.release_date
      ];
    });

    await client.query(
      `INSERT INTO card_daily_snapshots (
        card_id, console_uid, date, product_name, console_name,
        loose_price, cib_price, new_price, graded_price, box_only_price,
        psa10_price, bgs10_price, condition_17_price, condition_18_price, gamestop_price,
        gamestop_trade_price, retail_loose_buy, retail_loose_sell, retail_cib_buy, retail_cib_sell,
        retail_new_buy, retail_new_sell, upc, sales_volume, genre,
        tcg_id, asin, epid, release_date
      ) VALUES ${values}
       ON CONFLICT (card_id, date) DO UPDATE SET
         product_name = EXCLUDED.product_name,
         console_name = EXCLUDED.console_name,
         loose_price = EXCLUDED.loose_price,
         cib_price = EXCLUDED.cib_price,
         new_price = EXCLUDED.new_price,
         graded_price = EXCLUDED.graded_price,
         box_only_price = EXCLUDED.box_only_price,
         psa10_price = EXCLUDED.psa10_price,
         bgs10_price = EXCLUDED.bgs10_price,
         condition_17_price = EXCLUDED.condition_17_price,
         condition_18_price = EXCLUDED.condition_18_price,
         gamestop_price = EXCLUDED.gamestop_price,
         gamestop_trade_price = EXCLUDED.gamestop_trade_price,
         retail_loose_buy = EXCLUDED.retail_loose_buy,
         retail_loose_sell = EXCLUDED.retail_loose_sell,
        retail_cib_buy = EXCLUDED.retail_cib_buy,
         retail_cib_sell = EXCLUDED.retail_cib_sell,
         retail_new_buy = EXCLUDED.retail_new_buy,
         retail_new_sell = EXCLUDED.retail_new_sell,
         upc = EXCLUDED.upc,
         sales_volume = EXCLUDED.sales_volume,
         genre = EXCLUDED.genre,
         tcg_id = EXCLUDED.tcg_id,
         asin = EXCLUDED.asin,
         epid = EXCLUDED.epid,
         release_date = EXCLUDED.release_date`,
      params
    );
  }
}

async function validateData(client, consoleUids) {
  console.log('\n📊 Validating data...');
  
  const snapResult = await client.query(`
    SELECT 
      console_uid,
      COUNT(*) as card_count,
      COUNT(DISTINCT date) as date_count,
      SUM(sales_volume) as total_volume
    FROM card_daily_snapshots
    WHERE console_uid = ANY($1)
    GROUP BY console_uid
    ORDER BY card_count DESC
  `, [consoleUids.map(s => s.console_uid)]);

  console.log('\nSets with data imported:');
  snapResult.rows.forEach(row => {
    console.log(`  ${row.console_uid}: ${row.card_count} cards, ${row.date_count} dates, volume: ${row.total_volume}`);
  });

  // Track which sets have data vs don't
  const setsWithData = new Set(snapResult.rows.map(r => r.console_uid));
  importStats.setsWithData = setsWithData.size;
  importStats.setsWithoutData = consoleUids
    .filter(s => !setsWithData.has(s.console_uid))
    .map(s => s.console_uid);

  try {
    const cardsResult = await client.query(`
      SELECT 
        COUNT(*) as total_cards,
        COUNT(player_id) as cards_with_players,
        COUNT(player_name) as cards_with_names,
        COUNT(DISTINCT set_id) as set_count
      FROM cards
    `);
    const c = cardsResult.rows[0];
    console.log(`\n✅ Cards table: ${c.total_cards} total, ${c.cards_with_players} with players, ${c.cards_with_names} with names`);
    
    const denormResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE player_first_name IS NOT NULL) as with_first_name,
        COUNT(*) FILTER (WHERE team_name IS NOT NULL) as with_team,
        COUNT(*) FILTER (WHERE manufacturer_name IS NOT NULL) as with_manufacturer
      FROM cards
    `);
    const d = denormResult.rows[0];
    console.log(`  Denormalized: ${d.with_first_name} first names, ${d.with_team} teams, ${d.with_manufacturer} manufacturers`);
  } catch (err) {
    console.log(`\n⚠️  Validation query failed: ${err.message}`);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total sets queried:     ${importStats.totalSets}`);
  console.log(`Sets with data found:   ${importStats.setsWithData}`);
  console.log(`Sets without data:      ${importStats.setsWithoutData.length}`);
  if (importStats.setsWithoutData.length > 0 && importStats.setsWithoutData.length <= 10) {
    console.log(`  (No S3 data for: ${importStats.setsWithoutData.join(', ')})`);
  } else if (importStats.setsWithoutData.length > 10) {
    console.log(`  (First 10 without data: ${importStats.setsWithoutData.slice(0, 10).join(', ')}...)`);
  }
  console.log(`Dates processed:        ${importStats.totalDates}`);
  console.log(`Total files downloaded: ${importStats.totalFiles}`);
  console.log(`Total rows imported:    ${importStats.totalRows.toLocaleString()}`);
  if (importStats.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${importStats.errors.length}`);
    importStats.errors.slice(0, 5).forEach(e => console.log(`   - ${e}`));
  }
  console.log('='.repeat(50));
}

(async () => {
  console.log('========================================');
  console.log('Direct S3 Import');
  if (TARGET_SPORT) console.log(`Sport: ${TARGET_SPORT}`);
  if (TARGET_CONSOLE_UID) console.log(`Console UID: ${TARGET_CONSOLE_UID}`);
  if (DRY_RUN) console.log('⚠️  DRY RUN - No changes will be made');
  console.log('========================================');

  const client = await pool.connect();

  try {
    // Load sets from database
    const setInfos = await loadConsoleUids(client);
    if (setInfos.length === 0) {
      console.error('No sets found in database matching criteria');
      process.exit(1);
    }

    // Discover dates
    const datesToProcess = TARGET_DATES || await discoverAvailableDates();
    if (datesToProcess.length === 0) {
      console.error('No dates found to process');
      process.exit(1);
    }

    const consoleUidList = setInfos.map(s => s.console_uid);
    let totalRows = 0;

    for (const date of datesToProcess) {
      console.log(`\n📅 Processing ${date}...`);
      
      if (DRY_RUN) {
        console.log('  (Dry run - skipping cleanup and import)');
      } else if (!SKIP_CLEANUP) {
        await client.query(
          'DELETE FROM card_daily_snapshots WHERE date = $1 AND console_uid = ANY($2)', 
          [date, consoleUidList]
        );
        console.log(`  🧹 Cleared existing data for ${date}`);
      }

      const files = await findFiles(consoleUidList, date);
      console.log(`  Found ${files.length} files`);
      importStats.totalFiles += files.length;

      if (files.length === 0) continue;

      let allRows = [];
      let fileIndex = 0;
      for (const file of files) {
        fileIndex++;
        const consoleUid = consoleUidList.find(uid => file.Key.includes(uid));
        if (!consoleUid) continue;
        
        const rows = await downloadAndTransform(file.Key, date, consoleUid, fileIndex, files.length);
        allRows.push(...rows);
      }
      console.log(`  Transformed ${allRows.length} rows`);

      if (allRows.length > 0 && !DRY_RUN) {
        const uniqueConsoleUids = [...new Set(allRows.map(r => r.console_uid))];
        
        console.log(`  Ensuring ${uniqueConsoleUids.length} sets and ~${allRows.length} cards exist...`);
        
        let setIndex = 0;
        for (const uid of uniqueConsoleUids) {
          setIndex++;
          const uidRows = allRows.filter(r => r.console_uid === uid);
          const setInfo = setInfos.find(s => s.console_uid === uid);
          console.log(`    [${setIndex}/${uniqueConsoleUids.length}] Set ${uid}: ${uidRows.length} cards`);
          await ensureSetsAndCards(client, uid, setInfo, uidRows);
        }
        
        await loadToSnapshots(client, allRows);
        totalRows += allRows.length;
        console.log(`  ✅ Loaded ${allRows.length} snapshots`);
      }
    }

    importStats.totalRows = totalRows;

    if (!DRY_RUN) {
      await validateData(client, setInfos);
      await client.query('VACUUM ANALYZE card_daily_snapshots');
    }

    printSummary();

    console.log('\n========================================');
    console.log(DRY_RUN ? '✅ Dry Run Complete!' : '✅ Import Complete!');
    console.log('========================================');
    console.log('\nCheck with:');
    console.log('  SELECT * FROM card_daily_snapshots LIMIT 5;');
    console.log('  SELECT * FROM vw_market_enriched LIMIT 5;');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    importStats.errors.push(err.message);
    printSummary();
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
