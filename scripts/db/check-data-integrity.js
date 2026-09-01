require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const SETS_CSV = 'db/seeds/basketball_sets.csv';

const fs = require('fs');
const csv = require('csv-parser');

async function loadConsoleUids() {
  return new Promise((resolve, reject) => {
    const uids = [];
    fs.createReadStream(SETS_CSV)
      .pipe(csv())
      .on('data', (row) => { if (row.console_uid) uids.push(row.console_uid); })
      .on('end', () => resolve(uids))
      .on('error', reject);
  });
}

async function getS3DateCounts(consoleUids) {
  console.log('\n📊 Analyzing S3 files per date...\n');
  
  const dateSetCounts = new Map(); // date -> Set of console_uids
  let totalFiles = 0;
  let continuationToken = null;
  
  const uidSet = new Set(consoleUids);
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'consolidated/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken
    });
    
    const response = await s3Client.send(command);
    
    for (const obj of response.Contents || []) {
      const key = obj.Key;
      const match = key.match(/consolidated\/(\d{4}-\d{2}-\d{2})\/.*\.csv$/);
      if (match) {
        const date = match[1];
        const filename = key.split('/').pop();
        const consoleUid = filename.replace('.csv', '');
        
        if (uidSet.has(consoleUid)) {
          if (!dateSetCounts.has(date)) {
            dateSetCounts.set(date, new Set());
          }
          dateSetCounts.get(date).add(consoleUid);
          totalFiles++;
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  const sortedDates = Array.from(dateSetCounts.entries())
    .sort((a, b) => b[0].localeCompare(a[0])); // Descending
  
  console.log('┌─────────────┬─────────────┬──────────────┐');
  console.log('│ Date        │ Sets in S3  │ Expected     │');
  console.log('├─────────────┼─────────────┼──────────────┤');
  
  for (const [date, uids] of sortedDates) {
    const count = uids.size;
    const expected = consoleUids.length;
    const status = count === expected ? '✓' : count < expected ? `⚠ -${expected-count}` : `✓ +${count-expected}`;
    console.log(`│ ${date} │ ${String(count).padStart(11)} │ ${String(expected).padStart(12)} ${status} │`);
  }
  
  console.log('└─────────────┴─────────────┴──────────────┘');
  console.log(`\nTotal: ${totalFiles} files across ${sortedDates.length} dates`);
  console.log(`Expected sets per date: ${consoleUids.length}`);
  
  return sortedDates.map(([date, uids]) => ({ date, count: uids.size }));
}

async function getDbDateCounts() {
  console.log('\n📊 Database records per date:\n');
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT date, COUNT(*) as records, COUNT(DISTINCT console_uid) as unique_sets
      FROM card_daily_snapshots
      GROUP BY date
      ORDER BY date DESC
    `);
    
    console.log('┌─────────────┬─────────────┬──────────────┐');
    console.log('│ Date        │ Records     │ Unique Sets  │');
    console.log('├─────────────┼─────────────┼──────────────┤');
    
    for (const row of result.rows) {
      console.log(`│ ${row.date} │ ${String(row.records).padStart(11)} │ ${String(row.unique_sets).padStart(12)} │`);
    }
    
    console.log('└─────────────┴─────────────┴──────────────┘');
    
    return result.rows;
  } finally {
    client.release();
  }
}

async function checkAllTables() {
  console.log('\n📊 Database Table Counts:\n');
  
  const client = await pool.connect();
  try {
    // Dimension tables
    const dimensionTables = [
      { name: 'sports', label: 'Sports' },
      { name: 'leagues', label: 'Leagues' },
      { name: 'manufacturers', label: 'Manufacturers' },
      { name: 'teams', label: 'Teams' },
      { name: 'players', label: 'Players' },
      { name: 'sets', label: 'Sets' }
    ];
    
    console.log('DIMENSION TABLES:');
    console.log('─────────────────');
    for (const t of dimensionTables) {
      const result = await client.query(`SELECT COUNT(*) as c FROM ${t.name}`);
      const count = result.rows[0].c;
      const status = count > 0 ? '✓' : '⚠ Empty';
      console.log(`  ${t.label.padEnd(15)}: ${String(count).padStart(6)} ${status}`);
    }
    
    // Core tables
    console.log('\nCORE TABLES:');
    console.log('────────────');
    const coreTables = [
      { name: 'cards', label: 'Cards' },
      { name: 'cards_raw_ingests', label: 'Raw Ingests' }
    ];
    for (const t of coreTables) {
      const result = await client.query(`SELECT COUNT(*) as c FROM ${t.name}`);
      const count = result.rows[0].c;
      const status = count > 0 ? '✓' : '⚠ Empty';
      console.log(`  ${t.label.padEnd(15)}: ${String(count).padStart(6)} ${status}`);
    }
    
    // Cards denormalization check
    const cardDetails = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(player_id) as with_player_id,
        COUNT(player_name) as with_player_name,
        COUNT(player_first_name) as with_first_name,
        COUNT(manufacturer_name) as with_manufacturer,
        COUNT(set_name) as with_set_name
      FROM cards
    `);
    const cd = cardDetails.rows[0];
    console.log(`\n  Cards denormalized fields:`);
    console.log(`    Player ID:      ${cd.with_player_id}/${cd.total} (${((cd.with_player_id/cd.total)*100).toFixed(1)}%)`);
    console.log(`    Player name:    ${cd.with_player_name}/${cd.total} (${((cd.with_player_name/cd.total)*100).toFixed(1)}%)`);
    console.log(`    First name:     ${cd.with_first_name}/${cd.total} (${((cd.with_first_name/cd.total)*100).toFixed(1)}%)`);
    console.log(`    Manufacturer:   ${cd.with_manufacturer}/${cd.total} (${((cd.with_manufacturer/cd.total)*100).toFixed(1)}%)`);
    console.log(`    Set name:       ${cd.with_set_name}/${cd.total} (${((cd.with_set_name/cd.total)*100).toFixed(1)}%)`);
    
    // Data tables
    console.log('\nDATA TABLES:');
    console.log('────────────');
    const dataTables = [
      { name: 'card_daily_snapshots', label: 'Daily Snapshots' },
      { name: 'card_daily_deltas', label: 'Daily Deltas' }
    ];
    for (const t of dataTables) {
      const result = await client.query(`SELECT COUNT(*) as c FROM ${t.name}`);
      const count = result.rows[0].c;
      const status = count > 0 ? '✓' : '⚠ Empty';
      console.log(`  ${t.label.padEnd(15)}: ${String(count).padStart(6)} ${status}`);
    }
    
    // Snapshots date range
    const snapshotRange = await client.query(`
      SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(DISTINCT date) as unique_dates
      FROM card_daily_snapshots
    `);
    const sr = snapshotRange.rows[0];
    if (sr.min_date) {
      console.log(`    Date range: ${sr.min_date} to ${sr.max_date} (${sr.unique_dates} unique dates)`);
    }
    
    // Metrics tables
    console.log('\nMETRICS TABLES:');
    console.log('───────────────');
    const metricsTables = [
      { name: 'card_computed_metrics', label: 'Computed Metrics' },
      { name: 'card_analytics_daily', label: 'Analytics Daily' },
      { name: 'card_price_windows', label: 'Price Windows' },
      { name: 'card_investment_metrics_by_type', label: 'Investment by Type' },
      { name: 'card_price_spreads', label: 'Price Spreads' }
    ];
    
    for (const t of metricsTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as c FROM ${t.name}`);
        const count = result.rows[0].c;
        const status = count > 0 ? '✓' : '⚠ Empty';
        console.log(`  ${t.label.padEnd(22)}: ${String(count).padStart(6)} ${status}`);
      } catch (err) {
        console.log(`  ${t.label.padEnd(22)}: ⚠ Table not found`);
      }
    }
    
    // Data quality checks
    console.log('\nDATA QUALITY CHECKS:');
    console.log('────────────────────');
    
    // Orphan cards (no player_id)
    const orphanCards = await client.query(`
      SELECT COUNT(*) as c FROM cards WHERE player_id IS NULL
    `);
    const orphanCount = orphanCards.rows[0].c;
    if (orphanCount > 0) {
      console.log(`  ⚠ ${orphanCount} cards without player_id`);
    } else {
      console.log(`  ✓ All cards have player_id`);
    }
    
    // Cards without snapshots
    const noSnapshots = await client.query(`
      SELECT COUNT(*) as c FROM cards c 
      WHERE NOT EXISTS (SELECT 1 FROM card_daily_snapshots s WHERE s.card_id = c.id)
    `);
    const noSnapCount = noSnapshots.rows[0].c;
    if (noSnapCount > 0) {
      console.log(`  ⚠ ${noSnapCount} cards have no price data (snapshots)`);
    } else if (cd.total > 0) {
      console.log(`  ✓ All cards have price data`);
    }
    
    // Sets without cards
    const emptySets = await client.query(`
      SELECT COUNT(*) as c FROM sets s 
      WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.set_id = s.id)
    `);
    const emptySetCount = emptySets.rows[0].c;
    if (emptySetCount > 0) {
      console.log(`  ⚠ ${emptySetCount} sets have no cards`);
    } else {
      const setResult = await client.query(`SELECT COUNT(*) as c FROM sets`);
      if (setResult.rows[0].c > 0) {
        console.log(`  ✓ All sets have cards`);
      }
    }
    
    return { snapshots: sr, cards: cd };
    
  } finally {
    client.release();
  }
}

async function compareS3AndDb() {
  console.log('========================================');
  console.log('Data Integrity Check: S3 vs Database');
  console.log('========================================');
  
  const consoleUids = await loadConsoleUids();
  console.log(`Loaded ${consoleUids.length} console_uids from ${SETS_CSV}`);
  
  // S3 Analysis
  const s3Dates = await getS3DateCounts(consoleUids);
  
  // Database per-date snapshots
  await getDbDateCounts();
  
  // Database Analysis - All Tables
  const dbStats = await checkAllTables();
  
  // Summary
  console.log('\n📋 SUMMARY:');
  console.log('───────────');
  
  if (s3Dates.length === 0) {
    console.log('⚠ No S3 data found');
  } else {
    console.log(`✓ S3: ${s3Dates.length} dates available`);
  }
  
  if (dbStats.cards.total === 0) {
    console.log('⚠ DB: No cards loaded');
  } else {
    console.log(`✓ DB: ${dbStats.cards.total} cards, ${dbStats.snapshots.unique_dates} dates loaded`);
  }
  
  // Latest dates
  const latestS3 = s3Dates[0]?.date;
  const latestDb = dbStats.snapshots.max_date;
  
  console.log(`\nLatest S3 date: ${latestS3 || 'N/A'}`);
  console.log(`Latest DB date:  ${latestDb || 'N/A'}`);
  
  if (latestDb && latestS3 && latestDb < latestS3) {
    console.log(`\n👉 Behind by: ${s3Dates.findIndex(d => d.date === latestDb)} dates`);
    console.log(`👉 To resume, run:`);
    console.log(`   node scripts/ingestion/mvp-test-basketball.js --from-date=${latestDb}`);
  }
  
  await pool.end();
}

compareS3AndDb().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
