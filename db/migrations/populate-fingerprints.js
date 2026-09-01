/**
 * populate-fingerprints.js - One-time migration to generate card fingerprints
 * 
 * Generates deterministic fingerprints for all existing cards
 * Uses PostgreSQL function for consistency
 * 
 * Usage: node populate-fingerprints.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 5
});

async function populateFingerprints() {
  console.log('========================================');
  console.log('Populating Card Fingerprints');
  console.log('========================================');
  
  const client = await pool.connect();
  
  try {
    // Check if fingerprint columns exist
    const colCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cards' 
      AND column_name IN ('card_fingerprint', 'card_fingerprint_hash')
    `);
    
    if (colCheck.rows.length < 2) {
      console.log('\n⚠️  Fingerprint columns not found. Applying schema first...');
      console.log('   Run: psql $DATABASE_URL -f fingerprint-and-indices-schema.sql');
      process.exit(1);
    }
    
    // Count cards needing fingerprints
    const countResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE card_fingerprint IS NULL) as missing
      FROM cards
    `);
    
    const { total, missing } = countResult.rows[0];
    console.log(`\n📊 Total cards: ${total}`);
    console.log(`   Missing fingerprints: ${missing}`);
    
    if (missing === 0) {
      console.log('\n✅ All cards already have fingerprints!');
      return;
    }
    
    // Populate fingerprints using PostgreSQL function
    console.log('\n🔧 Generating fingerprints...');
    const result = await client.query('SELECT populate_card_fingerprints() as count');
    const updated = result.rows[0].count;
    
    console.log(`   ✅ Updated ${updated} cards`);
    
    // Show sample fingerprints
    const samples = await client.query(`
      SELECT 
        id as card_id,
        card_fingerprint,
        LEFT(card_fingerprint_hash, 16) as fingerprint_hash_preview,
        (SELECT full_name FROM players WHERE id = player_id) as player_name
      FROM cards
      WHERE card_fingerprint IS NOT NULL
      LIMIT 5
    `);
    
    console.log('\n📋 Sample fingerprints:');
    samples.rows.forEach(r => {
      console.log(`  ${r.player_name || r.card_id}:`);
      console.log(`    ${r.card_fingerprint}`);
      console.log(`    hash: ${r.fingerprint_hash_preview}...`);
    });
    
    // Verify uniqueness
    const uniqueness = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT card_fingerprint_hash) as unique_hashes
      FROM cards
      WHERE card_fingerprint IS NOT NULL
    `);
    
    const { total: totalWithFp, unique_hashes } = uniqueness.rows[0];
    const duplicates = parseInt(totalWithFp) - parseInt(unique_hashes);
    
    console.log(`\n🔍 Uniqueness check:`);
    console.log(`   Total with fingerprints: ${totalWithFp}`);
    console.log(`   Unique hashes: ${unique_hashes}`);
    
    if (duplicates > 0) {
      console.log(`   ⚠️  Duplicate fingerprints: ${duplicates}`);
      
      // Show duplicates
      const dups = await client.query(`
        SELECT card_fingerprint, COUNT(*) as count
        FROM cards
        WHERE card_fingerprint IS NOT NULL
        GROUP BY card_fingerprint
        HAVING COUNT(*) > 1
        LIMIT 3
      `);
      
      console.log('\n   Duplicate examples:');
      dups.rows.forEach(d => {
        console.log(`     "${d.card_fingerprint}" appears ${d.count} times`);
      });
    } else {
      console.log(`   ✅ All fingerprints are unique!`);
    }
    
    console.log('\n========================================');
    console.log('✅ Fingerprint population complete!');
    console.log('========================================');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

populateFingerprints();
