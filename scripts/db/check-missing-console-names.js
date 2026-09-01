require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    // Sets missing console_name and WHY
    console.log('Sets missing console_name - reasons:\n');
    
    // 1. Sets with no cards at all
    const { rows: noCards } = await client.query(`
      SELECT COUNT(*) 
      FROM sets s
      WHERE s.console_name IS NULL
        AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.set_id = s.id)
    `);
    console.log(`1. Sets with NO cards: ${noCards[0].count}`);
    
    // 2. Sets with cards but no raw_console_name
    const { rows: noConsoleName } = await client.query(`
      SELECT COUNT(DISTINCT s.id)
      FROM sets s
      JOIN cards c ON c.set_id = s.id
      WHERE s.console_name IS NULL
        AND c.raw_console_name IS NULL
    `);
    console.log(`2. Sets with cards but cards.raw_console_name IS NULL: ${noConsoleName[0].count}`);
    
    // 3. Sets with cards that HAVE raw_console_name (should have been updated)
    const { rows: shouldHave } = await client.query(`
      SELECT COUNT(DISTINCT s.id)
      FROM sets s
      JOIN cards c ON c.set_id = s.id
      WHERE s.console_name IS NULL
        AND c.raw_console_name IS NOT NULL
    `);
    console.log(`3. Sets still missing console_name but have cards with data: ${shouldHave[0].count}`);
    
    // Sample sets missing console_name
    console.log('\nSample sets missing console_name:');
    const { rows: samples } = await client.query(`
      SELECT s.id, s.console_uid, s.name, COUNT(c.id) as card_count
      FROM sets s
      LEFT JOIN cards c ON c.set_id = s.id
      WHERE s.console_name IS NULL
      GROUP BY s.id, s.console_uid, s.name
      LIMIT 5
    `);
    samples.forEach(s => {
      console.log(`  ${s.console_uid}: "${s.name}" (${s.card_count} cards)`);
    });
    
  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
