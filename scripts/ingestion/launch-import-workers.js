#!/usr/bin/env node
/**
 * launch-import-workers.js - Spawn multiple parallel import workers
 * 
 * Launches N workers to process sets in parallel for faster imports.
 * Each worker claims sets atomically from the queue.
 * 
 * Usage:
 *   node launch-import-workers.js --date=2026-01-24 --sport=basketball --workers=4
 *   node launch-import-workers.js --date=2026-01-24 --workers=8 --max-sets=100
 *   node launch-import-workers.js --date=2026-01-21 --sport=basketball --workers=12 --force
 *
 * --force: Clears and reinitializes the ingestion queue before spawning workers.
 *          Use when reimporting a date that was previously imported.
 */

const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Pool } = require('pg');

const args = process.argv.slice(2);
const dateArg = args.find(arg => arg.startsWith('--date='));
const datesArg = args.find(arg => arg.startsWith('--dates='));
const fromDateArg = args.find(arg => arg.startsWith('--from-date='));
const maxDatesArg = args.find(arg => arg.startsWith('--max-dates='));
const sportArg = args.find(arg => arg.startsWith('--sport='));
const workersArg = args.find(arg => arg.startsWith('--workers='));
const maxSetsArg = args.find(arg => arg.startsWith('--max-sets='));
const dryRun = args.includes('--dry-run');
const forceReinit = args.includes('--force');

// Parse dates - support single date, comma-separated, or date range
function parseDates() {
  if (datesArg) {
    // Comma-separated dates: --dates=2026-01-24,2026-01-25,2026-01-26
    return datesArg.split('=')[1].split(',').map(d => d.trim());
  }
  if (fromDateArg && maxDatesArg) {
    // Date range: --from-date=2026-01-24 --max-dates=5
    const start = new Date(fromDateArg.split('=')[1]);
    const count = parseInt(maxDatesArg.split('=')[1]);
    const dates = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }
  // Single date (default today)
  return [dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0]];
}

const DATES = parseDates();
const TARGET_SPORT = sportArg ? sportArg.split('=')[1] : null;
const NUM_WORKERS = workersArg ? parseInt(workersArg.split('=')[1]) : 4;
const MAX_SETS_PER_WORKER = maxSetsArg ? parseInt(maxSetsArg.split('=')[1]) : null;

console.log('========================================');
console.log('Parallel Import Worker Launcher');
console.log('========================================');
console.log(`Dates: ${DATES.join(', ')}`);
if (TARGET_SPORT) console.log(`Sport: ${TARGET_SPORT}`);
console.log(`Workers: ${NUM_WORKERS}`);
if (MAX_SETS_PER_WORKER) console.log(`Max sets per worker: ${MAX_SETS_PER_WORKER}`);
if (forceReinit) console.log('🔄 Force mode: will clear & reinit queue before import');
if (dryRun) console.log('⚠️  DRY RUN MODE');
console.log('========================================\n');

const workerScript = path.join(__dirname, 'direct-import-from-s3-worker.js');
const workers = [];

async function clearAndReinitQueue() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  const client = await pool.connect();
  try {
    for (const date of DATES) {
      console.log(`[Force] Clearing queue for ${date}...`);
      const del = await client.query('DELETE FROM sets_ingestion_stats WHERE date = $1', [date]);
      console.log(`[Force]   Deleted ${del.rowCount} old queue entries`);

      const sport = TARGET_SPORT || 'basketball';
      console.log(`[Force] Initializing queue for ${sport} on ${date}...`);
      const init = await client.query('SELECT init_ingestion_queue($1, $2) as count', [date, sport]);
      console.log(`[Force]   Added ${init.rows[0].count} ${sport} sets to queue`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

function spawnWorker(workerNum) {
  const workerId = `worker-${workerNum}`;
  const workerArgs = [
    workerScript,
    `--dates=${DATES.join(',')}`,
    `--worker-id=${workerId}`
  ];
  
  if (TARGET_SPORT) workerArgs.push(`--sport=${TARGET_SPORT}`);
  if (MAX_SETS_PER_WORKER) workerArgs.push(`--max-sets=${MAX_SETS_PER_WORKER}`);
  if (dryRun) workerArgs.push('--dry-run');

  console.log(`[Launcher] Starting ${workerId}...`);
  
  const child = spawn('node', workerArgs, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('error', (err) => {
    console.error(`[Launcher] ${workerId} error:`, err.message);
  });

  child.on('exit', (code) => {
    console.log(`[Launcher] ${workerId} exited with code ${code}`);
  });

  return child;
}

// Main: optionally reinit queue, then spawn workers
async function main() {
  if (forceReinit) {
    await clearAndReinitQueue();
    console.log();
  }

  for (let i = 1; i <= NUM_WORKERS; i++) {
    workers.push(spawnWorker(i));
  }

  console.log(`\n[Launcher] All ${NUM_WORKERS} workers launched.`);
  console.log('[Launcher] Press Ctrl+C to stop all workers.\n');
}

main().catch(err => {
  console.error('[Launcher] Error:', err.message);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Launcher] Shutting down workers...');
  workers.forEach(worker => worker.kill('SIGINT'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Launcher] Shutting down workers...');
  workers.forEach(worker => worker.kill('SIGTERM'));
  process.exit(0);
});
