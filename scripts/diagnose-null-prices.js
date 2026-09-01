/**
 * diagnose-null-prices.js - Sample records with NULL prices and trace to source CSVs
 * 
 * Usage: node scripts/diagnose-null-prices.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const csv = require('csv-parser');
const { Readable } = require('stream');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 10
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.S3_BUCKET || 'your-bucket';

async function getSampleNullPrices() {
  const client = await pool.connect();
  
  try {
    console.log('\n========================================');
    console.log('Sampling Records with NULL loose_price');
    console.log('========================================\n');
    
    // Get 12 sample records with NULL loose_price
    const result = await client.query(`
      SELECT 
        s.card_id,
        s.console_uid,
        s.date,
        s.product_name,
        s.console_name,
        s.loose_price,
        s.graded_price,
        s.psa10_price,
        s.bgs10_price,
        s.sales_volume,
        c.set_id,
        st.name as set_name
      FROM card_daily_snapshots s
      JOIN cards c ON s.card_id = c.id
      JOIN sets st ON c.set_id = st.id
      WHERE s.loose_price IS NULL
      LIMIT 12
    `);
    
    if (result.rows.length === 0) {
      console.log('No NULL loose_price records found!');
      return;
    }
    
    console.log(`Found ${result.rows.length} sample records:\n`);
    console.log('Card ID | Console UID | Date       | Set Name');
    console.log('--------|-------------|------------|----------');
    
    for (const row of result.rows) {
      const dateStr = row.date.toISOString().split('T')[0];
      console.log(`${row.card_id.toString().padStart(7)} | ${row.console_uid.padEnd(11)} | ${dateStr} | ${row.set_name}`);
    }
    
    console.log('\n========================================');
    console.log('Checking Source CSVs in S3');
    console.log('========================================\n');
    
    // For each unique date/set combination, check the CSV
    const uniqueCombinations = [...new Map(result.rows.map(r => 
      [`${r.date.toISOString().split('T')[0]}|${r.console_uid}`, r]
    )).values()];
    
    for (const row of uniqueCombinations.slice(0, 5)) { // Check first 5 unique files
      const dateStr = row.date.toISOString().split('T')[0].replace(/-/g, '');
      const csvKey = `card-data/${dateStr}/${row.console_uid}.csv`;
      
      console.log(`\n📁 Checking: ${csvKey}`);
      console.log(`   Card: ${row.product_name || 'N/A'} (ID: ${row.card_id})`);
      
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET,
          Key: csvKey
        });
        
        const response = await s3Client.send(command);
        const stream = Readable.from(response.Body);
        
        // Read first few lines to check headers
        let lineCount = 0;
        let headers = null;
        let cardRow = null;
        
        await new Promise((resolve, reject) => {
          stream
            .pipe(csv())
            .on('headers', (h) => {
              headers = h;
              console.log(`   CSV Headers (${h.length} fields):`);
              console.log(`   ${h.slice(0, 10).join(', ')}${h.length > 10 ? '...' : ''}`);
            })
            .on('data', (data) => {
              lineCount++;
              // Try to find the card by various identifiers
              if (
                data.card_id === row.card_id.toString() ||
                data.id === row.card_id.toString() ||
                data.console_uid === row.console_uid ||
                data.product_name === row.product_name
              ) {
                cardRow = data;
                console.log(`\n   ✅ FOUND CARD in CSV (row ${lineCount}):`);
                console.log(`   Price fields in CSV:`);
                const priceFields = ['loose_price', 'graded_price', 'psa10_price', 'bgs10_price', 
                  'retail_loose_buy', 'retail_loose_sell', 'sales_volume', 'price', 'value'];
                for (const f of priceFields) {
                  if (data[f] !== undefined) {
                    console.log(`     ${f}: ${data[f] || 'NULL/empty'}`);
                  }
                }
                stream.destroy();
                resolve();
              }
              
              if (lineCount > 100 && !cardRow) {
                console.log(`   ⚠️  Searched 100 rows, card not found yet...`);
              }
              
              if (lineCount > 500) {
                stream.destroy();
                resolve();
              }
            })
            .on('end', () => {
              if (!cardRow) {
                console.log(`   ❌ Card not found in first 500 rows`);
              }
              resolve();
            })
            .on('error', reject);
        });
        
      } catch (err) {
        console.log(`   ❌ Error reading CSV: ${err.message}`);
      }
    }
    
    console.log('\n========================================');
    console.log('Sales Volume Analysis');
    console.log('========================================');
    
    // Check sales_volume field
    const salesVolResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(sales_volume) as has_data,
        MIN(sales_volume) as min_val,
        MAX(sales_volume) as max_val,
        AVG(sales_volume)::numeric(10,2) as avg_val
      FROM card_daily_snapshots
    `);
    
    const sv = salesVolResult.rows[0];
    console.log(`\nSales Volume field:`);
    console.log(`  Total records: ${sv.total}`);
    console.log(`  Has data: ${sv.has_data} (${((sv.has_data/sv.total)*100).toFixed(1)}%)`);
    console.log(`  Range: ${sv.min_val} to ${sv.max_val}`);
    console.log(`  Average: ${sv.avg_val}`);
    
    // Check what field in CSV maps to sales_volume
    console.log(`\n📊 CSV fields that might be sales_volume:`);
    console.log(`  Common names: sales_volume, sales_count, transaction_count, volume, count`);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

getSampleNullPrices().catch(() => process.exit(1));
