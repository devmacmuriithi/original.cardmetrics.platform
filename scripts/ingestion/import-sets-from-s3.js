/**
 * import-sets-from-s3.js - Loop through sets table and import CSVs from S3
 * 
 * Usage: node import-sets-from-s3.js [start_date] [end_date]
 * Example: node import-sets-from-s3.js 2025-12-29 2026-01-25
 */

require('dotenv').config();
const { Pool } = require('pg');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'pricecharting-csv-production';
const PREFIX = 'card-data/basketball/';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Parse command line args
const START_DATE = process.argv[2] || '2025-12-29';
const END_DATE = process.argv[3] || '2026-01-25';

// Generate date range
function getDateRange(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Get all sets from database
async function getAllSets(client) {
  const result = await client.query(`
    SELECT console_uid, slug, csv_path, name
    FROM sets
    WHERE sport_id = (SELECT id FROM sports WHERE slug = 'basketball')
    ORDER BY console_uid
  `);
  return result.rows;
}

// Download and parse single CSV from S3
async function downloadAndParseCSV(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    const response = await s3Client.send(command);
    const stream = response.Body;
    
    const rows = [];
    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      return null; // File doesn't exist
    }
    throw err;
  }
}

// Import rows to cards_raw_ingests
async function importToDatabase(client, date, consoleUid, rows) {
  if (!rows || rows.length === 0) return 0;
  
  const batch = [];
  for (const row of rows) {
    const cardId = row['Card ID'] || row.card_id;
    if (!cardId) continue;
    
    batch.push([
      date,
      consoleUid,
      parseInt(cardId),
      JSON.stringify(row)
    ]);
  }
  
  if (batch.length === 0) return 0;
  
  // Insert in chunks of 500
  const CHUNK_SIZE = 500;
  let inserted = 0;
  
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const chunk = batch.slice(i, i + CHUNK_SIZE);
    const values = chunk.map((_, j) => 
      `($${j*4+1}, $${j*4+2}, $${j*4+3}, $${j*4+4})`
    ).join(',');
    
    await client.query(
      `INSERT INTO cards_raw_ingests (ingest_date, console_uid, card_id, payload)
       VALUES ${values}
       ON CONFLICT (ingest_date, console_uid, card_id) 
       DO UPDATE SET payload = EXCLUDED.payload, filename = EXCLUDED.filename`,
      chunk.flat()
    );
    
    inserted += chunk.length;
  }
  
  return inserted;
}

// Main function
async function main() {
  const client = await pool.connect();
  const dates = getDateRange(START_DATE, END_DATE);
  
  try {
    console.log('========================================');
    console.log('Import Sets from S3');
    console.log('========================================');
    console.log(`Date range: ${START_DATE} to ${END_DATE} (${dates.length} days)`);
    
    // Get all sets
    const sets = await getAllSets(client);
    console.log(`Found ${sets.length} basketball sets in database\n`);
    
    let totalSetsProcessed = 0;
    let totalRowsImported = 0;
    let setsWithNoData = 0;
    
    // Loop through each set
    for (const set of sets) {
      totalSetsProcessed++;
      let setRowsImported = 0;
      
      console.log(`[${totalSetsProcessed}/${sets.length}] ${set.console_uid}: ${set.name}`);
      
      // Loop through each date
      for (const date of dates) {
        const s3Key = `${PREFIX}${date}/${set.csv_path}`;
        
        try {
          const rows = await downloadAndParseCSV(s3Key);
          
          if (rows) {
            const imported = await importToDatabase(client, date, set.console_uid, rows);
            setRowsImported += imported;
          }
        } catch (err) {
          // No file for this date/set combination
        }
      }
      
      if (setRowsImported > 0) {
        totalRowsImported += setRowsImported;
        console.log(`  ✅ Imported ${setRowsImported} rows`);
      } else {
        setsWithNoData++;
        console.log(`  ⚠️  No data found in S3`);
      }
      
      // Progress update every 100 sets
      if (totalSetsProcessed % 100 === 0) {
        console.log(`\n--- Progress: ${totalSetsProcessed}/${sets.length} sets ---`);
        console.log(`Total rows imported so far: ${totalRowsImported}`);
        console.log(`Sets with no data: ${setsWithNoData}\n`);
      }
    }
    
    console.log('\n========================================');
    console.log('Import Complete!');
    console.log('========================================');
    console.log(`Sets processed: ${totalSetsProcessed}`);
    console.log(`Total rows imported: ${totalRowsImported}`);
    console.log(`Sets with no S3 data: ${setsWithNoData}`);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
