# Command Reference

Complete list of commands for the Cards Analytics Platform (Milestone 2).

## Quick Start

```powershell
# 1. Setup environment
cp .env.example .env
# Edit .env with your database credentials

# 2. Install dependencies
npm install

# 3. Create all schemas (3 files: tables, metrics, views)
node scripts/db/create-schema.js

# 4. Load sets master list (one-time setup - only needed when sets change)
node scripts/db/load-sets.js "full_list_sportscardspro_full_1231.csv"
# Note: This only needs to be run once. Uses upsert mode - existing sets updated, new ones added.
# No need to reload each time unless you're adding new sets to track.

# 5. Load data (parallel workers - fastest)
node scripts/ingestion/launch-import-workers.js --date=2026-01-24 --sport=basketball --workers=4

# Reimport a date (clears queue first, use --force)
node scripts/ingestion/launch-import-workers.js --date=2026-01-15 --sport=basketball --workers=9 --force

# Or use single worker/direct import
node scripts/ingestion/direct-import-from-s3.js --sport=basketball --from-date=2026-01-24 --max-dates=5

# 6. Denormalize card data (run ONCE after all imports complete)
# This copies player/team/set names into cards table for fast queries
node scripts/denormalize-cards.js                                    # All cards
node scripts/denormalize-cards.js --sport=basketball                  # Basketball only
node scripts/denormalize-cards.js --date=2026-01-24                   # Specific import date
node scripts/denormalize-cards.js --from-date=2026-01-20 --max-dates=5  # Date range

# 7. Compute daily price deltas (yesterday/today/diff for all price fields)
node scripts/compute/compute-daily-deltas.js              # All dates
node scripts/compute/compute-daily-deltas.js --date=2026-01-24   # Specific date only

# 7. Compute investment metrics (high_7d, price ranges, trend signals)
node scripts/compute/compute-metrics.js --date=2026-01-24        # Specific date (recommended)
node scripts/compute/compute-metrics-resilient.js 2026-01-24     # Large datasets (1M+ cards)
node scripts/compute/compute-metrics.js                          # All dates (may timeout on large data)

# 8. Compute rolling price windows (3D/7D/14D/30D/60D/90D on card_daily_snapshots)
node scripts/compute/compute-price-windows.js              # All dates
node scripts/compute/compute-price-windows.js --date=2026-01-24   # Specific date
node scripts/compute/compute-price-windows.js --force              # Recompute already-done rows
```

---

## Table Architecture

### Data Flow & Separation of Concerns

| Table | Purpose | Data Type |
|-------|---------|-----------|
| `card_daily_snapshots` | **Raw source data + rolling windows** from CSV imports | Original price fields + computed rolling averages (3d/7d/14d/30d/60d/90d) and % changes |
| `card_daily_deltas` | **Day-to-day price changes** | yesterday/today/diff for all price fields + denormalized reference fields for quick views |
| `card_computed_metrics` | **Investment analytics** | High/low price ranges (7d/15d/30d), price position, trend state, price change % |

### Schema Files

| File | Tables/Objects Created |
|------|----------------------|
| `db/schemas/01-base-schema.sql` | sports, leagues, teams, players, manufacturers |
| `db/schemas/03-core-schema.sql` | card_daily_snapshots, card_computed_metrics, views |
| `db/schemas/12-card-daily-deltas.sql` | **card_daily_deltas** - yesterday/today/diff for all price fields |
| `db/schemas/11-reporting-views.sql` | Metabase reporting views |

---

### Create Tables
```powershell
node scripts/db/create-schema.js
```
Creates: sports, leagues, manufacturers, teams, players, sets, cards, card_types, variations, card_attributes, card_grades, grading_companies, card_daily_snapshots, card_computed_metrics, market_indices, market_index_constituents, market_index_values, alx_signal_config, alx_market_signals_daily

### Create Views
```powershell
node scripts/db/create-views.js
```
Creates: vw_rolloff_alerts, vw_execution_eligible, vw_liquidity_distribution, vw_signals_summary, vw_market_enriched, vw_cards_full, vw_cards_enriched, vw_card_complete, vw_card_metrics_current, vw_index_comparison, vw_index_composition, vw_index_performance

### Drop Tables
```powershell
node scripts/db/drop-schema.js          # With confirmation
node scripts/db/drop-schema.js --force  # Skip confirmation
```

### Drop Views
```powershell
node scripts/db/drop-views.js          # With confirmation
node scripts/db/drop-views.js --force    # Skip confirmation
```

```powershell
# Run all maintenance tasks
node scripts/db/maintenance.js all

# Specific maintenance tasks
node scripts/db/maintenance.js analyze
node scripts/db/maintenance.js vacuum
node scripts/db/maintenance.js index-stats
node scripts/db/maintenance.js table-sizes
```

---

### Staging Table Import (Recommended)

Fast import using staging table workflow - imports to `cards_raw_ingests` then syncs to normalized tables.

```powershell
# Import from S3 (default)
node scripts/ingestion/fast-csv-import.js --date=2026-01-24

# Import from local downloads
node scripts/ingestion/fast-csv-import.js --date=2026-01-24 --local

# Import specific date range
node scripts/ingestion/fast-csv-import.js --from-date=2026-01-17 --max-dates=5

# Import specific set only
node scripts/ingestion/fast-csv-import.js --date=2026-01-24 --set=G47839

# Import specific sport only (basketball, baseball, etc.)
node scripts/ingestion/fast-csv-import.js --date=2026-01-24 --sport=basketball

# Import single local file
node scripts/ingestion/fast-csv-import.js --file=path/to/file.csv

# Import from S3 folder
node scripts/ingestion/fast-csv-import.js --s3-path=dt=2026-01-24/
```

**Parameters:**
- `--date=YYYY-MM-DD` - Process specific date
- `--from-date=YYYY-MM-DD` - Start date for range import (goes backward)
- `--max-dates=N` - Limit number of dates to import
- `--set=CONSOLE_UID` - Import specific set only (e.g., G47839)
- `--sport=SPORT` - Import specific sport (basketball, baseball, football, hockey)
- `--local` - Use local files instead of S3
- `--file=PATH` - Import single CSV file
- `--s3-path=PATH` - Import from specific S3 path

### Sync Staging to Normalized Tables

```powershell
# Sync all pending raw ingests
node scripts/ingestion/sync-raw-ingests.js

# Sync specific date only
node scripts/ingestion/sync-raw-ingests.js --date=2026-01-24

# Preview sync (dry run)
node scripts/ingestion/sync-raw-ingests.js --dry-run

# Sync limited batch
node scripts/ingestion/sync-raw-ingests.js --limit=1000
```

### Combined Import + Sync (One Command)

```powershell
# Import from S3 and sync in one command
node scripts/ingestion/import-and-sync.js --date=2026-01-24

# Import from local and sync
node scripts/ingestion/import-and-sync.js --date=2026-01-24 --local

# Import basketball only and sync
node scripts/ingestion/import-and-sync.js --date=2026-01-24 --sport=basketball

# Import specific set and sync
node scripts/ingestion/import-and-sync.js --date=2026-01-24 --set=G47839

# Preview without making changes
node scripts/ingestion/import-and-sync.js --date=2026-01-24 --dry-run
```

### Full Pipeline (Download + Import + Sync)

```powershell
# 1. Download from S3 to local
node downloader/mvp-s3-download.js --date=2026-01-24

# 2. Import from local to staging + sync
node scripts/ingestion/import-and-sync.js --date=2026-01-24 --local
```

---

### Run SQL Schema Files
```powershell
# Run any SQL schema file
node scripts/db/run-sql-schema.js db/schemas/02-normalized-schema.sql
node scripts/db/run-sql-schema.js db/schemas/11-reporting-views.sql
```

---

## Data Ingestion

### Parallel S3 Import (Recommended for Production)

Fastest import using multiple parallel workers. Each worker claims sets atomically from queue.

**Prerequisites - apply tracking schema first:**
```powershell
node scripts/db/apply-schema.js db/schemas/20-ingestion-tracking.sql
```

**Launch parallel workers:**
```powershell
# Import all sets for single date with 4 workers
node scripts/ingestion/launch-import-workers.js --date=2026-01-24 --workers=4

# Import specific sport with parallel workers
node scripts/ingestion/launch-import-workers.js --sport=basketball --date=2026-01-24 --workers=8

# Import date range (goes backward in time)
node scripts/ingestion/launch-import-workers.js --sport=basketball --from-date=2026-01-24 --max-dates=5 --workers=4

# Import multiple specific dates
node scripts/ingestion/launch-import-workers.js --sport=basketball --dates=2026-01-24,2026-01-25,2026-01-26 --workers=4

# Reimport a date (--force clears & reinits the queue before spawning workers)
node scripts/ingestion/launch-import-workers.js --date=2026-01-21 --sport=basketball --workers=12 --force
```

**Check import progress:**
```powershell
# Real-time dashboard (shows pending/completed/failed/skipped per date)
node scripts/ingestion/import-status.js

# Check from database
psql $env:DATABASE_URL -c "SELECT * FROM vw_import_progress ORDER BY date DESC;"
```

**Retry failed imports:**
```powershell
# Reset failed imports to pending for retry
psql $env:DATABASE_URL -c "SELECT reset_failed_imports('2026-01-24');"

# Or reset all failed imports across dates
psql $env:DATABASE_URL -c "SELECT reset_failed_imports();"
```

**Parameters:**
- `--sport=NAME` - Filter to specific sport
- `--date=YYYY-MM-DD` - Single date
- `--dates=YYYY-MM-DD,YYYY-MM-DD` - Comma-separated dates
- `--from-date=YYYY-MM-DD` - Start date (goes backward)
- `--max-dates=N` - Number of days to import (backward from from-date)
- `--workers=N` - Number of parallel workers (default: 4)
- `--max-sets=N` - Limit sets per worker
- `--dry-run` - Preview without importing

**Features:**
- Atomic set claiming - no duplicate work across workers
- Per-date progress tracking
- Resume capability - restart and continue where left off
- Failed import retry mechanism
- Per-worker statistics in output

---

### Direct S3 Import (Single Process)

Imports card data directly from S3 to `card_daily_snapshots`. Reads set list from database `sets` table.

```powershell
# Import all sets (all sports)
node scripts/ingestion/direct-import-from-s3.js

# Import specific sport only
node scripts/ingestion/direct-import-from-s3.js --sport=basketball
node scripts/ingestion/direct-import-from-s3.js --sport=baseball
node scripts/ingestion/direct-import-from-s3.js --sport=football
node scripts/ingestion/direct-import-from-s3.js --sport=hockey

# Import specific set only
node scripts/ingestion/direct-import-from-s3.js --console-uid=G1096

# Import specific date
node scripts/ingestion/direct-import-from-s3.js --date=2026-01-24

# Import date range (backward from date)
node scripts/ingestion/direct-import-from-s3.js --from-date=2026-01-24 --max-dates=5

# Import without clearing existing data
node scripts/ingestion/direct-import-from-s3.js --no-cleanup

# Dry run (preview what would be imported)
node scripts/ingestion/direct-import-from-s3.js --sport=basketball --dry-run
```

**Parameters:**
- `--sport=NAME` - Filter to specific sport (basketball, baseball, football, hockey)
- `--console-uid=UID` - Import specific set only (e.g., G1096)
- `--date=YYYY-MM-DD` - Process single date
- `--from-date=YYYY-MM-DD` - Start from this date, go backward
- `--max-dates=N` - Limit number of dates to process
- `--no-cleanup` - Don't delete existing data before import (preserves other dates)
- `--dry-run` - Preview without making changes

**Features:**
- Shows import summary: total sets, sets with data found, sets without data, total rows imported
- Uses `sets` table as reference (not CSV file)
- Automatically deduplicates and handles set creation

---

### Data Quality Analysis

```powershell
# Analyze price data quality across all fields
node scripts/compute/compute-price-analysis.js

# Check data status summary
node scripts/db/check-data-status.js

# Sample NULL price records and trace to source
node scripts/diagnose-null-prices.js
```

### Full CSV Ingestion

```powershell
# Merge CSV files for date range
node scripts/ingestion/merge-csvs.js 2026-01-21 2026-01-30

# Load merged data (sequential - slower, safer)
node scripts/ingestion/copy-bulk-loader.js 2026-01-21 2026-01-30

# Load merged data (parallel workers - faster)
node scripts/ingestion/copy-bulk-loader-workers.js 2026-01-21 2026-01-30
```

### Check Available Data

```powershell
# List available dates in S3 bucket
node scripts/ingestion/list-available-dates.js

# Check specific sport dates
node scripts/ingestion/check-basketball-dates.js
```

---

## Data Migrations

```powershell
# Add rolling avg + pct change columns to card_daily_snapshots
node scripts/db/run-sql-schema.js db/migrations/add-rolling-avgs-to-snapshots.sql

# Populate fingerprints for existing cards
node db/migrations/populate-fingerprints.js

# Migrate to normalized schema (if upgrading from old schema)
node db/migrations/migrate-to-normalized-schema.js

# Migrate to core schema
node db/migrations/migrate-to-core-schema.js
```

---

## Import Management & Troubleshooting

### Check Import Progress

```powershell
# Real-time dashboard (shows pending/completed/failed/skipped per date)
node scripts/ingestion/import-status.js

# Summary by date with record counts
node scripts/check-import-summary.js

# Check specific date status
node scripts/check-import-summary.js --date=2026-01-20
```

### Manage Queue (Reset/Remove Sets)

```powershell
# Reset skipped sets to pending (try import again)
node scripts/reset-skipped-sets.js 2026-01-29

# Delete only skipped sets permanently
node scripts/reset-skipped-sets.js 2026-01-29 --remove

# Delete sets with specific status (pending/failed/skipped/completed)
node scripts/reset-skipped-sets.js 2026-01-29 --status=pending --remove
node scripts/reset-skipped-sets.js 2026-01-29 --status=failed --remove

# Delete ALL sets for a date (any status)
node scripts/reset-skipped-sets.js 2026-01-29 --clear-all

# Reset in_progress sets (useful for stuck workers)
node scripts/reset-skipped-sets.js 2026-01-20 --status=in_progress
```

### Reset & Reinitialize Date

```powershell
# Clear all data for a date and reinitialize queue
node scripts/reset-date.js 2026-01-20

# Then reinitialize with basketball only
node scripts/db/clear-and-init-queue.js --sport=basketball --date=2026-01-20
```

### Check for Stuck Workers

```powershell
# Find sets stuck in progress for >30 minutes
node scripts/check-stuck-sets.js 2026-01-20

# Diagnose specific date issues
node scripts/diagnose-jan20.js
```

### Denormalize Card Data

```powershell
# Check denormalization status and update missing
node scripts/denormalize-cards.js --sport=basketball

# Force re-denormalization of all cards
node scripts/denormalize-cards.js --sport=basketball --force

# Denormalize specific date range
node scripts/denormalize-cards.js --sport=basketball --from-date=2026-01-20 --max-dates=5
```

---

## Metrics & Signal Computation

### Core Metrics (Investment-Grade)

```powershell
# Compute metrics for specific date (recommended approach)
node scripts/compute/compute-metrics.js --date=2026-01-24

# For large datasets (1M+ cards) - uses smaller batches with retry logic
node scripts/compute/compute-metrics-resilient.js 2026-01-24

# Recompute even if already done
node scripts/compute/compute-metrics.js --date=2026-01-24 --force

# Adjust batch size (default 500)
node scripts/compute/compute-metrics.js --date=2026-01-24 --batch-size=1000
```

**Parameters:**
- `--date=YYYY-MM-DD` - Process specific date (recommended)
- `--force` - Recompute rows that already have data
- `--batch-size=N` - Cards per batch (default: 500)

#### What Each Metric Represents

| Metric | Description | Calculation | Usage |
|--------|-------------|-------------|-------|
| **high_7d** / **low_7d** | 7-day price range | Max/min loose_price over 7 days | Support/resistance levels |
| **high_15d** / **low_15d** | 15-day price range | Max/min loose_price over 15 days | Medium-term range |
| **high_30d** / **low_30d** | 30-day price range | Max/min loose_price over 30 days | Long-term range |
| **range_pct_7d** | Price swing % | `(high_7d - low_7d) / low_7d * 100` | Volatility indicator (capped at 9999.99%) |
| **price_position_7d** | Where price sits in range | `(price - low_7d) / (high_7d - low_7d) * 100` | 0=at low, 100=at high, 50=middle |
| **price_change_pct** | % change from earliest | `(price - earliest_price) / earliest_price * 100` | Trend direction/strength |
| **trend_state** | Categorized trend | Rising (>3%), Declining (<-3%), Stable (between) | Quick trading signal |
| **days_of_data** | Available history | Count of days with price data in 30d window | Data quality indicator |

**Guaranteed Non-NULL:** All fields are populated for every card with a loose_price. No blank fields.

---

### Rolling Price Windows (compute-price-windows)

Computes rolling averages and % changes directly on `card_daily_snapshots`. Run this AFTER ingestion.

```powershell
# Compute all dates (skips already-computed rows)
node scripts/compute/compute-price-windows.js

# Compute for specific date
node scripts/compute/compute-price-windows.js --date=2026-01-24

# Recompute even if already done
node scripts/compute/compute-price-windows.js --date=2026-01-24 --force

# Custom batch size (default 300)
node scripts/compute/compute-price-windows.js --batch-size=500
```

**Parameters:**
- `--date=YYYY-MM-DD` - Process specific date only
- `--force` - Recompute rows that already have windows
- `--batch-size=N` - Cards per batch (default: 300)

#### Columns Added to card_daily_snapshots

| Column | Description | Min Data Points |
|--------|-------------|----------------|
| `avg_3d` | 3-day rolling average | 2 |
| `avg_7d` | 7-day rolling average | 3 |
| `avg_14d` | 14-day rolling average | 5 |
| `avg_30d` | 30-day rolling average | 10 |
| `avg_60d` | 60-day rolling average | 15 |
| `avg_90d` | 90-day rolling average | 20 |
| `pct_change_3d` | % change vs 3 days ago | — |
| `pct_change_7d` | % change vs 7 days ago | — |
| `pct_change_14d` | % change vs 14 days ago | — |
| `pct_change_30d` | % change vs 30 days ago | — |
| `pct_change_60d` | % change vs 60 days ago | — |
| `pct_change_90d` | % change vs 90 days ago | — |
| `data_points_3d`–`90d` | Number of days in each window | — |
| `windows_computed_at` | When windows were last computed | — |

Averages return **NULL** if below the minimum data point threshold (avoids misleading identical values).

#### Sample Queries

```sql
-- Cards with strongest 7-day gains
SELECT card_id, product_name, loose_price, avg_7d, pct_change_7d
FROM card_daily_snapshots
WHERE date = '2026-01-25' AND pct_change_7d > 20
ORDER BY pct_change_7d DESC LIMIT 20;

-- Multi-window view for a card
SELECT date, loose_price, avg_3d, avg_7d, avg_14d, avg_30d,
       pct_change_7d, pct_change_30d, data_points_7d, data_points_30d
FROM card_daily_snapshots
WHERE card_id = 72528 ORDER BY date;

-- Cards with meaningful 30-day averages
SELECT card_id, product_name, avg_30d, pct_change_30d, data_points_30d
FROM card_daily_snapshots
WHERE date = '2026-01-25' AND avg_30d IS NOT NULL
ORDER BY pct_change_30d DESC LIMIT 20;
```

### Set-Level Metrics (compute-set-metrics)

Aggregates card-level metrics into `sets_computed_metrics` for set-level analytics and reporting. Run this AFTER card ingestion and price windows computation.

```powershell
# Compute for single date
node scripts/compute/compute-set-metrics.js --date=2026-01-24

# Compute for date range
node scripts/compute/compute-set-metrics.js --from-date=2026-01-24 --to-date=2026-01-31

# Compute recent 7 days
node scripts/compute/compute-set-metrics.js --recent=7

# Check set metrics results
node scripts/db/check-set-metrics.js --date=2026-01-24
```

**Parameters:**
- `--date=YYYY-MM-DD` - Process specific date
- `--from-date=YYYY-MM-DD` - Start of date range
- `--to-date=YYYY-MM-DD` - End of date range
- `--recent=N` - Process last N days

**Key Metrics Computed:**

| Category | Metrics |
|----------|---------|
| **Counts** | cards_count, cards_with_prices_count, coverage_pct |
| **Prices** | avg_loose_price, median_loose_price, min/max, std_dev_price |
| **Market Activity** | total_sales_volume, total_market_value, avg_daily_volume |
| **Performance** | avg_price_change_pct_7d, avg_price_change_pct_30d |
| **Trends** | trending_up/down/consolidating/breakout/breakdown counts & percentages |
| **Volatility** | avg_volatility_30d, high_volatility_cards_pct |
| **Liquidity** | liquidity_score (0-100) |

#### Sample Queries

```sql
-- Top sets by market value
SELECT set_id, console_uid, cards_count, total_market_value, avg_price_change_pct_7d
FROM sets_computed_metrics
WHERE date = '2026-01-24' AND cards_count > 10
ORDER BY total_market_value DESC
LIMIT 20;

-- Trending sets (high % trending up)
SELECT set_id, cards_count, pct_trending_up, pct_cards_up_7d, liquidity_score
FROM sets_computed_metrics
WHERE date = '2026-01-24' AND cards_with_prices_count > 5
ORDER BY pct_trending_up DESC
LIMIT 20;

-- Set coverage analysis
SELECT 
  COUNT(*) as total_sets,
  COUNT(*) FILTER (WHERE cards_with_prices_count > 0) as sets_with_prices,
  AVG(coverage_pct) as avg_coverage
FROM sets_computed_metrics
WHERE date = '2026-01-24';
```

### Legacy Multi-Window Analytics (compute-windows) — DEPRECATED

Replaced by `compute-price-windows.js` above. The old script wrote to separate `card_price_windows` and `card_analytics_daily` tables.

```powershell
# Old command (still works but deprecated)
node scripts/compute/compute-windows.js --date=2026-01-24
```

---

### Reporting Views (for Metabase)

Pre-built views for direct reporting in Metabase. All views prefixed with `reports_`.

**Create the views:**
```powershell
node scripts/db/run-sql-schema.js db/schemas/11-reporting-views.sql
```

**Available Reports:**

| View Name | Description | Key Columns |
|-----------|-------------|-------------|
| `reports_daily_market_summary` | Market-wide daily statistics | `breakouts`, `bullish_count`, `avg_7d_return` |
| `reports_top_movers_7d` | Best/worst performing cards | `pct_change_7d`, `rank_by_7d_change`, `mover_type` |
| `reports_breakout_alerts` | Cards with >10% weekly gains | `breakout_strength`, `trend_consistency_score` |
| `reports_trending_cards` | Significant movement (any direction) | `is_trending`, `trend_direction`, `trend_strength` |
| `reports_data_quality` | Data coverage metrics | `pct_7d_coverage`, `pct_30d_coverage` |
| `reports_consolidating_assets` | Stable/flat cards | `is_consolidating`, `performance_7d_tier` |
| `reports_latest_card_computed_metrics` | Latest computed metrics per card | `high_7d`, `low_7d`, `range_pct_7d`, `trend_state`, `price_change_pct` |

**Example queries:**
```sql
-- Daily breakout summary
SELECT date, breakouts, tier_breakout, tier_strong, avg_7d_return 
FROM reports_daily_market_summary;

-- Top 10 gainers today
SELECT card_id, player_name, set_name, pct_change_7d 
FROM reports_top_movers_7d 
WHERE date = CURRENT_DATE AND mover_type = 'gainer'
LIMIT 10;

-- All breakouts with strength classification
SELECT * FROM reports_breakout_alerts 
WHERE date = CURRENT_DATE AND breakout_strength = 'extreme';
```

---

### ALX Signals

```powershell
# Create ALX schema and views
node scripts/compute/alx-create-schema.js
node scripts/compute/alx-create-views.js

# Compute ALX market signals
node scripts/compute/alx-compute-signals.js
```

---

## Market Indices

```powershell
# Manage indices (create, update, list)
node scripts/utils/manage-indices.js
```

---

## Utilities

### Date Summary (All Dates Overview)

```powershell
# Show all dates with card counts, priced counts, and window computation status
node scripts/db/_date-summary.js
```

### Delete Snapshots for a Specific Date

```powershell
# Delete all card_daily_snapshots for a specific date
node scripts/db/_delete-dates.js --date=2026-01-21
```

### Quick Card Count

```powershell
# Count cards and window status for a date
node scripts/db/_quick-count.js 2026-01-03
node scripts/db/_quick-count.js 2026-01-25
```

### Sample Rolling Averages

```powershell
# Sample 6 cards and show price history + calculated rolling averages
node scripts/db/sample-rolling-averages.js
```

### Verify Computed Windows

```powershell
# Verify rolling averages for 6 sample cards (cards 72528-72533)
node scripts/db/verify-windows.js
```

### List Database Tables

```powershell
node scripts/db/list-tables.js
```

### Download CSV for Specific Card

```powershell
# Preview card details without downloading (streams from S3)
node scripts/utils/download-card-csv.js --card-id=10827676 --console-uid=G87770 --date=2026-01-23 --preview

# Download the file
node scripts/utils/download-card-csv.js --console-uid=G87770 --date=2026-01-23 --download

# Download and verify specific card exists
node scripts/utils/download-card-csv.js --card-id=10827676 --console-uid=G87770 --date=2026-01-23 --download
```

### Run Any SQL Schema File

```powershell
node scripts/db/run-sql-schema.js <path-to-sql-file>
```

---

## Database Queries (Verification)

```powershell
# Check all tables
psql $env:DATABASE_URL -c "\dt"

# Check all views
psql $env:DATABASE_URL -c "\dv"

# Count cards
psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM cards;"

# Sample card data
psql $env:DATABASE_URL -c "SELECT * FROM vw_cards_enriched LIMIT 5;"

# Check signals
psql $env:DATABASE_URL -c "SELECT * FROM vw_signals_summary LIMIT 5;"
```

---

## Complete Workflow Example

```powershell
# 1. Reset everything
node scripts/db/drop-schema.js    # Drop tables
node scripts/db/drop-views.js       # Drop views

# 2. Create all schemas
node scripts/db/create-schema.js    # Create tables
node scripts/db/create-views.js      # Create views

# 3. Verify tables exist
node scripts/db/list-tables.js

# 5. Load test data (parallel workers - fastest)
node scripts/ingestion/launch-import-workers.js --sport=basketball --from-date=2026-01-24 --max-dates=5 --workers=4

# Check progress
node scripts/ingestion/import-status.js

# 5. Compute metrics for specific date
node scripts/compute/compute-metrics.js --date=2026-01-24

# 6. Compute rolling price windows
node scripts/compute/compute-price-windows.js

# 7. Create reporting views
node scripts/db/run-sql-schema.js db/schemas/11-reporting-views.sql

# 8. Verify data loaded
psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM cards;"
psql $env:DATABASE_URL -c "SELECT * FROM vw_signals_summary;"
```

---

## File Locations

| Component | Path |
|-----------|------|
| Environment | `.env` (root) |
| Schemas | `db/schemas/*.sql` |
| Scripts | `scripts/db/*.js` |
| Migrations | `db/migrations/*.js`, `db/migrations/*.sql` |
| Ingestion | `scripts/ingestion/*.js` |
| Compute | `scripts/compute/*.js` |
| Documentation | `docs/*.md` |

---

## Troubleshooting

```powershell
# If you get SSL errors - already disabled in scripts
# If you get password errors - check .env DATABASE_URL

# Test connection
node -e "require('dotenv').config(); console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Missing')"

# View last error details
node scripts/db/run-sql-schema.js db/schemas/02-normalized-schema.sql 2>&1
```
