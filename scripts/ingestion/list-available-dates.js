/**
 * list-available-dates.js - List all available dates in S3 bucket
 * 
 * Shows which dates have CSV data organized by dt=YYYY-MM-DD folders
 * 
 * Usage: node list-available-dates.js [--limit=N]
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

async function listAvailableDates(limit = 30) {
  console.log('Checking S3 for available dates...');
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log('=' .repeat(50));
  
  const dates = new Set();
  let continuationToken = null;
  let totalPrefixes = 0;
  
  try {
    do {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Delimiter: '/',  // This gives us folder prefixes
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      }));
      
      // Extract dates from CommonPrefixes (folder names like "dt=2026-01-21/")
      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          const match = prefix.Prefix.match(/dt=(\d{4}-\d{2}-\d{2})/);
          if (match) {
            dates.add(match[1]);
            totalPrefixes++;
          }
        }
      }
      
      continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
    } while (continuationToken && dates.size < limit);
    
    // Sort dates descending (newest first)
    const sortedDates = Array.from(dates).sort().reverse();
    
    console.log(`\n📅 Found ${sortedDates.length} dates with data:\n`);
    
    sortedDates.forEach((date, index) => {
      console.log(`  ${index + 1}. ${date}`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('\nUsage examples:');
    console.log('  # Process last 10 days:');
    console.log(`  node mvp-test-basketball.js --no-cleanup --dates=${sortedDates.slice(0, 10).join(',')}`);
    console.log('\n  # Process date range:');
    console.log(`  node mvp-test-basketball.js --no-cleanup --start=${sortedDates[sortedDates.length - 1]} --end=${sortedDates[0]}`);
    
  } catch (err) {
    console.error('❌ Error listing dates:', err.message);
    process.exit(1);
  }
}

// Parse limit from args
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;

listAvailableDates(limit);
