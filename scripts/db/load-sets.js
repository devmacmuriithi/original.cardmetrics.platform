require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function loadSets(csvPath) {
  console.log(`Loading sets from ${csvPath}...`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const client = await pool.connect();
  
  try {
    console.log('Using upsert mode (existing sets will be updated, new sets added)...');

    // Get sport_id mapping
    const sportsResult = await client.query('SELECT id, name FROM sports');
    const sportMap = {};
    sportsResult.rows.forEach(r => {
      sportMap[r.name.toLowerCase()] = r.id;
    });

    const stream = fs.createReadStream(csvPath).pipe(csv());
    let batch = [];
    let total = 0;
    let updated = 0;
    let inserted = 0;
    const BATCH_SIZE = 500;

    for await (const row of stream) {
      const sportId = sportMap[row.category?.toLowerCase()] || null;
      const csvPathValue = `${row.slug}_${row.console_uid}.csv`;
      
      batch.push([
        row.console_uid,
        row.slug,
        sportId,
        row.page_name, // use page_name as name
        row.page_name, // use page_name as console_name (CSV doesn't have separate console_name)
        row.page_name, // also store as page_name
        row.url,
        csvPathValue
      ]);

      if (batch.length >= BATCH_SIZE) {
        // Deduplicate by console_uid, keeping last occurrence
        const seen = new Map();
        for (const item of batch) {
          seen.set(item[0], item); // item[0] is console_uid
        }
        const dedupedBatch = Array.from(seen.values());
        
        const result = await upsertBatch(client, dedupedBatch);
        total += dedupedBatch.length;
        inserted += result.inserted;
        updated += result.updated;
        console.log(`Processed ${total} sets... (inserted: ${inserted}, updated: ${updated}, deduped: ${batch.length - dedupedBatch.length})`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      // Deduplicate final batch
      const seen = new Map();
      for (const item of batch) {
        seen.set(item[0], item);
      }
      const dedupedBatch = Array.from(seen.values());
      
      const result = await upsertBatch(client, dedupedBatch);
      total += dedupedBatch.length;
      inserted += result.inserted;
      updated += result.updated;
    }

    console.log(`✅ Loaded ${total} sets into sets table`);
    console.log(`   New inserts: ${inserted}, Updates: ${updated}`);

  } finally {
    client.release();
    await pool.end();
  }
}

async function upsertBatch(client, batch) {
  const values = batch.map((_, i) => 
    `($${i*8+1}, $${i*8+2}, $${i*8+3}, $${i*8+4}, $${i*8+5}, $${i*8+6}, $${i*8+7}, $${i*8+8})`
  ).join(',');

  const result = await client.query(
    `WITH upsert AS (
      INSERT INTO sets (console_uid, slug, sport_id, name, console_name, page_name, url, csv_path) 
      VALUES ${values}
      ON CONFLICT (console_uid) 
      DO UPDATE SET 
        slug = EXCLUDED.slug,
        sport_id = EXCLUDED.sport_id,
        name = EXCLUDED.name,
        console_name = EXCLUDED.console_name,
        page_name = EXCLUDED.page_name,
        url = EXCLUDED.url,
        csv_path = EXCLUDED.csv_path,
        last_updated = CURRENT_TIMESTAMP
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
  console.error('Usage: node load-sets.js [basketball_sets.csv]');
  process.exit(1);
}

loadSets(csvPath);
