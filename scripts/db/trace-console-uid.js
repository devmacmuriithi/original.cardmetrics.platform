require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  const client = await pool.connect();
  try {
    const uid = 'G89762';
    
    console.log(`=== Investigating console_uid: ${uid} ===\n`);
    
    // 1. Check sets_master
    console.log('1. sets_master:');
    const setsResult = await client.query(
      'SELECT * FROM sets_master WHERE console_uid = $1',
      [uid]
    );
    if (setsResult.rows.length > 0) {
      console.log('   ✅ Found:', setsResult.rows[0]);
    } else {
      console.log('   ❌ Not found');
    }
    
    // 2. Check cards that belong to this set (if set exists)
    console.log('\n2. Cards in this set:');
    if (setsResult.rows.length > 0) {
      const setId = setsResult.rows[0].id;
      const cardsResult = await client.query(
        'SELECT id, name, number FROM cards WHERE set_id = $1 LIMIT 5',
        [setId]
      );
      if (cardsResult.rows.length > 0) {
        console.log(`   ✅ Found ${cardsResult.rows.length} cards`);
        cardsResult.rows.forEach(c => console.log(`      - ${c.name} #${c.number} (id: ${c.id})`));
      } else {
        console.log('   ❌ No cards found');
      }
    }
    
    // 3. Check raw ingests
    console.log('\n3. cards_raw_ingests:');
    const rawResult = await client.query(
      'SELECT COUNT(*) as cnt, MIN(ingest_date) as first, MAX(ingest_date) as last FROM cards_raw_ingests WHERE console_uid = $1',
      [uid]
    );
    if (rawResult.rows[0].cnt > 0) {
      console.log(`   ✅ Found: ${rawResult.rows[0].cnt} records`);
      console.log(`      First: ${rawResult.rows[0].first}, Last: ${rawResult.rows[0].last}`);
    } else {
      console.log('   ❌ No raw ingests found');
    }
    
    // 4. Check card_daily_snapshots (if data was processed)
    console.log('\n4. card_daily_snapshots:');
    const snapshotResult = await client.query(
      `SELECT COUNT(*) as cnt, MIN(date) as first, MAX(date) as last 
       FROM card_daily_snapshots 
       WHERE card_id IN (SELECT id FROM cards WHERE set_id = (SELECT id FROM sets_master WHERE console_uid = $1))`,
      [uid]
    );
    if (snapshotResult.rows[0].cnt > 0) {
      console.log(`   ✅ Found: ${snapshotResult.rows[0].cnt} snapshots`);
      console.log(`      First: ${snapshotResult.rows[0].first}, Last: ${snapshotResult.rows[0].last}`);
    } else {
      console.log('   ❌ No snapshots found');
    }
    
    // 5. Check all unique console_uids in sets_master (sample)
    console.log('\n5. Sample console_uids in sets_master:');
    const allUids = await client.query(
      "SELECT console_uid, slug FROM sets_master WHERE category ILIKE '%basketball%' LIMIT 20"
    );
    allUids.rows.forEach(r => console.log(`   ${r.console_uid}: ${r.slug}`));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
