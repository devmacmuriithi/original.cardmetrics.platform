# Milestone 2: COPY-Based Bulk Ingestion

Implements the **Collection-Sets-Documentation.md** specification with COPY bulk load instead of row-by-row inserts.

## Project Structure

```
milestone2/
├── .env               # Environment variables (root level)
├── .env.example       # Environment template
├── docs/              # Documentation
├── config/            # Configuration (fingerprint-rules.js)
├── db/
│   ├── schemas/       # SQL schema files
│   ├── migrations/    # Data migration scripts
│   └── seeds/         # Seed data
├── scripts/
│   ├── db/            # Database management
│   ├── ingestion/     # Data ingestion
│   ├── compute/       # Metrics computation
│   └── utils/         # Utility scripts
├── src/               # Future API code (placeholder)
└── tests/             # Tests (placeholder)
```

## Quick Start

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your credentials

# 2. Setup schema
node scripts/db/create-schema.js

# 3. Load sets master (dimension table)
node scripts/db/load-sets-master.js db/seeds/basketball_sets.csv

# 4. MVP Test (Basketball G78842, 2 days)
node scripts/ingestion/mvp-test-basketball.js

# 5. Full ingest (example: 10 days)
node scripts/ingestion/merge-csvs.js 2026-01-21 2026-01-30
node scripts/ingestion/copy-bulk-loader.js 2026-01-21 2026-01-30
node scripts/db/maintenance.js all
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  S3 CSV Files   │────▶│  merge-csvs.js   │────▶│  YYYY-MM-DD_     │
│  (33,500/day)   │     │  (1 file/day)    │     │  snapshot.csv    │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  card_market_   │◀────│  JSON Extract    │◀────│  COPY to raw   │
│  daily (silver) │     │  (Step 3)        │     │  (Step 2)      │
└─────────────────┘     └──────────────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│  card_market_   │  ◀── Window functions for deltas
│  diff (gold)    │
└─────────────────┘
```

## File Reference

| File | Purpose |
|------|---------|
| `db/schemas/*.sql` | Bronze/Silver/Gold tables and views |
| `scripts/db/load-sets-master.js` | Load sets.csv dimension table |
| `scripts/ingestion/merge-csvs.js` | Step 1: Merge 33,500 CSVs → 1 snapshot file |
| `scripts/ingestion/copy-bulk-loader.js` | Step 2 & 3: Sequential COPY + JSON extract |
| `scripts/ingestion/copy-bulk-loader-workers.js` | Step 2 & 3: Parallel workers version |
| `scripts/db/maintenance.js` | Step 4: VACUUM ANALYZE |
| `scripts/ingestion/mvp-test-basketball.js` | MVP validation with G78842 |

## Key Design Decisions

### 1. UNLOGGED raw table
`cards_raw_ingests` is UNLOGGED for speed. Data can be reloaded if needed.

### 2. COPY not INSERT
COPY is 10-100x faster than row-by-row INSERT. Fallback to batch INSERT if COPY unavailable.

### 3. JSON payload in raw
Preserves all CSV fields without schema changes. Extract specific fields to typed columns.

### 4. Window functions for diff
`card_market_diff` is a VIEW using `LAG()` for yesterday comparisons. No pre-calculation needed.

## Column Mapping

```
CSV Field                    →  Table Column
─────────────────────────────────────────────
loose-price                  →  loose_price
graded-price                 →  graded_price
manual-only-price            →  psa10_price
bgs-10-price                 →  bgs10_price
retail-loose-buy             →  retail_loose_buy
retail-loose-sell            →  retail_loose_sell
sales-volume                 →  sales_volume
```

## Parallel Workers

For 3x speedup, run in 3 terminals:

```bash
# Terminal 1
node scripts/ingestion/copy-bulk-loader-workers.js 2026-01-24 2026-01-24 0 3

# Terminal 2
node scripts/ingestion/copy-bulk-loader-workers.js 2026-01-24 2026-01-24 1 3

# Terminal 3
node scripts/ingestion/copy-bulk-loader-workers.js 2026-01-24 2026-01-24 2 3
```

Each worker gets ~1/3 of files. PostgreSQL handles UPSERT conflicts.

## Environment Variables

Place in `config/.env`:

```bash
DATABASE_URL=postgresql://...
S3_BUCKET_NAME=your-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
TEMP_DIR=./temp  # Where merged CSVs are stored
```

## Disk Space

- Merged CSV: ~1-2GB per day
- PostgreSQL: ~2-3GB per day
- **Clean up after load**: `rm ./temp/*_snapshot.csv`

## Validation Queries

```sql
-- Check sets loaded
SELECT category, COUNT(*) FROM sets_master GROUP BY category;

-- Check daily data
SELECT date, COUNT(*) FROM card_market_daily GROUP BY date ORDER BY date;

-- Check diff calculations
SELECT * FROM card_market_diff 
WHERE console_uid = 'G78842' 
LIMIT 10;

-- Top movers
SELECT card_id, date, loose_price_diff
FROM card_market_diff
WHERE loose_price_diff > 50
ORDER BY loose_price_diff DESC
LIMIT 10;
```

## Troubleshooting

**Max connections reached**
→ Reduce `max` in pool config (default: 5 for workers)

**Out of disk space**
→ Clean temp files: `rm ./temp/*.csv`

**COPY fails**
→ Falls back to batch INSERT automatically

**Worker collision**
→ Workers partition by file index, PostgreSQL UPSERT handles conflicts
