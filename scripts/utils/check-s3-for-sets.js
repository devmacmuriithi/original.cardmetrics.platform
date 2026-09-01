require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'sportscards-pricecrawler';
const PREFIX = 'card-data/basketball/';

async function findConsoleUidsInS3() {
  const targetUids = process.argv.slice(2).length > 0 
  ? process.argv.slice(2)
  : ['G78842', 'G68642'];
  
if (targetUids.length === 0) {
  console.log('Usage: node check-s3-for-sets.js [console_uid1] [console_uid2] ...');
  console.log('Example: node check-s3-for-sets.js G89762');
  process.exit(1);
}
  
  console.log('Scanning S3 for console_uids:', targetUids.join(', '));
  console.log(`Bucket: ${BUCKET_NAME}, Prefix: ${PREFIX}\n`);
  
  try {
    // List all objects in the basketball folder
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: PREFIX,
      MaxKeys: 1000
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      console.log('No files found in S3');
      return;
    }
    
    console.log(`Found ${response.Contents.length} total files\n`);
    
    // Filter for CSV files and check for console_uids in filenames
    const csvFiles = response.Contents.filter(o => o.Key.endsWith('.csv'));
    
    console.log(`CSV files: ${csvFiles.length}\n`);
    
    const matches = [];
    
    for (const file of csvFiles) {
      const filename = file.Key.split('/').pop();
      
      // Check if filename contains any target console_uid
      for (const uid of targetUids) {
        if (filename.includes(uid)) {
          matches.push({
            uid: uid,
            filename: filename,
            fullPath: file.Key,
            lastModified: file.LastModified,
            size: file.Size
          });
        }
      }
    }
    
    if (matches.length === 0) {
      console.log('❌ No CSV files found containing G78842 or G68642');
      console.log('\nPossible reasons:');
      console.log('  1. These sets were never crawled from PriceCharting');
      console.log('  2. The files are in a different S3 folder');
      console.log('  3. The console_uid values are different in the actual filenames');
    } else {
      console.log('✅ Found matching CSV files:\n');
      
      for (const uid of targetUids) {
        const uidMatches = matches.filter(m => m.uid === uid);
        if (uidMatches.length > 0) {
          console.log(`\n${uid}:`);
          uidMatches.forEach(m => {
            console.log(`  ${m.filename}`);
            console.log(`    Path: ${m.fullPath}`);
            console.log(`    Modified: ${m.lastModified}`);
            console.log(`    Size: ${(m.size / 1024).toFixed(1)} KB`);
          });
        } else {
          console.log(`\n❌ ${uid}: Not found in any CSV filename`);
        }
      }
    }
    
    // Also show sample of what console_uids DO exist
    console.log('\n\n=== Sample of existing console_uids in S3 ===');
    const allUids = new Set();
    for (const file of csvFiles.slice(0, 100)) {
      const filename = file.Key.split('/').pop();
      // Extract console_uid from pattern: {slug}_{console_uid}.csv
      const match = filename.match(/_([A-Z]\d+)\.csv$/);
      if (match) {
        allUids.add(match[1]);
      }
    }
    
    console.log(`Sample console_uids found: ${Array.from(allUids).slice(0, 20).join(', ')}...`);
    
  } catch (err) {
    console.error('S3 Error:', err.message);
  }
}

findConsoleUidsInS3();
