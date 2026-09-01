const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// Debug: Check if credentials loaded
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ AWS credentials not found in .env file');
  console.error('   AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Missing');
  console.error('   AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Missing');
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

async function listS3Files(date) {
  console.log(`Listing S3 files for ${date}...\n`);
  
  try {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `dt=${date}/`,
      MaxKeys: 100
    }));
    
    if (!response.Contents || response.Contents.length === 0) {
      console.log(`No files found for ${date}`);
      return;
    }
    
    console.log(`Found ${response.Contents.length} files:\n`);
    
    // Group by sport pattern
    const basketball = [];
    const baseball = [];
    const football = [];
    const hockey = [];
    const other = [];
    
    response.Contents.forEach(file => {
      const key = file.Key;
      if (key.includes('basketball')) basketball.push(key);
      else if (key.includes('baseball')) baseball.push(key);
      else if (key.includes('football')) football.push(key);
      else if (key.includes('hockey')) hockey.push(key);
      else other.push(key);
    });
    
    console.log(`Basketball: ${basketball.length} files`);
    basketball.slice(0, 5).forEach(k => console.log(`  ${k}`));
    if (basketball.length > 5) console.log(`  ... and ${basketball.length - 5} more`);
    
    console.log(`\nBaseball: ${baseball.length} files`);
    baseball.slice(0, 5).forEach(k => console.log(`  ${k}`));
    
    console.log(`\nFootball: ${football.length} files`);
    football.slice(0, 5).forEach(k => console.log(`  ${k}`));
    
    console.log(`\nHockey: ${hockey.length} files`);
    hockey.slice(0, 5).forEach(k => console.log(`  ${k}`));
    
    if (other.length > 0) {
      console.log(`\nOther: ${other.length} files`);
      other.slice(0, 5).forEach(k => console.log(`  ${k}`));
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

const date = process.argv[2] || '2026-01-24';
listS3Files(date);
