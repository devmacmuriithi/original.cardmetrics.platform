/**
 * migrate-to-normalized-schema.js - Migrate to Fully Normalized Structure
 * 
 * This script:
 * 1. Migrates sets_master → sets with proper FKs
 * 2. Parses and populates players, teams from card data
 * 3. Creates cards with full dimension references
 * 
 * Usage: node migrate-to-normalized-schema.js [--limit=100]
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 10
});

// Parse console_name to extract components
function parseConsoleName(consoleName) {
  if (!consoleName) return {};
  
  const parts = consoleName.split(' ');
  const result = { sport: null, year: null, manufacturer: null, setName: null };
  
  // Sport (first word)
  if (parts[0]) {
    const sportMap = {
      'basketball': 'basketball', 'baseball': 'baseball', 'football': 'football',
      'hockey': 'hockey', 'soccer': 'soccer', 'racing': 'racing', 'golf': 'golf'
    };
    result.sport = sportMap[parts[0].toLowerCase()];
  }
  
  // Year (4-digit number)
  for (const part of parts) {
    if (/^\d{4}$/.test(part)) {
      result.year = parseInt(part);
      break;
    }
  }
  
  // Manufacturer detection
  const manufacturers = ['Panini', 'Topps', 'Upper Deck', 'Leaf', 'Donruss', 'Bowman'];
  for (const part of parts) {
    const match = manufacturers.find(m => part.toLowerCase().includes(m.toLowerCase()));
    if (match) {
      result.manufacturer = match;
      break;
    }
  }
  
  // Set name = everything after year
  const yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
  if (yearIdx >= 0 && yearIdx < parts.length - 1) {
    result.setName = parts.slice(yearIdx + 1).join(' ');
  }
  
  return result;
}

// Parse product_name for player name
function parsePlayerName(productName) {
  if (!productName) return null;
  
  // Remove brackets and card numbers
  let clean = productName
    .replace(/\[[^\]]+\]/g, '')
    .replace(/#[A-Z]*\d+[A-Z]*/gi, '')
    .trim();
  
  return clean || null;
}

async function getOrCreatePlayer(client, fullName) {
  if (!fullName) return null;
  
  const slug = fullName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100);
  
  // Try to find existing
  const existing = await client.query(
    'SELECT id FROM players WHERE slug = $1',
    [slug]
  );
  
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  
  // Split name
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Create new
  const result = await client.query(
    `INSERT INTO players (full_name, slug, first_name, last_name) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (slug) DO UPDATE SET last_updated = CURRENT_TIMESTAMP
     RETURNING id`,
    [fullName, slug, firstName, lastName]
  );
  
  return result.rows[0].id;
}

async function getSportId(client, sportName) {
  const result = await client.query(
    'SELECT id FROM sports WHERE slug = $1',
    [sportName?.toLowerCase()]
  );
  return result.rows[0]?.id || null;
}

async function getManufacturerId(client, manufacturerName) {
  if (!manufacturerName) return null;
  
  const slug = manufacturerName.toLowerCase().replace(/\s+/g, '-');
  const result = await client.query(
    'SELECT id FROM manufacturers WHERE slug = $1',
    [slug]
  );
  return result.rows[0]?.id || null;
}

async function getLeagueId(client, sportId) {
  if (!sportId) return null;
  
  const result = await client.query(
    'SELECT id FROM leagues WHERE sport_id = $1 LIMIT 1',
    [sportId]
  );
  return result.rows[0]?.id || null;
}

async function migrateSets(client) {
  console.log('\n📦 Migrating sets_master → sets...');
  
  // Check if old table exists
  const checkOld = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'sets_master'
    )
  `);
  
  if (!checkOld.rows[0].exists) {
    console.log('  ⚠️  sets_master not found, skipping migration');
    return;
  }
  
  const oldSets = await client.query('SELECT * FROM sets_master');
  console.log(`  Found ${oldSets.rows.length} sets to migrate`);
  
  let migrated = 0;
  
  for (const oldSet of oldSets.rows) {
    try {
      const parsed = parseConsoleName(oldSet.page_name || oldSet.slug);
      
      const sportId = await getSportId(client, parsed.sport);
      const manufacturerId = await getManufacturerId(client, parsed.manufacturer);
      const leagueId = await getLeagueId(client, sportId);
      
      await client.query(`
        INSERT INTO sets (
          console_uid, slug, sport_id, league_id, manufacturer_id,
          name, year, page_name, url, csv_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (console_uid) DO UPDATE SET
          sport_id = EXCLUDED.sport_id,
          league_id = EXCLUDED.league_id,
          manufacturer_id = EXCLUDED.manufacturer_id,
          name = EXCLUDED.name,
          year = EXCLUDED.year,
          last_updated = CURRENT_TIMESTAMP
      `, [
        oldSet.console_uid,
        oldSet.slug,
        sportId,
        leagueId,
        manufacturerId,
        parsed.setName || oldSet.page_name || oldSet.slug,
        parsed.year,
        oldSet.page_name,
        oldSet.url,
        oldSet.csv_path
      ]);
      
      migrated++;
      
    } catch (err) {
      console.error(`  Error migrating set ${oldSet.console_uid}:`, err.message);
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} sets`);
}

async function migrateCards(client, limit = null) {
  console.log('\n🎴 Migrating cards with dimension keys...');
  
  let query = `
    SELECT DISTINCT 
      cmd.card_id,
      cmd.console_uid,
      cmd.console_name,
      cmd.product_name,
      MIN(cmd.date) as first_seen_date
    FROM card_market_daily cmd
    WHERE cmd.product_name IS NOT NULL
    GROUP BY cmd.card_id, cmd.console_uid, cmd.console_name, cmd.product_name
    ORDER BY cmd.card_id
  `;
  
  if (limit) {
    query += ` LIMIT ${limit}`;
  }
  
  const cards = await client.query(query);
  console.log(`  Processing ${cards.rows.length} unique cards`);
  
  let inserted = 0;
  let errors = 0;
  
  for (const card of cards.rows) {
    try {
      // Get set_id from console_uid
      const setResult = await client.query(
        'SELECT id, sport_id, league_id, manufacturer_id FROM sets WHERE console_uid = $1',
        [card.console_uid]
      );
      
      const setId = setResult.rows[0]?.id;
      if (!setId) {
        console.log(`  ⚠️  No set found for ${card.console_uid}, skipping card ${card.card_id}`);
        continue;
      }
      
      const sportId = setResult.rows[0].sport_id;
      const leagueId = setResult.rows[0].league_id;
      const manufacturerId = setResult.rows[0].manufacturer_id;
      
      // Parse player name and create/get player
      const playerName = parsePlayerName(card.product_name);
      const playerId = playerName ? await getOrCreatePlayer(client, playerName) : null;
      
      // Parse card number and variation
      const numberMatch = card.product_name?.match(/#([A-Z]*\d+[A-Z]*)/i);
      const cardNumber = numberMatch ? numberMatch[1] : null;
      
      const bracketMatch = card.product_name?.match(/\[([^\]]+)\]/);
      const variation = bracketMatch ? bracketMatch[1] : null;
      
      const isRookie = /rookie|rc/i.test(card.product_name || '');
      
      // Insert card
      await client.query(`
        INSERT INTO cards (
          id, set_id, player_id, sport_id, league_id, manufacturer_id,
          card_number, variation, rookie_card,
          raw_product_name, raw_console_name, first_seen_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          set_id = EXCLUDED.set_id,
          player_id = EXCLUDED.player_id,
          sport_id = EXCLUDED.sport_id,
          league_id = EXCLUDED.league_id,
          manufacturer_id = EXCLUDED.manufacturer_id,
          card_number = EXCLUDED.card_number,
          variation = EXCLUDED.variation,
          rookie_card = EXCLUDED.rookie_card,
          last_updated = CURRENT_TIMESTAMP
      `, [
        card.card_id,
        setId,
        playerId,
        sportId,
        leagueId,
        manufacturerId,
        cardNumber,
        variation,
        isRookie,
        card.product_name,
        card.console_name,
        card.first_seen_date
      ]);
      
      inserted++;
      
      if (inserted % 1000 === 0) {
        console.log(`  ... ${inserted} cards migrated`);
      }
      
    } catch (err) {
      errors++;
      if (errors <= 3) {
        console.error(`  Error on card ${card.card_id}:`, err.message);
      }
    }
  }
  
  console.log(`  ✅ Migrated ${inserted} cards (${errors} errors)`);
}

async function showStats(client) {
  console.log('\n📊 Migration Statistics:');
  
  const stats = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM sports) as sports,
      (SELECT COUNT(*) FROM leagues) as leagues,
      (SELECT COUNT(*) FROM manufacturers) as manufacturers,
      (SELECT COUNT(*) FROM players) as players,
      (SELECT COUNT(*) FROM teams) as teams,
      (SELECT COUNT(*) FROM sets) as sets,
      (SELECT COUNT(*) FROM cards) as cards
  `);
  
  const s = stats.rows[0];
  console.log(`  Sports: ${s.sports}`);
  console.log(`  Leagues: ${s.leagues}`);
  console.log(`  Manufacturers: ${s.manufacturers}`);
  console.log(`  Players: ${s.players}`);
  console.log(`  Teams: ${s.teams}`);
  console.log(`  Sets: ${s.sets}`);
  console.log(`  Cards: ${s.cards}`);
}

(async () => {
  console.log('========================================');
  console.log('Migrate to Normalized Schema');
  console.log('========================================');
  
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  
  const client = await pool.connect();
  
  try {
    // Verify new schema exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sets'
      )
    `);
    
    if (!checkTable.rows[0].exists) {
      console.error('\n❌ Normalized schema not found.');
      console.log('   Run: psql $DATABASE_URL -f normalized-schema.sql');
      process.exit(1);
    }
    
    await client.query('BEGIN');
    
    await migrateSets(client);
    await migrateCards(client, limit);
    
    await client.query('COMMIT');
    
    await showStats(client);
    
    console.log('\n========================================');
    console.log('✅ Migration complete!');
    console.log('========================================');
    console.log('\nQuery examples:');
    console.log('  SELECT * FROM vw_cards_enriched LIMIT 10');
    console.log('  SELECT * FROM vw_market_enriched WHERE player_name ILIKE '%LeBron%'');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
