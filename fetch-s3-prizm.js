const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const { Readable } = require('stream');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'pricecharting-csv-production';
const CONSOLE_UID = 'G78842'; // Basketball Cards 2024 Panini Prizm

async function fetchLatestFromS3() {
  console.log(`Checking S3 bucket '${BUCKET_NAME}' for Console UID ${CONSOLE_UID}...`);

  const matchingObjects = [];
  let continuationToken = null;
  let pages = 0;

  // Scan up to 15 pages to collect files
  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));

    pages++;
    if (response.Contents) {
      for (const item of response.Contents) {
        if (item.Key.includes(CONSOLE_UID) || item.Key.includes('G78842')) {
          matchingObjects.push(item);
        }
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
    if (matchingObjects.length >= 10 || pages >= 15) {
      break;
    }
  } while (continuationToken);

  console.log(`Found ${matchingObjects.length} files matching ${CONSOLE_UID}.`);

  if (matchingObjects.length === 0) {
    console.log("No files found matching G78842.");
    return;
  }

  // Sort by LastModified descending
  matchingObjects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

  console.log("\nTop Most Recent Files in AWS S3 for 2024 Panini Prizm (G78842):");
  matchingObjects.slice(0, 5).forEach((obj, idx) => {
    console.log(`  [${idx + 1}] Key: ${obj.Key} | Last Modified: ${obj.LastModified} | Size: ${(obj.Size / 1024 / 1024).toFixed(2)} MB`);
  });

  const latest = matchingObjects[0];
  console.log(`\nDownloading latest file: ${latest.Key} ...`);

  const getRes = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: latest.Key
  }));

  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const outputFileName = path.basename(latest.Key);
  const outputPath = path.join(downloadsDir, outputFileName);
  const writeStream = fs.createWriteStream(outputPath);

  await new Promise((resolve, reject) => {
    Readable.from(getRes.Body).pipe(writeStream)
      .on('finish', resolve)
      .on('error', reject);
  });

  console.log(`\n✅ Successfully downloaded latest S3 file to:\n   ${outputPath}`);
  console.log(`   File Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
}

fetchLatestFromS3().catch(err => console.error("Error fetching from S3:", err));
