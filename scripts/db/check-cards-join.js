#!/usr/bin/env node
/**
 * Check cards vs snapshots join
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trading_cards',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  
  try {
    // Check cards with card_id
    const cards = await client.query('SELECT COUNT(*) as total, COUNT(card_id) as with_card_id FROM cards');
    console.log('Cards table:');
    console.log('  Total cards:', cards.rows[0].total);
    console.log('  With card_id:', cards.rows[0].with_card_id);
    
    // Check snapshot cards matching for 2026-01-21
    const match = await client.query(`
      SELECT COUNT(*) as matching 
      FROM cards c 
      JOIN card_daily_snapshots cds ON c.card_id = cds.card_id 
      WHERE cds.date = '2026-01-21'
    `);
    console.log('\nCards matching snapshots on 2026-01-21:', match.rows[0].matching);
    
    // Sample card_id from snapshots
    const sample = await client.query("SELECT card_id FROM card_daily_snapshots WHERE date = '2026-01-21' LIMIT 5");
    console.log('\nSample card_ids from snapshots:', sample.rows.map(r => r.card_id));
    
    // Check if those card_ids exist in cards table
    const ids = sample.rows.map(r => r.card_id);
    if (ids.length > 0) {
      const exist = await client.query('SELECT COUNT(*) as cnt FROM cards WHERE card_id = ANY($1)', [ids]);
      console.log('Of those, found in cards table:', exist.rows[0].cnt);
    }
    
    // Show cards without card_id
    const noId = await client.query('SELECT COUNT(*) as cnt FROM cards WHERE card_id IS NULL');
    console.log('\nCards WITHOUT card_id:', noId.rows[0].cnt);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
