/**
 * sync-raw-ingests.js - Transform staging data to normalized tables
 * 
 * Processes cards_raw_ingests and syncs to:
 * - sets (ensure set exists)
 * - cards (ensure card exists, update names)
 * - card_daily_snapshots (load price data)
 * 
 * Usage:
 *   node sync-raw-ingests.js                    # Sync all unprocessed
 *   node sync-raw-ingests.js --date=2026-01-24 # Sync specific date
 *   node sync-raw-ingests.js --limit=1000       # Sync batch of 1000 rows
 *   node sync-raw-ingests.js --dry-run          # Preview without changes
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 10
});

// Parse arguments
const args = process.argv.slice(2);
const dateArg = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
const limitArg = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');
const DRY_RUN = args.includes('--dry-run');
const SKIP_CLEANUP = args.includes('--no-cleanup');

// Ensure set exists
async function ensureSet(client, consoleUid, consoleName) {
  // Try to find existing set
  const existing = await client.query(
    'SELECT id FROM sets WHERE console_uid = $1',
    [consoleUid]
  );
  
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  
  // Extract year from console_name if possible
  const yearMatch = consoleName?.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  
  // Create new set
  const result = await client.query(
    `INSERT INTO sets (console_uid, name, console_name, slug, year, sport_id, manufacturer_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (console_uid) DO UPDATE SET
       name = EXCLUDED.name,
       console_name = EXCLUDED.console_name
     RETURNING id`,
    [consoleUid, consoleName || consoleUid, consoleName, consoleUid, year, 1, 1]
  );
  
  return result.rows[0].id;
}

// Ensure card exists
async function ensureCard(client, cardId, setId, consoleUid, productName, consoleName, snapshotDate) {
  // Try to find existing card by card_id (TCGPLAYER ID)
  const existing = await client.query(
    'SELECT id, console_uid FROM cards WHERE card_id = $1',
    [cardId]
  );
  
  if (existing.rows.length > 0) {
    // Update names and console_uid if card exists
    const currentConsoleUid = existing.rows[0].console_uid;
    await client.query(
      `UPDATE cards 
       SET raw_product_name = $1, 
           raw_console_name = $2,
           console_uid = COALESCE($3, console_uid),
           last_updated = NOW()
       WHERE card_id = $4
         AND (raw_product_name IS NULL OR raw_product_name != $1)`,
      [productName, consoleName, consoleUid || currentConsoleUid, cardId]
    );
    return existing.rows[0].id;
  }
  
  // Create new card with card_id (TCGPLAYER ID) and console_uid
  const result = await client.query(
    `INSERT INTO cards (card_id, set_id, sport_id, manufacturer_id, console_uid, raw_product_name, raw_console_name, first_seen_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (card_id) DO UPDATE SET
       console_uid = COALESCE(EXCLUDED.console_uid, cards.console_uid),
       raw_product_name = EXCLUDED.raw_product_name,
       raw_console_name = EXCLUDED.raw_console_name,
       last_updated = NOW()
     RETURNING id`,
    [cardId, setId, 1, 1, consoleUid, productName, consoleName, snapshotDate]
  );
  
  return result.rows[0].id;
}

// Sync single row to normalized tables
async function syncRow(client, row) {
  const { 
    id: ingestId,
    card_id,
    product_name,
    console_name,
    console_uid,
    loose_price,
    graded_price,
    psa10_price,
    bgs10_price,
    cib_price,
    new_price,
    box_only_price,
    manual_only_price,
    condition_17_price,
    condition_18_price,
    gamestop_price,
    gamestop_trade_price,
    retail_loose_buy,
    retail_loose_sell,
    retail_cib_buy,
    retail_cib_sell,
    retail_new_buy,
    retail_new_sell,
    sales_volume,
    upc,
    tcg_id,
    asin,
    epid,
    genre,
    release_date,
    snapshot_date
  } = row;
  
  try {
    // Ensure set exists
    const setId = await ensureSet(client, console_uid, console_name);
    
    // Ensure card exists (now passing console_uid)
    await ensureCard(client, card_id, setId, console_uid, product_name, console_name, snapshot_date);
    
    if (!DRY_RUN) {
      // Insert to card_daily_snapshots
      await client.query(
        `INSERT INTO card_daily_snapshots 
         (card_id, console_uid, date, product_name, console_name, loose_price, graded_price, 
          psa10_price, bgs10_price, cib_price, new_price, box_only_price, manual_only_price,
          condition_17_price, condition_18_price, gamestop_price, gamestop_trade_price,
          retail_loose_buy, retail_loose_sell, retail_cib_buy, retail_cib_sell, retail_new_buy, retail_new_sell,
          sales_volume, upc, tcg_id, asin, epid, genre, release_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
         ON CONFLICT (card_id, date) DO UPDATE SET
           product_name = EXCLUDED.product_name,
           console_name = EXCLUDED.console_name,
           loose_price = EXCLUDED.loose_price,
           graded_price = EXCLUDED.graded_price,
           psa10_price = EXCLUDED.psa10_price,
           bgs10_price = EXCLUDED.bgs10_price,
           cib_price = EXCLUDED.cib_price,
           new_price = EXCLUDED.new_price,
           box_only_price = EXCLUDED.box_only_price,
           manual_only_price = EXCLUDED.manual_only_price,
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
           sales_volume = EXCLUDED.sales_volume,
           upc = EXCLUDED.upc,
           tcg_id = EXCLUDED.tcg_id,
           asin = EXCLUDED.asin,
           epid = EXCLUDED.epid,
           genre = EXCLUDED.genre,
           release_date = EXCLUDED.release_date`,
        [card_id, console_uid, snapshot_date, product_name, console_name,
         loose_price, graded_price, psa10_price, bgs10_price, cib_price, new_price, box_only_price, manual_only_price,
         condition_17_price, condition_18_price, gamestop_price, gamestop_trade_price,
         retail_loose_buy, retail_loose_sell, retail_cib_buy, retail_cib_sell, retail_new_buy, retail_new_sell,
         sales_volume, upc, tcg_id, asin, epid, genre, release_date]
      );
      
      // Mark as processed
      await client.query(
        'UPDATE cards_raw_ingests SET processed = TRUE, processed_at = NOW() WHERE id = $1',
        [ingestId]
      );
    }
    
    return { success: true, card_id, setId };
  } catch (err) {
    if (!DRY_RUN) {
      // Mark as failed
      await client.query(
        'UPDATE cards_raw_ingests SET error_message = $1 WHERE id = $2',
        [err.message.substring(0, 500), ingestId]
      );
    }
    return { success: false, card_id, error: err.message };
  }
}

// Main sync function
async function syncAll() {
  console.log('========================================');
  console.log('Sync Raw Ingests to Normalized Tables');
  console.log('========================================');
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  const client = await pool.connect();
  
  try {
    // Get unprocessed rows
    let query = 'SELECT * FROM cards_raw_ingests WHERE processed = FALSE';
    const params = [];
    
    if (dateArg) {
      query += ' AND snapshot_date = $1';
      params.push(dateArg);
    }
    
    query += ' ORDER BY snapshot_date, card_id';
    
    if (limitArg > 0) {
      query += ` LIMIT ${limitArg}`;
    }
    
    const { rows: unprocessed } = await client.query(query, params);
    
    console.log(`\n📋 Found ${unprocessed.length} unprocessed rows`);
    
    if (unprocessed.length === 0) {
      console.log('\n✅ Nothing to sync');
      return;
    }
    
    // Group by set for progress reporting
    const bySet = {};
    unprocessed.forEach(r => {
      bySet[r.console_uid] = (bySet[r.console_uid] || 0) + 1;
    });
    
    console.log('\n📊 By set:');
    Object.entries(bySet).forEach(([uid, count]) => {
      console.log(`  ${uid}: ${count} rows`);
    });
    
    if (DRY_RUN) {
      console.log('\n(Dry run - stopping here)');
      return;
    }
    
    // Process rows
    console.log('\n🔄 Syncing...');
    
    let success = 0;
    let failed = 0;
    let currentSet = null;
    let setCount = 0;
    
    await client.query('BEGIN');
    
    try {
      for (let i = 0; i < unprocessed.length; i++) {
        const row = unprocessed[i];
        
        // Progress reporting by set
        if (row.console_uid !== currentSet) {
          if (currentSet) {
            console.log(`  ✅ ${currentSet}: ${setCount} rows`);
          }
          currentSet = row.console_uid;
          setCount = 0;
          console.log(`\n📦 Processing set: ${currentSet}...`);
        }
        setCount++;
        
        // Progress every 100 rows
        if ((i + 1) % 100 === 0) {
          process.stdout.write(`  ${i + 1}/${unprocessed.length}...\r`);
        }
        
        const result = await syncRow(client, row);
        
        if (result.success) {
          success++;
        } else {
          failed++;
          console.log(`\n  ⚠️  Failed card ${result.card_id}: ${result.error}`);
        }
      }
      
      // Report last set
      if (currentSet) {
        console.log(`  ✅ ${currentSet}: ${setCount} rows`);
      }
      
      await client.query('COMMIT');
      
      console.log('\n========================================');
      console.log('✅ Sync complete!');
      console.log('========================================');
      console.log(`  Success: ${success}`);
      console.log(`  Failed: ${failed}`);
      
      // Show remaining unprocessed
      const remaining = await client.query(
        'SELECT COUNT(*) FROM cards_raw_ingests WHERE processed = FALSE'
      );
      console.log(`  Remaining unprocessed: ${remaining.rows[0].count}`);
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    
  } finally {
    client.release();
  }
}

// Show summary and run
async function main() {
  const client = await pool.connect();
  
  try {
    // Show current status
    const summary = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending,
        COUNT(*) FILTER (WHERE error_message IS NOT NULL) as errors,
        COUNT(DISTINCT snapshot_date) as dates,
        COUNT(DISTINCT console_uid) as sets
      FROM cards_raw_ingests
    `);
    
    const s = summary.rows[0];
    console.log('\n📊 Current staging table status:');
    console.log(`  Total rows: ${s.total}`);
    console.log(`  Processed: ${s.processed}`);
    console.log(`  Pending: ${s.pending}`);
    console.log(`  Errors: ${s.errors}`);
    console.log(`  Dates: ${s.dates}`);
    console.log(`  Sets: ${s.sets}`);
    
  } finally {
    client.release();
  }
  
  // Run sync
  await syncAll();
  
  await pool.end();
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
