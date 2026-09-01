/**
 * import-and-sync.js - Combined import and sync in one command
 * 
 * Downloads CSVs from S3 (or uses local), imports to staging (cards_raw_ingests),
 * and syncs to normalized tables (cards, card_daily_snapshots) in one operation.
 * 
 * Usage:
 *   node import-and-sync.js --date=2026-01-24                    # Import from S3 and sync
 *   node import-and-sync.js --date=2026-01-24 --local           # Import from local and sync
 *   node import-and-sync.js --date=2026-01-24 --set=G47839     # Import specific set only
 *   node import-and-sync.js --from-date=2026-01-17 --max-dates=5 # Range import and sync
 *   node import-and-sync.js --file=local.csv                    # Import single file
 * 
 * Steps:
 *   1. Fast CSV import to staging (cards_raw_ingests)
 *   2. Sync to normalized tables (cards, sets, card_daily_snapshots)
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const dateArg = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
const fromDateArg = args.find(arg => arg.startsWith('--from-date='))?.split('=')[1];
const maxDates = parseInt(args.find(arg => arg.startsWith('--max-dates='))?.split('=')[1] || '30');
const fileArg = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
const s3PathArg = args.find(arg => arg.startsWith('--s3-path='))?.split('=')[1];
const setArg = args.find(arg => arg.startsWith('--set='))?.split('=')[1];
const USE_LOCAL = args.includes('--local');
const DRY_RUN = args.includes('--dry-run');

function runCommand(cmd, description) {
  console.log(`\n${description}...`);
  console.log(`  > ${cmd}`);
  
  try {
    const result = execSync(cmd, {
      cwd: process.cwd(),
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('========================================');
  console.log('Import & Sync - Combined Workflow');
  console.log('========================================');
  
  // Validate arguments
  if (!dateArg && !fromDateArg && !fileArg && !s3PathArg) {
    console.log('\n❌ No import target specified. Usage:');
    console.log('  node import-and-sync.js --date=2026-01-24              # From S3');
    console.log('  node import-and-sync.js --date=2026-01-24 --local     # From local');
    console.log('  node import-and-sync.js --date=2026-01-24 --set=G47839 # Specific set');
    console.log('  node import-and-sync.js --from-date=2026-01-17 --max-dates=5');
    console.log('  node import-and-sync.js --file=local.csv');
    console.log('\nOptional flags:');
    console.log('  --dry-run    Preview without making changes');
    process.exit(1);
  }
  
  // Step 1: Import to staging
  console.log('\n📥 Step 1: Import to staging table');
  console.log('----------------------------------------');
  
  let importCmd = 'node scripts/ingestion/fast-csv-import.js';
  
  if (fileArg) {
    importCmd += ` --file=${fileArg}`;
  } else if (s3PathArg) {
    importCmd += ` --s3-path=${s3PathArg}`;
  } else if (dateArg) {
    importCmd += ` --date=${dateArg}`;
  } else if (fromDateArg) {
    importCmd += ` --from-date=${fromDateArg} --max-dates=${maxDates}`;
  }
  
  if (setArg) {
    importCmd += ` --set=${setArg}`;
  }
  
  if (USE_LOCAL) {
    importCmd += ' --local';
  }
  
  const importResult = runCommand(importCmd, 'Importing CSV data to staging');
  
  if (!importResult.success) {
    console.log('\n❌ Import failed - stopping');
    process.exit(1);
  }
  
  // Step 2: Sync to normalized tables
  console.log('\n🔄 Step 2: Sync to normalized tables');
  console.log('----------------------------------------');
  
  let syncCmd = 'node scripts/ingestion/sync-raw-ingests.js';
  
  if (dateArg) {
    syncCmd += ` --date=${dateArg}`;
  }
  
  if (DRY_RUN) {
    syncCmd += ' --dry-run';
  }
  
  const syncResult = runCommand(syncCmd, 'Syncing staging data to normalized tables');
  
  if (!syncResult.success) {
    console.log('\n❌ Sync failed');
    process.exit(1);
  }
  
  // Summary
  console.log('\n========================================');
  console.log('✅ Import & Sync Complete!');
  console.log('========================================');
  
  console.log('\nNext steps:');
  console.log('  1. Compute metrics:   node scripts/compute/compute-metrics.js');
  console.log('  2. Check data:        psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM card_daily_snapshots;"');
  console.log('  3. View raw ingests:  node scripts/ingestion/sync-raw-ingests.js --dry-run');
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
