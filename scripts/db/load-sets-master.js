/**
 * load-sets-master.js - Load sets_master dimension table from CSV
 * 
 * Expected CSV columns: category, console_uid, slug, page_name, url, csv_url
 * Enables Metabase filtering by category, console_uid, and set name
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function loadSetsMaster(csvPath) {
  console.log(`Loading sets_master from ${csvPath}...`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const client = await pool.connect();
  
  try {
    // Don't truncate - use upsert instead to preserve existing data
    console.log('Using upsert mode (existing sets will be updated, new sets added)...');

    const stream = fs.createReadStream(csvPath).pipe(csv());
    let batch = [];
    let total = 0;
    let updated = 0;
    let inserted = 0;
    const BATCH_SIZE = 1000;

    for await (const row of stream) {
      // Construct csv_path from slug and console_uid
      // Format: {slug}_{console_uid}.csv
      const csvPath = `${row.slug}_${row.console_uid}.csv`;
      
      batch.push([
        row.console_uid,
        row.slug,
        row.category,
        row.page_name,
        row.url,
        csvPath  // Constructed as slug_console_uid.csv
      ]);

      if (batch.length >= BATCH_SIZE) {
        const result = await upsertBatch(client, batch);
        total += batch.length;
        inserted += result.inserted;
        updated += result.updated;
        console.log(`Processed ${total} sets... (inserted: ${inserted}, updated: ${updated})`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      const result = await upsertBatch(client, batch);
      total += batch.length;
      inserted += result.inserted;
      updated += result.updated;
    }

    console.log(`✅ Loaded ${total} sets into sets_master`);
    console.log(`   New inserts: ${inserted}, Updates: ${updated}`);
    console.log('\nSample csv_path entries:');
    
    // Show sample csv_path entries
    const sampleResult = await client.query(
      'SELECT console_uid, csv_path FROM sets_master LIMIT 3'
    );
    sampleResult.rows.forEach(r => {
      console.log(`  ${r.console_uid} → ${r.csv_path}`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}

async function upsertBatch(client, batch) {
  const values = batch.map((_, i) => 
    `($${i*6+1}, $${i*6+2}, $${i*6+3}, $${i*6+4}, $${i*6+5}, $${i*6+6})`
  ).join(',');

  // Use CTE to get counts of inserted vs updated
  const result = await client.query(
    `WITH upsert AS (
      INSERT INTO sets_master (console_uid, slug, category, page_name, url, csv_path) 
      VALUES ${values}
      ON CONFLICT (console_uid) 
      DO UPDATE SET 
        slug = EXCLUDED.slug,
        category = EXCLUDED.category,
        page_name = EXCLUDED.page_name,
        url = EXCLUDED.url,
        csv_path = EXCLUDED.csv_path
      RETURNING (xmax = 0) as is_insert
    )
    SELECT 
      COUNT(*) FILTER (WHERE is_insert) as inserted,
      COUNT(*) FILTER (WHERE NOT is_insert) as updated
    FROM upsert`,
    batch.flat()
  );

  return {
    inserted: parseInt(result.rows[0].inserted) || 0,
    updated: parseInt(result.rows[0].updated) || 0
  };
}

const csvPath = process.argv[2] || 'basketball_sets.csv';
if (!csvPath) {
  console.error('Usage: node load-sets-master.js [basketball_sets.csv]');
  process.exit(1);
}

loadSetsMaster(csvPath);
