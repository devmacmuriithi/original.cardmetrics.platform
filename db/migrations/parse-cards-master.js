/**
 * parse-cards-master.js - Parse Card Metadata from Raw Data
 * 
 * Extracts structured fields from product_name and console_name
 * Populates cards_master dimension table for analytics
 * 
 * Usage:
 *   node parse-cards-master.js              # Parse all unique cards
 *   node parse-cards-master.js --limit=100  # Parse first 100 for testing
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

// Parse console_name: "Basketball Cards 2024 Panini Prizm"
function parseConsoleName(consoleName) {
  if (!consoleName) return {};
  
  const parts = consoleName.split(' ');
  const result = {
    sport: null,
    year: null,
    manufacturer: null,
    set_name: null
  };
  
  // Extract sport (first word, normalized)
  if (parts[0]) {
    const sportMap = {
      'basketball': 'basketball',
      'baseball': 'baseball',
      'football': 'football',
      'hockey': 'hockey',
      'soccer': 'soccer'
    };
    result.sport = sportMap[parts[0].toLowerCase()] || parts[0].toLowerCase();
  }
  
  // Find year (4-digit number)
  for (const part of parts) {
    if (/^\d{4}$/.test(part)) {
      result.year = parseInt(part);
      break;
    }
  }
  
  // Known manufacturers
  const manufacturers = ['Panini', 'Topps', 'Upper Deck', 'Leaf', 'Donruss', 'Bowman', 'Chrome'];
  for (const part of parts) {
    if (manufacturers.some(m => part.toLowerCase().includes(m.toLowerCase()))) {
      result.manufacturer = part;
      break;
    }
  }
  
  // Set name = everything after year/manufacturer
  const setStartIdx = parts.findIndex(p => /^\d{4}$/.test(p));
  if (setStartIdx >= 0 && setStartIdx < parts.length - 1) {
    result.set_name = parts.slice(setStartIdx + 1).join(' ');
  }
  
  return result;
}

// Parse product_name: "AJ Johnson #251" or "LeBron James [Silver Prizm] #1"
function parseProductName(productName) {
  if (!productName) return {};
  
  const result = {
    player_name: null,
    card_number: null,
    variation: null,
    rookie_card: false
  };
  
  // Check for rookie indicators
  const rookieIndicators = ['rookie', 'rc', 'rookies'];
  result.rookie_card = rookieIndicators.some(ri => 
    productName.toLowerCase().includes(ri)
  );
  
  // Extract variation from brackets: [Silver Prizm]
  const bracketMatch = productName.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    result.variation = bracketMatch[1];
  }
  
  // Extract card number: #251 or #RC1
  const numberMatch = productName.match(/#([A-Z]*\d+[A-Z]*)/i);
  if (numberMatch) {
    result.card_number = numberMatch[1];
  }
  
  // Player name = everything before # or [ (remove trailing spaces)
  let playerPart = productName
    .replace(/\[[^\]]+\]/g, '')  // Remove brackets
    .replace(/#[A-Z]*\d+[A-Z]*/i, '')  // Remove card number
    .trim();
  
  result.player_name = playerPart || null;
  
  return result;
}

async function parseAndInsertCards(client, limit = null) {
  console.log('\n🔍 Parsing card metadata...');
  
  // Get unique cards from card_market_daily
  let query = `
    SELECT DISTINCT 
      card_id,
      console_uid,
      console_name,
      product_name,
      MIN(date) as first_seen_date
    FROM card_market_daily
    WHERE product_name IS NOT NULL
    GROUP BY card_id, console_uid, console_name, product_name
    ORDER BY card_id
  `;
  
  if (limit) {
    query += ` LIMIT ${limit}`;
  }
  
  const result = await client.query(query);
  console.log(`  Found ${result.rows.length} unique cards to parse`);
  
  let inserted = 0;
  let errors = 0;
  
  for (const row of result.rows) {
    try {
      const consoleParsed = parseConsoleName(row.console_name);
      const productParsed = parseProductName(row.product_name);
      
      // Combine into cards_master structure
      const cardData = {
        card_id: row.card_id,
        console_uid: row.console_uid,
        sport: consoleParsed.sport,
        league: inferLeague(consoleParsed.sport),
        player_name: productParsed.player_name,
        player_id: null, // Would need external lookup
        team: null, // Would need external lookup
        year: consoleParsed.year,
        set_name: consoleParsed.set_name,
        manufacturer: consoleParsed.manufacturer,
        card_number: productParsed.card_number,
        variation: productParsed.variation,
        rookie_card: productParsed.rookie_card,
        raw_product_name: row.product_name,
        raw_console_name: row.console_name,
        first_seen_date: row.first_seen_date
      };
      
      await client.query(`
        INSERT INTO cards_master (
          card_id, console_uid, sport, league, player_name, player_id, team,
          year, set_name, manufacturer, card_number, variation, rookie_card,
          raw_product_name, raw_console_name, first_seen_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (card_id) DO UPDATE SET
          sport = EXCLUDED.sport,
          league = EXCLUDED.league,
          player_name = EXCLUDED.player_name,
          year = EXCLUDED.year,
          set_name = EXCLUDED.set_name,
          manufacturer = EXCLUDED.manufacturer,
          card_number = EXCLUDED.card_number,
          variation = EXCLUDED.variation,
          rookie_card = EXCLUDED.rookie_card,
          last_updated = CURRENT_TIMESTAMP
      `, [
        cardData.card_id, cardData.console_uid, cardData.sport, cardData.league,
        cardData.player_name, cardData.player_id, cardData.team,
        cardData.year, cardData.set_name, cardData.manufacturer,
        cardData.card_number, cardData.variation, cardData.rookie_card,
        cardData.raw_product_name, cardData.raw_console_name, cardData.first_seen_date
      ]);
      
      inserted++;
      
      if (inserted % 1000 === 0) {
        console.log(`  ... ${inserted} cards parsed`);
      }
      
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error parsing card ${row.card_id}:`, err.message);
      }
    }
  }
  
  console.log(`\n✅ Parsed ${inserted} cards (${errors} errors)`);
  
  // Show sample
  const sample = await client.query(`
    SELECT card_id, player_name, sport, year, manufacturer, set_name, 
           card_number, variation, rookie_card
    FROM cards_master
    LIMIT 5
  `);
  
  console.log('\n📋 Sample parsed cards:');
  sample.rows.forEach(r => {
    console.log(`  ${r.card_id}: ${r.player_name} | ${r.year} ${r.manufacturer} ${r.set_name} #${r.card_number} ${r.rookie_card ? '(RC)' : ''}`);
  });
}

function inferLeague(sport) {
  const leagueMap = {
    'basketball': 'NBA',
    'baseball': 'MLB',
    'football': 'NFL',
    'hockey': 'NHL',
    'soccer': 'MLS'
  };
  return leagueMap[sport] || null;
}

(async () => {
  console.log('========================================');
  console.log('Parse Cards Master - Dimension Population');
  console.log('========================================');
  
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  
  const client = await pool.connect();
  
  try {
    // Check if cards_master exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'cards_master'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.error('\n❌ cards_master table does not exist.');
      console.log('   Run: psql $DATABASE_URL -f cards-master-schema.sql');
      process.exit(1);
    }
    
    await parseAndInsertCards(client, limit);
    
    console.log('\n========================================');
    console.log('✅ Card parsing complete!');
    console.log('========================================');
    console.log('\nQuery examples:');
    console.log('  SELECT * FROM cards_master WHERE rookie_card = true');
    console.log('  SELECT * FROM vw_card_market_enriched WHERE player_name ILIKE '%LeBron%'');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
