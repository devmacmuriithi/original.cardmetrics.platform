#!/usr/bin/env node
/**
 * Backfill graded prices and volume in card_computed_metrics
 * from card_daily_snapshots
 * 
 * Usage: node scripts/db/backfill-graded-prices.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function backfill() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('Backfill Graded Prices & Volume');
    console.log('========================================\n');
    
    // Check current state
    const { rows: [before] } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(graded_price) as with_graded,
        COUNT(psa10_price) as with_psa10,
        COUNT(bgs10_price) as with_bgs10,
        COUNT(sales_volume) as with_volume
      FROM card_computed_metrics
    `);
    
    console.log('Before backfill:');
    console.log(`  Total rows: ${before.total}`);
    console.log(`  With graded_price: ${before.with_graded}`);
    console.log(`  With psa10_price: ${before.with_psa10}`);
    console.log(`  With bgs10_price: ${before.with_bgs10}`);
    console.log(`  With sales_volume: ${before.with_volume}\n`);
    
    console.log('Updating from card_daily_snapshots in batches...');
    const startTime = Date.now();
    
    // Process in batches to avoid timeout on large datasets
    let totalUpdated = 0;
    let batchNum = 0;
    const BATCH_SIZE = 50000;
    
    while (true) {
      const result = await client.query(`
        WITH batch AS (
          SELECT ccm.card_id, ccm.date
          FROM card_computed_metrics ccm
          WHERE ccm.graded_price IS NULL 
             OR ccm.psa10_price IS NULL 
             OR ccm.bgs10_price IS NULL 
             OR ccm.sales_volume IS NULL
          LIMIT $1
        )
        UPDATE card_computed_metrics ccm
        SET 
          graded_price = cds.graded_price,
          psa10_price = cds.psa10_price,
          bgs10_price = cds.bgs10_price,
          sales_volume = cds.sales_volume
        FROM card_daily_snapshots cds
        INNER JOIN batch b ON cds.card_id = b.card_id AND cds.date = b.date
        WHERE ccm.card_id = b.card_id
          AND ccm.date = b.date
      `, [BATCH_SIZE]);
      
      totalUpdated += result.rowCount;
      batchNum++;
      
      if (result.rowCount === 0) break;
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Batch ${batchNum}: ${result.rowCount.toLocaleString()} rows (${totalUpdated.toLocaleString()} total, ${elapsed}s elapsed)`);
      
      if (result.rowCount < BATCH_SIZE) break;
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Updated ${totalUpdated.toLocaleString()} rows in ${duration}s\n`);
    
    // Check after state
    const { rows: [after] } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(graded_price) as with_graded,
        COUNT(psa10_price) as with_psa10,
        COUNT(bgs10_price) as with_bgs10,
        COUNT(sales_volume) as with_volume
      FROM card_computed_metrics
    `);
    
    console.log('After backfill:');
    console.log(`  Total rows: ${after.total}`);
    console.log(`  With graded_price: ${after.with_graded} (+${after.with_graded - before.with_graded})`);
    console.log(`  With psa10_price: ${after.with_psa10} (+${after.with_psa10 - before.with_psa10})`);
    console.log(`  With bgs10_price: ${after.with_bgs10} (+${after.with_bgs10 - before.with_bgs10})`);
    console.log(`  With sales_volume: ${after.with_volume} (+${after.with_volume - before.with_volume})\n`);
    
    // Show sample
    console.log('Sample updated rows:');
    const { rows: samples } = await client.query(`
      SELECT card_id, date, loose_price, graded_price, psa10_price, sales_volume
      FROM card_computed_metrics
      WHERE graded_price IS NOT NULL OR psa10_price IS NOT NULL
      ORDER BY date DESC
      LIMIT 5
    `);
    samples.forEach(s => {
      console.log(`  Card ${s.card_id} (${s.date}): loose=$${s.loose_price}, graded=$${s.graded_price}, psa10=$${s.psa10_price}, vol=${s.sales_volume}`);
    });
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill();
