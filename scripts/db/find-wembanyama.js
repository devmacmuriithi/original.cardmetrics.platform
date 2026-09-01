require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  const client = await pool.connect();
  try {
    const cardName = 'Victor Wembanyama';
    const cardNumber = '136';
    
    console.log(`Searching for card: ${cardName} #${cardNumber}...\n`);
    
    // 1. Find the card in cards table
    const cardsResult = await client.query(`
      SELECT c.id, c.name, c.number, c.set_id, s.name as set_name, s.year, s.console_uid
      FROM cards c
      JOIN sets s ON c.set_id = s.id
      WHERE c.name ILIKE $1 AND c.number = $2
    `, [`%${cardName}%`, cardNumber]);
    
    console.log('=== Cards Table ===');
    if (cardsResult.rows.length === 0) {
      console.log('Card not found in cards table');
    } else {
      cardsResult.rows.forEach(r => {
        console.log(`  Card ID: ${r.id}, Name: ${r.name}, #${r.number}`);
        console.log(`  Set: ${r.year} ${r.set_name} (console_uid: ${r.console_uid})`);
      });
    }
    
    // 2. Check sets_master for Prizm console_uids
    const setsResult = await client.query(`
      SELECT console_uid, slug, category, page_name
      FROM sets_master
      WHERE slug ILIKE '%prizm%' AND category ILIKE '%basketball%'
      ORDER BY slug
    `);
    
    console.log('\n=== Prizm Basketball Sets in sets_master ===');
    console.log(`  Found ${setsResult.rows.length} sets`);
    setsResult.rows.slice(0, 10).forEach(r => {
      console.log(`  ${r.console_uid}: ${r.slug} (${r.category})`);
    });
    
    // 3. Check if G78842 and G68642 exist
    const specificResult = await client.query(`
      SELECT console_uid, slug, category, page_name
      FROM sets_master
      WHERE console_uid IN ('G78842', 'G68642')
    `);
    
    console.log('\n=== Looking for G78842 and G68642 ===');
    if (specificResult.rows.length === 0) {
      console.log('  ❌ Neither console_uid found in sets_master');
      console.log('  These sets were never loaded into the database');
    } else {
      specificResult.rows.forEach(r => {
        console.log(`  ✅ Found: ${r.console_uid} - ${r.slug}`);
      });
    }
    
    // 4. Check raw ingests for any Prizm data
    const rawResult = await client.query(`
      SELECT console_uid, COUNT(*) as cnt
      FROM cards_raw_ingests
      WHERE console_uid IN (
        SELECT console_uid FROM sets_master WHERE slug ILIKE '%prizm%'
      )
      GROUP BY console_uid
      ORDER BY cnt DESC
      LIMIT 10
    `);
    
    console.log('\n=== Prizm Data in Raw Ingests ===');
    if (rawResult.rows.length === 0) {
      console.log('  No Prizm data found in raw ingests');
    } else {
      rawResult.rows.forEach(r => {
        console.log(`  ${r.console_uid}: ${r.cnt} records`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
