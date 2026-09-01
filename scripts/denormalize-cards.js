const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Parse arguments
const args = process.argv.slice(2);
const sportArg = args.find(arg => arg.startsWith('--sport='));
const dateArg = args.find(arg => arg.startsWith('--date='));
const fromDateArg = args.find(arg => arg.startsWith('--from-date='));
const maxDatesArg = args.find(arg => arg.startsWith('--max-dates='));
const FORCE_MODE = args.includes('--force');

const TARGET_SPORT = sportArg ? sportArg.split('=')[1] : null;
const TARGET_DATE = dateArg ? dateArg.split('=')[1] : null;
const FROM_DATE = fromDateArg ? fromDateArg.split('=')[1] : null;
const MAX_DATES = maxDatesArg ? parseInt(maxDatesArg.split('=')[1]) : null;

async function denormalizeCards() {
  const client = await pool.connect();
  const startTime = Date.now();
  
  try {
    console.log('========================================');
    console.log('Denormalizing Card Data');
    console.log('========================================\n');
    
    // Show what we're filtering by
    if (TARGET_SPORT) console.log(`Sport filter: ${TARGET_SPORT}`);
    if (TARGET_DATE) console.log(`Date filter: ${TARGET_DATE}`);
    if (FROM_DATE && MAX_DATES) console.log(`Date range: ${FROM_DATE} to ${getDateOffset(FROM_DATE, MAX_DATES-1)}`);
    if (FORCE_MODE) console.log('⚠️  FORCE MODE: Will re-denormalize all matching cards');
    
    // Check current denormalization status
    const statusQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(player_name) as has_player_name,
        COUNT(set_name) as has_set_name
      FROM cards c
      ${TARGET_SPORT ? "JOIN sports sp ON c.sport_id = sp.id WHERE LOWER(sp.name) = LOWER($1)" : ""}
    `;
    const statusResult = await client.query(statusQuery, TARGET_SPORT ? [TARGET_SPORT] : []);
    const status = statusResult.rows[0];
    const totalCards = parseInt(status.total);
    const hasPlayerName = parseInt(status.has_player_name);
    
    console.log('\n📊 Current Status:');
    console.log(`  Total cards: ${totalCards.toLocaleString()}`);
    console.log(`  With player_name: ${hasPlayerName.toLocaleString()} (${((hasPlayerName/totalCards)*100 || 0).toFixed(1)}%)`);
    
    if (hasPlayerName === totalCards && totalCards > 0 && !FORCE_MODE) {
      console.log('\n✅ All cards already denormalized! Use --force to re-denormalize.');
      return;
    }
    
    // Check current card count (with filters)
    let countQuery = 'SELECT COUNT(*) as count FROM cards c';
    const whereConditions = [];
    const params = [];
    
    if (TARGET_SPORT) {
      countQuery += ' JOIN sports sp ON c.sport_id = sp.id';
      whereConditions.push(`LOWER(sp.name) = LOWER($${params.length + 1})`);
      params.push(TARGET_SPORT);
    }
    
    if (TARGET_DATE || FROM_DATE) {
      countQuery += ' JOIN sets s ON c.set_id = s.id';
      countQuery += ' JOIN sets_ingestion_stats sis ON s.console_uid = sis.console_uid';
      
      if (TARGET_DATE) {
        whereConditions.push(`sis.date = $${params.length + 1}`);
        params.push(TARGET_DATE);
      } else if (FROM_DATE && MAX_DATES) {
        const dates = getDateRange(FROM_DATE, MAX_DATES);
        whereConditions.push(`sis.date = ANY($${params.length + 1}::DATE[])`);
        params.push(dates);
      }
    }
    
    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    const countResult = await client.query(countQuery, params);
    const cardCount = parseInt(countResult.rows[0].count);
    console.log(`\nCards to denormalize: ${cardCount.toLocaleString()}`);
    
    if (cardCount === 0) {
      console.log('\nNo cards match the filters. Nothing to do.');
      return;
    }
    
    // Build the UPDATE query with filters
    let updateQuery = `
      UPDATE cards c
      SET 
        player_name = p.full_name,
        player_first_name = p.first_name,
        player_last_name = p.last_name,
        player_position = p.position,
        team_name = t.name,
        team_city = t.city,
        team_abbr = t.abbreviation,
        set_name = s.name,
        set_year = s.year,
        set_console_uid = s.console_uid,
        manufacturer_name = m.name,
        league_name = l.name,
        league_abbr = l.abbreviation,
        sport_name = sp.name,
        last_denormalized_at = NOW()
      FROM players p, teams t, sets s, manufacturers m, leagues l, sports sp
      WHERE c.player_id = p.id
        AND c.team_id = t.id
        AND c.set_id = s.id
        AND c.manufacturer_id = m.id
        AND c.league_id = l.id
        AND c.sport_id = sp.id
    `;
    
    // Add additional filters
    const updateFilters = [];
    let paramIdx = 0;
    
    if (TARGET_SPORT) {
      updateFilters.push(`AND LOWER(sp.name) = LOWER($${++paramIdx})`);
    }
    
    // If not forcing, only update cards missing denormalized data
    if (!FORCE_MODE) {
      updateFilters.push(`AND (c.player_name IS NULL OR c.player_name = '')`);
    }
    
    if (TARGET_DATE) {
      updateFilters.push(`AND s.console_uid IN (SELECT console_uid FROM sets_ingestion_stats WHERE date = $${++paramIdx})`);
    } else if (FROM_DATE && MAX_DATES) {
      const dates = getDateRange(FROM_DATE, MAX_DATES);
      updateFilters.push(`AND s.console_uid IN (SELECT console_uid FROM sets_ingestion_stats WHERE date = ANY($${++paramIdx}::DATE[]))`);
    }
    
    updateQuery += '\n' + updateFilters.join('\n');
    
    const updateParams = [];
    if (TARGET_SPORT) updateParams.push(TARGET_SPORT);
    if (TARGET_DATE) {
      updateParams.push(TARGET_DATE);
    } else if (FROM_DATE && MAX_DATES) {
      updateParams.push(getDateRange(FROM_DATE, MAX_DATES));
    }
    
    const result = await client.query(updateQuery, updateParams);
    const updated = result.rowCount;
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Denormalization complete!`);
    console.log(`   Updated: ${updated.toLocaleString()} cards`);
    console.log(`   Duration: ${duration}s`);
    
    // Show sample
    let sampleQuery = `
      SELECT player_name, set_name, team_name, sport_name
      FROM cards 
      WHERE player_name IS NOT NULL 
    `;
    
    if (TARGET_SPORT) {
      sampleQuery += ` AND sport_name ILIKE $1`;
    }
    
    sampleQuery += ` LIMIT 3`;
    
    const sampleResult = await client.query(sampleQuery, TARGET_SPORT ? [TARGET_SPORT] : []);
    
    if (sampleResult.rows.length > 0) {
      console.log('\nSample denormalized data:');
      sampleResult.rows.forEach((row, i) => {
        console.log(`  ${i+1}. ${row.player_name} | ${row.set_name} | ${row.team_name}`);
      });
    }
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

function getDateRange(fromDate, maxDates) {
  const dates = [];
  const start = new Date(fromDate);
  
  for (let i = 0; i < maxDates; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

function getDateOffset(fromDate, days) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Show help
if (args.includes('--help')) {
  console.log(`
Usage: node scripts/denormalize-cards.js [options]

Options:
  --sport=basketball          Only denormalize cards for specific sport
  --date=2026-01-24           Only denormalize cards imported on specific date
  --from-date=2026-01-20      Denormalize cards from date range
  --max-dates=5               Number of dates to process (used with --from-date)
  --force                     Re-denormalize even if already done
  --help                      Show this help

Examples:
  # Denormalize all cards
  node scripts/denormalize-cards.js

  # Denormalize only basketball cards
  node scripts/denormalize-cards.js --sport=basketball

  # Force re-denormalization
  node scripts/denormalize-cards.js --sport=basketball --force

  # Denormalize cards imported on Jan 24
  node scripts/denormalize-cards.js --date=2026-01-24

  # Denormalize basketball cards from Jan 20-24
  node scripts/denormalize-cards.js --sport=basketball --from-date=2026-01-20 --max-dates=5
`);
  process.exit(0);
}

denormalizeCards().catch(console.error);
