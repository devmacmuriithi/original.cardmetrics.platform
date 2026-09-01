#!/usr/bin/env node
/**
 * import_matched_cards.js
 * -----------------------
 * Imports matched_G78842.csv into the matched_cards_final table
 *
 * USAGE:
 *   node import_matched_cards.js --csv matched_G78842.csv
 *
 * REQUIREMENTS:
 *   npm install csv-parse pg dotenv
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// =============================================================================
// CSV LOADING
// =============================================================================

function loadMatchedCsv(filepath) {
  console.log(`Loading CSV: ${filepath}`);
  const content = fs.readFileSync(filepath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });
  console.log(`  -> ${rows.length} rows loaded`);
  return rows;
}

// =============================================================================
// DATA TRANSFORMATION
// =============================================================================

/**
 * Convert CSV row to database row format
 */
function transformRow(csvRow, sourceFile) {
  return {
    spc_id: csvRow.spc_id || null,
    gemrate_id: csvRow.gemrate_id,
    console_name: csvRow.console_name,
    player_name: csvRow.player_name,
    parallel: csvRow.parallel,
    card_number: csvRow.card_number,
    card_description: csvRow.card_description || null,
    
    // Pricing
    loose_price: csvRow.loose_price ? parseFloat(csvRow.loose_price.replace(/[$,]/g, '')) : null,
    graded_price: csvRow.graded_price ? parseFloat(csvRow.graded_price.replace(/[$,]/g, '')) : null,
    manual_only_price: csvRow.manual_only_price ? parseFloat(csvRow.manual_only_price.replace(/[$,]/g, '')) : null,
    bgs_10_price: csvRow.bgs_10_price ? parseFloat(csvRow.bgs_10_price.replace(/[$,]/g, '')) : null,
    
    // Sales
    sales_volume: csvRow.sales_volume ? parseInt(csvRow.sales_volume) : null,
    spc_date: csvRow.spc_date || null,
    
    // Grading summary (keep as text with % and commas)
    gem_rate_all_time: csvRow.gem_rate_all_time || null,
    gem_rate_past_month: csvRow.gem_rate_past_month || null,
    total_graded: csvRow.total_graded || null,
    total_gems: csvRow.total_gems || null,
    graded_past_month: csvRow.graded_past_month || null,
    graded_prior_month: csvRow.graded_prior_month || null,
    momentum_30d: csvRow.momentum_30d || null,
    last_gem_date: csvRow.last_gem_date || null,
    last_graded_date: csvRow.last_graded_date || null,
    
    // Grade distribution
    pct_psa_10: csvRow.pct_psa_10 || null,
    pct_psa_9: csvRow.pct_psa_9 || null,
    pct_psa_8: csvRow.pct_psa_8 || null,
    pct_psa_7: csvRow.pct_psa_7 || null,
    pct_psa_6: csvRow.pct_psa_6 || null,
    pct_psa_5: csvRow.pct_psa_5 || null,
    pct_psa_4: csvRow.pct_psa_4 || null,
    pct_psa_3: csvRow.pct_psa_3 || null,
    
    // Links
    cardladder_all_graded_url: csvRow.cardladder_all_graded_url || null,
    gemrate_url: csvRow.gemrate_url || null,
    psa_cert_url: csvRow.psa_cert_url || null,
    
    // Metadata
    source_file: sourceFile,
  };
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Insert a batch of rows using a single query
 */
async function insertBatch(client, rows) {
  if (rows.length === 0) return;

  const valueStrings = [];
  const values = [];
  let paramIndex = 1;

  for (const row of rows) {
    const rowParams = [];
    for (let i = 0; i < 34; i++) {
      rowParams.push(`$${paramIndex++}`);
    }
    valueStrings.push(`(${rowParams.join(', ')})`);

    values.push(
      row.spc_id, row.gemrate_id, row.console_name, row.player_name, row.parallel, row.card_number, row.card_description,
      row.loose_price, row.graded_price, row.manual_only_price, row.bgs_10_price,
      row.sales_volume, row.spc_date,
      row.gem_rate_all_time, row.gem_rate_past_month, row.total_graded, row.total_gems,
      row.graded_past_month, row.graded_prior_month, row.momentum_30d,
      row.last_gem_date, row.last_graded_date,
      row.pct_psa_10, row.pct_psa_9, row.pct_psa_8, row.pct_psa_7, row.pct_psa_6, row.pct_psa_5, row.pct_psa_4, row.pct_psa_3,
      row.cardladder_all_graded_url, row.gemrate_url, row.psa_cert_url,
      row.source_file
    );
  }

  const query = `
    INSERT INTO matched_cards_final (
      spc_id, gemrate_id, console_name, player_name, parallel, card_number, card_description,
      loose_price, graded_price, manual_only_price, bgs_10_price,
      sales_volume, spc_date,
      gem_rate_all_time, gem_rate_past_month, total_graded, total_gems,
      graded_past_month, graded_prior_month, momentum_30d,
      last_gem_date, last_graded_date,
      pct_psa_10, pct_psa_9, pct_psa_8, pct_psa_7, pct_psa_6, pct_psa_5, pct_psa_4, pct_psa_3,
      cardladder_all_graded_url, gemrate_url, psa_cert_url,
      source_file
    ) VALUES ${valueStrings.join(', ')}
    ON CONFLICT (gemrate_id) DO UPDATE SET
      spc_id = EXCLUDED.spc_id,
      console_name = EXCLUDED.console_name,
      player_name = EXCLUDED.player_name,
      parallel = EXCLUDED.parallel,
      card_number = EXCLUDED.card_number,
      card_description = EXCLUDED.card_description,
      loose_price = EXCLUDED.loose_price,
      graded_price = EXCLUDED.graded_price,
      manual_only_price = EXCLUDED.manual_only_price,
      bgs_10_price = EXCLUDED.bgs_10_price,
      sales_volume = EXCLUDED.sales_volume,
      spc_date = EXCLUDED.spc_date,
      gem_rate_all_time = EXCLUDED.gem_rate_all_time,
      gem_rate_past_month = EXCLUDED.gem_rate_past_month,
      total_graded = EXCLUDED.total_graded,
      total_gems = EXCLUDED.total_gems,
      graded_past_month = EXCLUDED.graded_past_month,
      graded_prior_month = EXCLUDED.graded_prior_month,
      momentum_30d = EXCLUDED.momentum_30d,
      last_gem_date = EXCLUDED.last_gem_date,
      last_graded_date = EXCLUDED.last_graded_date,
      pct_psa_10 = EXCLUDED.pct_psa_10,
      pct_psa_9 = EXCLUDED.pct_psa_9,
      pct_psa_8 = EXCLUDED.pct_psa_8,
      pct_psa_7 = EXCLUDED.pct_psa_7,
      pct_psa_6 = EXCLUDED.pct_psa_6,
      pct_psa_5 = EXCLUDED.pct_psa_5,
      pct_psa_4 = EXCLUDED.pct_psa_4,
      pct_psa_3 = EXCLUDED.pct_psa_3,
      cardladder_all_graded_url = EXCLUDED.cardladder_all_graded_url,
      gemrate_url = EXCLUDED.gemrate_url,
      psa_cert_url = EXCLUDED.psa_cert_url,
      source_file = EXCLUDED.source_file,
      import_date = CURRENT_TIMESTAMP
  `;

  await client.query(query, values);
}

/**
 * Import all rows with transaction using batch inserts
 */
async function importData(csvPath) {
  const sourceFile = path.basename(csvPath);
  const rows = loadMatchedCsv(csvPath);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`\nImporting ${rows.length} rows in batches...`);
    
    const BATCH_SIZE = 500;
    const dbRows = rows.map(csvRow => transformRow(csvRow, sourceFile));
    
    for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
      const batch = dbRows.slice(i, i + BATCH_SIZE);
      await insertBatch(client, batch);
      
      const progress = Math.min(i + BATCH_SIZE, dbRows.length);
      process.stdout.write(`\r  Progress: ${progress}/${dbRows.length}`);
    }
    
    await client.query('COMMIT');
    
    const result = await pool.query('SELECT COUNT(*) FROM matched_cards_final');
    const totalInDb = parseInt(result.rows[0].count);
    
    console.log(`\n\n✓ Import complete!`);
    console.log(`  Total rows in database: ${totalInDb}`);
    console.log(`  Rows processed: ${dbRows.length}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Import failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// =============================================================================
// ENTRY POINT
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const getCsvPath = () => {
    const i = args.indexOf('--csv');
    return i !== -1 ? args[i + 1] : null;
  };

  const csvPath = getCsvPath();

  if (!csvPath) {
    console.error('Usage: node import_matched_cards.js --csv <file>');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: File not found: ${csvPath}`);
    process.exit(1);
  }

  try {
    await importData(csvPath);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    await pool.end();
    process.exit(1);
  }
}

main();
