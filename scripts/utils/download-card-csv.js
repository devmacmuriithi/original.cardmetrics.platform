/**
 * download-card-csv.js - Download CSV file from S3 containing a specific card
 * 
 * Usage: node download-card-csv.js --card-id=10827676 --console-uid=G87770 --date=2026-01-23
 *        node download-card-csv.js --card-id=10827676 --console-uid=G87770 --date=2026-01-23 --download
 * 
 * Parameters:
 *   --card-id=ID       - Card ID to search for
 *   --console-uid=UID  - Console UID (set identifier)
 *   --date=YYYY-MM-DD  - Date folder to search in
 *   --preview          - Preview card details without downloading (streams from S3)
 *   --download         - Actually download the file to disk
 *   --output-dir=PATH  - Where to save downloaded file (default: ./downloads)
 */

require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Parse arguments
const args = process.argv.slice(2);
const cardIdArg = args.find(arg => arg.startsWith('--card-id='));
const consoleUidArg = args.find(arg => arg.startsWith('--console-uid='));
const dateArg = args.find(arg => arg.startsWith('--date='));
const outputDirArg = args.find(arg => arg.startsWith('--output-dir='));
const shouldDownload = args.includes('--download');
const shouldPreview = args.includes('--preview');

const CARD_ID = cardIdArg ? cardIdArg.split('=')[1] : null;
const CONSOLE_UID = consoleUidArg ? consoleUidArg.split('=')[1] : null;
const DATE = dateArg ? dateArg.split('=')[1] : null;
const OUTPUT_DIR = outputDirArg ? outputDirArg.split('=')[1] : './downloads';

if (!CONSOLE_UID || !DATE) {
  console.log(`
Usage: node download-card-csv.js --console-uid=G87770 --date=2026-01-23 [options]

Required:
  --console-uid=UID   Console UID (e.g., G87770)
  --date=YYYY-MM-DD   Date to search (e.g., 2026-01-23)

Optional:
  --card-id=ID        Specific card ID to verify in file
  --preview           Preview card details without downloading
  --download          Actually download the file to disk
  --output-dir=PATH   Download location (default: ./downloads)

Examples:
  # Preview card details without downloading
  node download-card-csv.js --card-id=10827676 --console-uid=G87770 --date=2026-01-23 --preview
  
  # Download the file
  node download-card-csv.js --console-uid=G87770 --date=2026-01-23 --download
  
  # Download and verify card exists
  node download-card-csv.js --card-id=10827676 --console-uid=G87770 --date=2026-01-23 --download
`);
  process.exit(1);
}

async function findFilesForDate() {
  const prefix = `dt=${DATE}/`;
  console.log(`🔍 Searching S3 bucket: ${BUCKET_NAME}`);
  console.log(`   Prefix: ${prefix}`);
  console.log(`   Console UID filter: ${CONSOLE_UID}`);
  if (CARD_ID) console.log(`   Card ID verification: ${CARD_ID}`);
  console.log();

  const files = [];
  let continuationToken = null;
  let pageCount = 0;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));

    pageCount++;
    
    if (response.Contents) {
      const matching = response.Contents.filter(obj => {
        if (!obj.Key.endsWith('.csv')) return false;
        return obj.Key.includes(CONSOLE_UID);
      });
      
      files.push(...matching);
      
      if (matching.length > 0) {
        console.log(`   Page ${pageCount}: Found ${matching.length} matching file(s)`);
        matching.forEach(f => console.log(`      - ${f.Key.split('/').pop()}`));
      }
    }
    
    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
  } while (continuationToken);

  console.log(`\n📊 Total matching files: ${files.length}`);
  return files;
}

async function downloadFile(key) {
  const filename = key.split('/').pop();
  const outputPath = path.join(OUTPUT_DIR, filename);
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`\n⬇️  Downloading: ${filename}`);
  console.log(`   To: ${path.resolve(outputPath)}`);

  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  }));

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  
  const buffer = Buffer.concat(chunks);
  fs.writeFileSync(outputPath, buffer);
  
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`   ✅ Downloaded ${sizeMB} MB`);
  
  return outputPath;
}

async function searchForCard(filePath) {
  console.log(`\n🔍 Searching for card ID ${CARD_ID} in downloaded file...`);
  
  return new Promise((resolve, reject) => {
    const csv = require('csv-parser');
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        if (row.id === CARD_ID || row['id'] === CARD_ID) {
          results.push(row);
        }
      })
      .on('end', () => {
        if (results.length > 0) {
          console.log(`   ✅ Found card in file!`);
          console.log(`   Card details (all columns):`);
          console.log(`   ${'='.repeat(60)}`);
          const card = results[0];
          Object.entries(card).forEach(([key, value]) => {
            const displayValue = value && value.trim() ? value : '(empty)';
            console.log(`   ${key.padEnd(25)}: ${displayValue}`);
          });
          console.log(`   ${'='.repeat(60)}`);
        } else {
          console.log(`   ⚠️  Card ID ${CARD_ID} not found in this file`);
        }
        resolve(results);
      })
      .on('error', reject);
  });
}

async function previewCardFromS3(key) {
  const filename = key.split('/').pop();
  console.log(`\n📄 Previewing: ${filename}`);
  console.log(`   Streaming from S3 (no download)...`);

  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  }));

  return new Promise((resolve, reject) => {
    const csv = require('csv-parser');
    const results = [];
    
    response.Body
      .pipe(csv())
      .on('data', (row) => {
        if (row.id === CARD_ID || row['id'] === CARD_ID) {
          results.push(row);
        }
      })
      .on('end', () => {
        if (results.length > 0) {
          console.log(`\n   ✅ Found card in file!`);
          console.log(`   Card details (all columns):`);
          console.log(`   ${'='.repeat(60)}`);
          const card = results[0];
          Object.entries(card).forEach(([key, value]) => {
            const displayValue = value && value.trim() ? value : '(empty)';
            console.log(`   ${key.padEnd(25)}: ${displayValue}`);
          });
          console.log(`   ${'='.repeat(60)}`);
        } else {
          console.log(`\n   ⚠️  Card ID ${CARD_ID} not found in this file`);
        }
        resolve(results);
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('========================================');
  console.log('Download Card CSV from S3');
  console.log('========================================\n');

  try {
    const files = await findFilesForDate();
    
    if (files.length === 0) {
      console.log('\n❌ No files found matching criteria');
      process.exit(1);
    }

    if (!shouldDownload && !shouldPreview) {
      console.log('\n💡 Use --preview to see card details without downloading, or --download to save file');
      console.log(`   Example: node ${path.basename(__filename)} --card-id=10827676 --console-uid=${CONSOLE_UID} --date=${DATE} --preview`);
      process.exit(0);
    }

    // Preview mode: stream from S3 without downloading
    if (shouldPreview && CARD_ID) {
      for (const file of files) {
        await previewCardFromS3(file.Key);
      }
      console.log('\n✅ Preview complete (no files downloaded)');
      process.exit(0);
    }

    // Download mode
    for (const file of files) {
      const filePath = await downloadFile(file.Key);
      
      if (CARD_ID) {
        await searchForCard(filePath);
      }
    }

    console.log('\n========================================');
    console.log('✅ Download complete!');
    console.log('========================================');
    console.log(`\nFiles saved to: ${path.resolve(OUTPUT_DIR)}`);
    console.log('\nNext steps:');
    console.log('  - Inspect CSV with: head -20 downloads/<filename>.csv');
    console.log('  - Load with: node scripts/ingestion/fast-csv-import.js --date=' + DATE + ' --local');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
