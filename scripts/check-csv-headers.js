/**
 * check-csv-headers.js - Download sample CSV and check field names
 */

require('dotenv').config();
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const csv = require('csv-parser');
const { Readable } = require('stream');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.S3_BUCKET || 'your-bucket';

async function checkCsvHeaders() {
  console.log('\n========================================');
  console.log('Checking CSV Headers in S3');
  console.log('========================================\n');
  
  // Try to find a G89762 file (the one with NULL prices)
  const dateStr = '20260101';
  const testKey = `dt=2026-01-01/G89762.csv`;
  
  console.log(`Attempting to download: ${testKey}`);
  
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: testKey
    });
    
    const response = await s3Client.send(command);
    const stream = Readable.from(response.Body);
    
    let headers = null;
    let firstRow = null;
    let rowCount = 0;
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('headers', (h) => {
          headers = h;
          console.log(`\n✅ CSV Headers found (${h.length} total):`);
          console.log('─────────────────────────────────────');
          h.forEach((header, i) => {
            console.log(`  ${i + 1}. ${header}`);
          });
        })
        .on('data', (data) => {
          rowCount++;
          if (!firstRow && rowCount === 1) {
            firstRow = data;
            console.log('\n📄 First Row Sample Data:');
            console.log('─────────────────────────────────────');
            
            // Show all fields that might be price-related
            const priceRelated = ['id', 'product', 'name', 'price', 'value', 'loose', 'graded', 'psa', 'bgs', 'retail', 'sales', 'volume', 'amount'];
            Object.entries(data).forEach(([key, val]) => {
              const isPriceRelated = priceRelated.some(p => key.toLowerCase().includes(p));
              if (isPriceRelated || val) {
                const displayVal = val ? val.toString().substring(0, 50) : '(empty)';
                console.log(`  ${key.padEnd(25)}: ${displayVal}`);
              }
            });
            
            stream.destroy();
            resolve();
          }
          if (rowCount > 10) {
            stream.destroy();
            resolve();
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', reject);
    });
    
    // Check what fields the current script expects
    console.log('\n🔍 Current Script Field Mapping (mvp-test-basketball.js):');
    console.log('─────────────────────────────────────');
    const expectedFields = {
      'id': 'card_id',
      'product-name': 'product_name',
      'console-name': 'console_name', 
      'loose-price': 'loose_price',
      'graded-price': 'graded_price',
      'manual-only-price': 'psa10_price',
      'bgs-10-price': 'bgs10_price',
      'retail-loose-buy': 'retail_loose_buy',
      'retail-loose-sell': 'retail_loose_sell',
      'sales-volume': 'sales_volume'
    };
    
    console.log('Expected CSV fields → DB fields:');
    Object.entries(expectedFields).forEach(([csv, db]) => {
      const found = headers?.includes(csv) ? '✅' : '❌';
      console.log(`  ${found} ${csv.padEnd(20)} → ${db}`);
    });
    
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    
    // Try to list available files
    console.log('\n🔍 Trying to list available files for 2026-01-01...');
    try {
      const listCmd = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: 'dt=2026-01-01/',
        MaxKeys: 10
      });
      const listResp = await s3Client.send(listCmd);
      if (listResp.Contents) {
        console.log(`Found ${listResp.Contents.length} files:`);
        listResp.Contents.forEach(f => console.log(`  - ${f.Key}`));
      }
    } catch (listErr) {
      console.error(`List error: ${listErr.message}`);
    }
  }
  
  console.log('\n========================================');
}

checkCsvHeaders().catch(err => {
  console.error(err);
  process.exit(1);
});
