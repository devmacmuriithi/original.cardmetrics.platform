/**
 * populate-card-ids-from-s3.js - One-off script to populate card_id in cards table
 * 
 * Reads CSVs from S3, extracts card_id (TCGPLAYER ID) and console_uid from filename,
 * and updates the cards table.
 * 
 * Usage:
 *   node scripts/populate-card-ids-from-s3.js              # Use default date (2025-12-31)
 *   node scripts/populate-card-ids-from-s3.js 2026-01-24   # Specific date
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const readline = require('readline');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const DATE = process.argv[2] || '2025-12-31';
const S3_PREFIX = process.argv[3] || `dt=${DATE}/`;
const BATCH_SIZE = 5000;

// Parse CSV line
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Get S3 file content as stream
async function getS3FileStream(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });
  const response = await s3Client.send(command);
  return response.Body;
}

// Process single CSV file and extract card_id mappings
// console_uid comes from filename (e.g., _G1096.csv -> G1096)
// card_id comes from CSV id column
async function processCSVFile(key) {
  const mappings = new Map(); // card_id -> { card_id, console_uid, product_name }
  
  // Extract console_uid from filename (e.g., basketball-cards-1948-bowman_G1096.csv -> G1096)
  const filename = key.split('/').pop();
  const uidMatch = filename.match(/_G(\d+)\.csv$/);
  const consoleUid = uidMatch ? `G${uidMatch[1]}` : null;
  
  if (!consoleUid) {
    console.log(`   ⚠️ Could not extract console_uid from filename: ${filename}`);
    return mappings;
  }
  
  const stream = await getS3FileStream(key);
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });
  
  let headers = null;
  let rowCount = 0;
  
  for await (const line of rl) {
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    
    if (!headers) {
      headers = values;
      continue;
    }
    
    const row = {};
    headers.forEach((h, i) => row[h] = values[i]);
    
    const cardId = parseInt(row.id);
    const productName = row['product-name'];
    
    if (cardId && !isNaN(cardId)) {
      // Map card_id -> data (same console_uid for all rows in this file)
      if (!mappings.has(cardId)) {
        mappings.set(cardId, { card_id: cardId, console_uid: consoleUid, product_name: productName });
      }
    }
    
    rowCount++;
    if (rowCount % 10000 === 0) {
      process.stdout.write(`\r  Parsed ${rowCount.toLocaleString()} rows, ${mappings.size} unique card_ids`);
    }
  }
  
  console.log(`\r  Parsed ${rowCount.toLocaleString()} rows, ${mappings.size} unique card_ids (console_uid: ${consoleUid})`);
  return mappings;
}

// Update cards table with card_ids and console_uids using product_name matching
async function updateCards(mappings) {
  const client = await pool.connect();
  
  try {
    // Get basketball cards without card_id (all cards in table should be basketball based on our data)
    const { rows: cardsToUpdate } = await client.query(`
      SELECT id, raw_product_name 
      FROM cards 
      WHERE card_id IS NULL
    `);
    
    console.log(`\nFound ${cardsToUpdate.length} basketball cards without card_id`);
    
    if (cardsToUpdate.length === 0) {
      console.log('Nothing to update.');
      return 0;
    }
    
    // Build lookup by product_name
    const productNameMap = new Map();
    for (const [cardId, data] of mappings) {
      if (data.product_name) {
        productNameMap.set(data.product_name.toLowerCase().trim(), data);
      }
    }
    
    let updated = 0;
    let notFound = 0;
    
    // Update each card
    for (let i = 0; i < cardsToUpdate.length; i += BATCH_SIZE) {
      const batch = cardsToUpdate.slice(i, i + BATCH_SIZE);
      
      for (const card of batch) {
        const lookupKey = card.raw_product_name?.toLowerCase().trim();
        const mapping = lookupKey ? productNameMap.get(lookupKey) : null;
        
        if (mapping) {
          await client.query(
            'UPDATE cards SET card_id = $1, console_uid = $2 WHERE id = $3',
            [mapping.card_id, mapping.console_uid, card.id]
          );
          updated++;
        } else {
          notFound++;
        }
      }
      
      process.stdout.write(`\r  Updated: ${updated.toLocaleString()} | Not found: ${notFound.toLocaleString()}`);
    }
    
    console.log(`\n\nDone! Updated ${updated} cards, ${notFound} not found in CSVs`);
    return updated;
    
  } finally {
    client.release();
  }
}

// Main
async function main() {
  console.log(`=== Populating card_ids from S3 CSVs (date: ${DATE}) ===\n`);
  
  try {
    // List CSV files for the date
    console.log('1. Listing S3 files...');
    const prefix = S3_PREFIX;
    
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 1000
    });
    
    const listResponse = await s3Client.send(listCommand);
    
    // Get all basketball files from the date folder
    const basketballFiles = listResponse.Contents
      ?.filter(obj => obj.Key.endsWith('.csv'))
      ?.filter(obj => obj.Key.toLowerCase().includes('basketball'))
      ?.map(obj => obj.Key) || [];
    
    console.log(`   Found ${basketballFiles.length} basketball CSV files\n`);
    
    if (basketballFiles.length === 0) {
      console.log('No CSV files found. Exiting.');
      return;
    }
    
    // Process each file and collect mappings
    console.log('2. Processing CSVs to extract card_id mappings...');
    const allMappings = new Map();
    
    for (let i = 0; i < basketballFiles.length; i++) {
      const key = basketballFiles[i];
      console.log(`   [${i + 1}/${basketballFiles.length}] ${key}`);
      
      const mappings = await processCSVFile(key);
      
      // Merge into allMappings
      for (const [cardId, data] of mappings) {
        if (!allMappings.has(cardId)) {
          allMappings.set(cardId, data);
        }
      }
    }
    
    console.log(`\nTotal unique card_id -> console_uid mappings: ${allMappings.size}`);
    
    // Sample some mappings
    console.log('\nSample mappings:');
    let count = 0;
    for (const [cardId, data] of allMappings) {
      console.log(`  - card_id=${cardId}, console_uid=${data.console_uid}, product="${data.product_name?.substring(0, 50)}..."`);
      if (++count >= 5) break;
    }
    
    // Update cards table
    console.log('\n3. Checking cards table...');
    const updated = await updateCards(allMappings);
    
    console.log(`\n✅ Discovery complete! Found ${allMappings.size} card_id mappings from CSVs.`);
    console.log(`Next step: Add console_uid column to cards table, then re-run to populate card_id.`);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
