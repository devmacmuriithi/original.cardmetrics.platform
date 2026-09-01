#!/usr/bin/env node
/**
 * match_spc_to_gemrate.js
 * -----------------------
 * Matches cards from SportsCard Pro (SPC) CSV exports to GemRate CSV exports
 * and produces a single merged output file.
 *
 * USAGE:
 *   node match_spc_to_gemrate.js \
 *     --spc   SPC-G78842.csv \
 *     --gem   gemrate-G78842.csv \
 *     --out   matched_cards_G78842.csv
 *
 * REQUIREMENTS:
 *   npm install csv-parse csv-stringify
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// =============================================================================
// PARALLEL NAME MAPPING  (SPC label -> GemRate normalized label)
// =============================================================================
//
// The two sources name parallels differently in two ways:
//
//   1. WORD ORDER:  SPC puts type first, GemRate puts color first.
//                   e.g. SPC "Choice Blue"     -> GemRate "Blue Choice"
//                        SPC "Fast Break Blue" -> GemRate "Blue Fast Break"
//
//   2. SYNONYMS:    Some names are just different.
//                   e.g. SPC "Rookie Variation" -> GemRate "Variation"
//                        SPC "Black"            -> GemRate "Black Prizm"
//                        SPC "Lazer Gold"       -> GemRate "Gold Lazer"
//
// Keys are lowercased SPC parallel labels.
// Values are the GemRate parallel label after normalization
// (strip trailing "Prizm" and "1/1", lowercase).
//
// To extend for a new set: run the script, check the _UNMATCHED.csv log,
// and add any new parallel names here.

const PARALLEL_MAP = {
  // --- Base / Silver ---
  'base'                       : 'base',
  'silver'                     : 'silver',
  'basketball'                 : 'basketball',
  'basketball prizm'           : 'basketball',

  // --- Black variants ---
  'black'                      : 'black prizm',       // SPC drops "prizm", GemRate keeps it
  'black gold'                 : 'black gold',
  'black shimmer fotl'         : 'black shimmer fotl',
  'black white'                : 'black white',

  // --- Blue variants ---
  'blue'                       : 'blue',
  'blue ice'                   : 'blue ice',
  'blue pulsar'                : 'blue pulsar',
  'blue seismic'               : 'blue seismic',
  'blue shimmer fotl'          : 'blue shimmer fotl',
  'blue sparkle'               : 'blue sparkle',
  'wave blue'                  : 'blue wave',          // word order flip

  // --- Choice variants (SPC: "Choice X" -> GemRate: "X Choice") ---
  'choice blue'                : 'blue choice',
  'choice blue yellow green'   : 'blue yellow green choice',
  'choice cherry blossom'      : 'cherry blossom choice',
  'choice green'               : 'green choice',
  'choice nebula'              : 'nebula choice',
  'choice red'                 : 'red choice',
  'choice tiger stripe'        : 'tiger stripes choice',

  // --- Special / themed ---
  'china variation'            : 'china variation',
  'dragon year'                : 'dragon year',
  'glitter'                    : 'glitter',
  'hyper'                      : 'hyper',
  'ice'                        : 'ice',
  'lucky envelope'             : 'lucky envelopes',    // singular vs plural
  'mojo'                       : 'mojo',
  'multi wave'                 : 'multi wave',
  'premium factory set'        : 'premium factory set',
  'pulsar'                     : 'pulsar',
  'ruby wave'                  : 'ruby wave',
  'skewed'                     : 'skewed',
  'snakeskin'                  : 'snakeskin',
  'teal ice'                   : 'teal ice',
  'wave'                       : 'wave',

  // --- Fast Break variants (SPC: "Fast Break X" -> GemRate: "X Fast Break") ---
  'fast break'                 : 'fast break',
  'fast break blue'            : 'blue fast break',
  'fast break bronze'          : 'bronze fast break',
  'fast break neon green'      : 'neon green fast break',
  'fast break orange'          : 'orange fast break',
  'fast break pink'            : 'pink fast break',
  'fast break purple'          : 'purple fast break',
  'fast break red'             : 'red fast break',
  'fotl'                       : 'fast break',

  // --- Gold variants ---
  'gold'                       : 'gold',
  'gold ice'                   : 'gold ice',
  'ice gold'                   : 'gold ice',           // word order flip
  'lazer gold'                 : 'gold lazer',         // word order flip
  'wave gold'                  : 'gold wave',          // word order flip

  // --- Green variants ---
  'green'                      : 'green',
  'green ice'                  : 'green ice',
  'green pulsar'               : 'green pulsar',
  'green sparkle'              : 'green sparkle',
  'green wave'                 : 'green wave',

  // --- Orange variants ---
  'orange'                     : 'orange',
  'orange ice'                 : 'orange ice',
  'orange seismic'             : 'orange seismic',
  'wave orange'                : 'orange wave',        // word order flip

  // --- Pink variants ---
  'pink'                       : 'pink',
  'pink ice'                   : 'pink ice',
  'pink pulsar'                : 'pink pulsar',

  // --- Purple variants ---
  'purple'                     : 'purple',
  'purple ice'                 : 'purple ice',
  'purple pulsar'              : 'purple pulsar',

  // --- Red variants ---
  'red'                        : 'red',
  'red ice'                    : 'red ice',
  'red lazer'                  : 'red lazer',
  'red pulsar'                 : 'red pulsar',
  'red seismic'                : 'red seismic',
  'red sparkle'                : 'red sparkle',
  'red white blue'             : 'red white blue',

  // --- Variation ---
  'rookie variation'           : 'variation',          // SPC "Rookie Variation" = GemRate "Variation"

  // --- White variants ---
  'white'                      : 'white',
  'white ice'                  : 'white ice',
  'white lazer'                : 'white lazer',
  'white sparkle'              : 'white sparkle',
  'white tiger stripe'         : 'white tiger stripe',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize a GemRate parallel label into a clean comparable string.
 * GemRate appends "Prizm" and "1/1" to many parallel names that SPC omits.
 *
 * Examples:
 *   "Silver Prizm"     -> "silver"
 *   "Black Prizm 1/1"  -> "black prizm"
 *   "Blue Fast Break"  -> "blue fast break"
 */
function normalizeGemParallel(parallel) {
  return parallel
    .toLowerCase()
    .trim()
    .replace(/\s*prizm$/i, '')
    .replace(/\s*1\/1$/i, '')
    .trim();
}

/**
 * Parse an SPC product name into { player, parallel, cardNumber }.
 *
 * SPC product names follow this format:
 *   "Player Name [Parallel] #CardNumber"
 *   "Player Name #CardNumber"              <- no parallel = Base card
 *
 * Examples:
 *   "LeBron James [Silver] #130"  -> { player: "LeBron James", parallel: "silver", cardNumber: "130" }
 *   "Stephon Castle #234"         -> { player: "Stephon Castle", parallel: "base",  cardNumber: "234" }
 *   "Blaster Box"                 -> { player: "Blaster Box",    parallel: "base",  cardNumber: "" }
 */
function parseSpcProductName(productName) {
  const numMatch = productName.match(/#(\d+)/);
  const cardNumber = numMatch ? numMatch[1] : '';

  const parMatch = productName.match(/\[(.+?)\]/);
  const parallel = parMatch ? parMatch[1].toLowerCase().trim() : 'base';

  let player = productName
    .replace(/\s*\[.+?\]/g, '')   // remove [parallel]
    .replace(/\s*#\d+/g, '')      // remove #number
    .trim();

  return { player, parallel, cardNumber };
}

/**
 * Load the SPC CSV file.
 * Standard CSV with a single header row.
 */
function loadSpc(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

/**
 * Load the GemRate CSV file.
 * GemRate exports have a metadata row as the first line,
 * so the actual column headers are on the second line.
 */
function loadGemrate(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  const csvWithoutFirstLine = lines.slice(1).join('\n'); // skip metadata row
  return parse(csvWithoutFirstLine, { columns: true, skip_empty_lines: true });
}

// =============================================================================
// MAIN MATCHING LOGIC
// =============================================================================

/**
 * Build a Map keyed by "player|normalizedParallel|cardNumber" -> array of SPC rows.
 *
 * We store an array per key because SPC data is daily snapshots —
 * the same card appears multiple times across different dates.
 * When merging we pick the most recent snapshot.
 */
function buildSpcLookup(spcRows) {
  const lookup = new Map();

  for (const row of spcRows) {
    const { player, parallel, cardNumber } = parseSpcProductName(row['product-name']);

    // Skip non-card rows (boxes, sealed product, etc.)
    if (!cardNumber) continue;

    // Translate SPC parallel label to GemRate equivalent
    const parallelMapped = PARALLEL_MAP[parallel] ?? parallel;

    const key = `${player.toLowerCase().trim()}|${parallelMapped}|${cardNumber}`;

    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(row);
  }

  return lookup;
}

/**
 * Combine one SPC row and one GemRate row into a single merged output object.
 */
function mergeRows(spcRow, gemRow) {
  return {
    // --- Identifiers ---
    spc_id                    : spcRow['id'],
    gemrate_id                : gemRow['Gemrate_id'],
    console_name              : spcRow['console-name'],

    // --- Card identity ---
    player_name               : gemRow['Name'],
    parallel                  : gemRow['Parallel'],
    card_number               : gemRow['Card #'],
    card_description          : gemRow['Card Description'],

    // --- Pricing (SPC) ---
    loose_price               : spcRow['loose-price'],        // raw ungraded price
    graded_price              : spcRow['graded-price'],       // avg across all grades
    manual_only_price         : spcRow['manual-only-price'],  // PSA 9 price
    bgs_10_price              : spcRow['bgs-10-price'],       // PSA 10 price

    // --- Sales activity (SPC) ---
    sales_volume              : spcRow['sales-volume'],       // total sales count
    spc_date                  : spcRow['release-date'],       // snapshot date

    // --- Grading summary (GemRate) ---
    gem_rate_all_time         : gemRow['Gem Rate - All Time'],
    gem_rate_past_month       : gemRow['Gem Rate - Past Month'],
    total_graded              : gemRow['Total'],
    total_gems                : gemRow['Gems'],
    graded_past_month         : gemRow['Graded Past Month'],
    graded_prior_month        : gemRow['Graded Prior Month'],
    momentum_30d              : gemRow['30 Day Momentum'],
    last_gem_date             : gemRow['Last Gem'],
    last_graded_date          : gemRow['Last Graded'],

    // --- PSA grade % breakdown (GemRate) ---
    pct_psa_10                : gemRow['10'],
    pct_psa_9                 : gemRow['9'],
    pct_psa_8                 : gemRow['8'],
    pct_psa_7                 : gemRow['7'],
    pct_psa_6                 : gemRow['6'],
    pct_psa_5                 : gemRow['5'],
    pct_psa_4                 : gemRow['4'],
    pct_psa_3                 : gemRow['3'],

    // --- Links ---
    cardladder_all_graded_url : gemRow['All Graded Sales'],
    gemrate_url               : gemRow['Universal Pop'],
    psa_cert_url              : gemRow['Recent Cert'],
  };
}

/**
 * Run the full match: load both files, match, write outputs.
 */
function runMatch(spcPath, gemPath, outPath) {
  console.log(`Loading SPC:     ${spcPath}`);
  const spcRows = loadSpc(spcPath);
  console.log(`  -> ${spcRows.length} rows`);

  console.log(`Loading GemRate: ${gemPath}`);
  const gemRows = loadGemrate(gemPath);
  console.log(`  -> ${gemRows.length} rows`);

  // Build lookup from SPC side
  const spcLookup = buildSpcLookup(spcRows);

  const matched = [];
  const unmatched = [];

  for (const gemRow of gemRows) {
    const name   = gemRow['Name'].toLowerCase().trim();
    const par    = normalizeGemParallel(gemRow['Parallel']);
    const number = gemRow['Card #'].trim();
    const key    = `${name}|${par}|${number}`;

    if (spcLookup.has(key)) {
      // Pick the most recent SPC snapshot for this card
      const candidates = spcLookup.get(key);
      const bestSpc = candidates.sort((a, b) =>
        (b['release-date'] || '').localeCompare(a['release-date'] || '')
      )[0];
      matched.push(mergeRows(bestSpc, gemRow));
    } else {
      unmatched.push(gemRow);
    }
  }

  // Write matched output
  if (matched.length > 0) {
    const csv = stringify(matched, { header: true });
    fs.writeFileSync(outPath, csv, 'utf8');
    const pct = ((matched.length / gemRows.length) * 100).toFixed(1);
    console.log(`\nMatched: ${matched.length} rows  (${pct}%)`);
    console.log(`Written: ${outPath}`);
  }

  // Write unmatched log (for review / adding new parallel mappings)
  if (unmatched.length > 0) {
    const unmatchedPath = outPath.replace('.csv', '_UNMATCHED.csv');
    const csv = stringify(unmatched, { header: true });
    fs.writeFileSync(unmatchedPath, csv, 'utf8');
    console.log(`Unmatched: ${unmatched.length} rows -> ${unmatchedPath}`);

    // Show which parallels are causing misses
    const parCounts = {};
    for (const row of unmatched) {
      const par = normalizeGemParallel(row['Parallel']);
      parCounts[par] = (parCounts[par] || 0) + 1;
    }
    console.log('\nUnmatched parallel breakdown:');
    Object.entries(parCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([par, count]) => console.log(`  "${par}": ${count}`));
  }
}

// =============================================================================
// ENTRY POINT  —  parse --spc / --gem / --out args
// =============================================================================

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const spcPath = get('--spc');
const gemPath = get('--gem');
const outPath = get('--out');

if (!spcPath || !gemPath || !outPath) {
  console.error('Usage: node match_spc_to_gemrate.js --spc <file> --gem <file> --out <file>');
  process.exit(1);
}

runMatch(spcPath, gemPath, outPath);