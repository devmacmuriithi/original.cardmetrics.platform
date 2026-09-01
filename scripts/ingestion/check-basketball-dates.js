/**
 * check-basketball-dates.js - Check which dates have basketball data in S3
 * 
 * Loads basketball_sets.csv and checks each date folder for matching files
 * 
 * Usage: node check-basketball-dates.js [--min-files=N]
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const csv = require('csv-parser');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const SETS_CSV = 'basketball_sets.csv';

// Load console_uids from basketball_sets.csv
async function loadConsoleUids() {
  return new Promise((resolve, reject) => {
    const uids = [];
    fs.createReadStream(SETS_CSV)
      .pipe(csv())
      .on('data', (row) => {
        if (row.console_uid) uids.push(row.console_uid);
      })
      .on('end', () => {
        console.log(`Loaded ${uids.length} basketball console_uids from ${SETS_CSV}\n`);
        resolve(uids);
      })
      .on('error', reject);
  });
}

// List all date folders in S3
async function listAllDates() {
  const dates = [];
  let continuationToken = null;
  
  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Delimiter: '/',
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));
    
    if (response.CommonPrefixes) {
      for (const prefix of response.CommonPrefixes) {
        const match = prefix.Prefix.match(/dt=(\d{4}-\d{2}-\d{2})/);
        if (match) {
          dates.push(match[1]);
        }
      }
    }
    
    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken);
  
  return dates.sort();
}

// Check how many basketball files exist for a specific date
async function countBasketballFiles(date, consoleUids) {
  const prefix = `dt=${date}/`;
  const files = [];
  let continuationToken = null;
  
  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key.endsWith('.csv')) continue;
        
        // Check if file matches any basketball console_uid
        const matchesBasketball = consoleUids.some(uid => obj.Key.includes(uid));
        if (matchesBasketball) {
          files.push(obj.Key);
        }
      }
    }
    
    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken);
  
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const minFilesArg = args.find(arg => arg.startsWith('--min-files='));
  const minFiles = minFilesArg ? parseInt(minFilesArg.split('=')[1]) : 1;
  
  console.log('🏀 Checking S3 for Basketball Data');
  console.log('=' .repeat(60));
  
  try {
    // Load basketball console_uids
    const consoleUids = await loadConsoleUids();
    
    // Get all dates
    console.log('📁 Listing all dates in S3...');
    const allDates = await listAllDates();
    console.log(`Found ${allDates.length} total date folders\n`);
    
    // Check each date for basketball files
    console.log('🔍 Checking each date for basketball files...\n');
    console.log('Date         | Files Found | Status');
    console.log('-'.repeat(60));
    
    const datesWithBasketball = [];
    
    for (const date of allDates) {
      const files = await countBasketballFiles(date, consoleUids);
      const status = files.length >= minFiles ? '✅' : (files.length > 0 ? '⚠️' : '❌');
      
      console.log(`${date} | ${files.length.toString().padStart(11)} | ${status}`);
      
      if (files.length >= minFiles) {
        datesWithBasketball.push({ date, fileCount: files.length });
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total dates checked: ${allDates.length}`);
    console.log(`   Dates with basketball data (≥${minFiles} files): ${datesWithBasketball.length}`);
    
    if (datesWithBasketball.length > 0) {
      console.log(`\n🏀 Dates with basketball data:`);
      datesWithBasketball.forEach(d => {
        console.log(`   ${d.date} (${d.fileCount} files)`);
      });
      
      // Show last 10 dates with data for easy copy-paste
      const last10 = datesWithBasketball.slice(-10);
      console.log(`\n📋 Last 10 dates with basketball data:`);
      console.log(last10.map(d => d.date).join(','));
      
      console.log(`\n🚀 Ready to process:`);
      console.log(`node mvp-test-basketball.js --no-cleanup --dates=${last10.map(d => d.date).join(',')}`);
    } else {
      console.log('\n⚠️  No dates found with basketball data');
    }
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
