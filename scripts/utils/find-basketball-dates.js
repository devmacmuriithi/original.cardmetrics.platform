const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

if (!process.env.AWS_ACCESS_KEY_ID) {
  console.error('AWS credentials not found');
  process.exit(1);
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Get ALL files for a date (handles pagination)
async function getAllFilesForDate(date) {
  const files = [];
  let continuationToken = null;
  
  do {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: `dt=${date}/`,
      MaxKeys: 1000
    };
    if (continuationToken) params.ContinuationToken = continuationToken;
    
    const response = await s3Client.send(new ListObjectsV2Command(params));
    
    if (response.Contents) {
      files.push(...response.Contents);
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return files;
}

async function findBasketballDates() {
  console.log('Scanning S3 for basketball data...\n');
  
  // Get all date prefixes
  const response = await s3Client.send(new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Delimiter: '/',
    MaxKeys: 100
  }));
  
  const dates = [];
  if (response.CommonPrefixes) {
    for (const prefix of response.CommonPrefixes) {
      const dateMatch = prefix.Prefix.match(/dt=(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) dates.push(dateMatch[1]);
    }
  }
  // Sort newest first
  dates.sort().reverse();
  
  console.log(`Found ${dates.length} dates. Checking for basketball...\n`);
  
  // Check each date for basketball files
  const basketballDates = [];
  for (const date of dates.slice(0, 5)) { // Check last 5 dates
    const files = await getAllFilesForDate(date);
    const basketballCount = files.filter(f => f.Key.includes('basketball')).length;
    
    if (basketballCount > 0) {
      basketballDates.push({ date, basketballCount, totalCount: files.length });
      console.log(`${date}: ${basketballCount} basketball files (${files.length} total)`);
    } else {
      console.log(`${date}: 0 basketball files (${files.length} total)`);
    }
  }
  
  console.log(`\n✅ Dates with basketball data:`);
  basketballDates.forEach(d => console.log(`  ${d.date}: ${d.basketballCount} files`));
}

findBasketballDates().catch(console.error);
