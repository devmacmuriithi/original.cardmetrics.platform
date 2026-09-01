# Milestone 2: Card Market Index Engine
## Project Structure

```
milestone2/
├── .env                           # Environment variables (root level)
├── .env.example                   # Environment template
├── docs/                          # Documentation
│   ├── README.md                  # Project overview
│   ├── CARD_COMPUTED_METRICS.md   # Metrics specification
│   ├── CARD_MARKET_INDEX_ENGINE_POC.md  # POC documentation
│   ├── Collection-Sets-Documentation.md   # Data source docs
│   └── DATASETS.md                # Dataset information
│
├── config/                        # Configuration
│   └── fingerprint-rules.js       # Fingerprint specification
│
├── db/                            # Database
│   ├── schemas/                   # SQL schema files
│   │   ├── 01-dimensions.sql      # sports, leagues, manufacturers, teams
│   │   ├── 02-cards.sql           # cards, players, sets
│   │   ├── 03-snapshots.sql       # card_daily_snapshots
│   │   ├── 04-metrics.sql         # card_computed_metrics
│   │   ├── 05-indices.sql         # market_indices, constituents
│   │   ├── 06-alx-signals.sql     # ALX liquidity signals
│   │   └── 07-views.sql           # All views
│   │
│   ├── migrations/                # Migration scripts
│   │   ├── migrate-to-core-schema.js
│   │   ├── migrate-to-normalized-schema.js
│   │   └── populate-fingerprints.js
│   │
│   └── seeds/                     # Seed data
│       └── basketball_sets.csv
│
├── scripts/                       # Operational scripts
│   ├── db/                        # Database management
│   │   ├── create-schema.js
│   │   ├── drop-schema.js
│   │   └── maintenance.js
│   │
│   ├── ingestion/                 # Data ingestion
│   │   ├── mvp-test-basketball.js
│   │   ├── copy-bulk-loader.js
│   │   ├── copy-bulk-loader-workers.js
│   │   ├── merge-csvs.js
│   │   └── check-dates.js
│   │
│   ├── compute/                   # Metrics computation
│   │   ├── compute-metrics.js
│   │   └── alx-compute-signals.js
│   │
│   └── utils/                     # Utilities
│       ├── manage-indices.js
│       ├── parse-cards.js
│       └── list-available-dates.js
│
├── src/                           # Source code (future API)
│   ├── api/                       # Express routes (placeholder)
│   ├── models/                    # Data models (placeholder)
│   ├── services/                  # Business logic (placeholder)
│   └── utils/                     # Helpers (placeholder)
│
├── tests/                         # Test files (placeholder)
│
└── package.json                   # Dependencies
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp config/.env.example config/.env
# Edit config/.env with your credentials

# 3. Create database schema
node scripts/db/create-schema.js

# 4. Load seed data
node scripts/db/load-seed-data.js

# 5. Run test ingestion
node scripts/ingestion/mvp-test-basketball.js

# 6. Compute metrics
node scripts/compute/compute-metrics.js 2026-01-21

# 7. Check results
psql $DATABASE_URL -c "SELECT * FROM vw_card_metrics_current LIMIT 10;"
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `scripts/db/create-schema.js` | Create all tables and views |
| `scripts/ingestion/mvp-test-basketball.js` | Test ingest for basketball sets |
| `scripts/compute/compute-metrics.js` | Compute investment metrics |
| `scripts/utils/manage-indices.js` | Manage market indices |
| `scripts/db/maintenance.js` | VACUUM ANALYZE and cleanup |

## Database Architecture

### Bronze Layer (Raw)
- `cards_raw_ingests` - Staging table for CSV data

### Silver Layer (Normalized)
- `card_daily_snapshots` - Daily price facts
- Dimension tables: `sports`, `leagues`, `manufacturers`, `teams`, `players`, `sets`

### Gold Layer (Analytics)
- `card_computed_metrics` - Investment signals
- `cards` - Cards with fingerprints
- `market_indices` - Index definitions
- `market_index_constituents` - Index membership
- `market_index_values` - Index time-series

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=pricecharting-csv-production
AWS_REGION=us-east-1

# Optional
NODE_ENV=development
```

## Documentation

- [Card Computed Metrics](docs/CARD_COMPUTED_METRICS.md) - Investment signal specifications
- [Index Engine POC](docs/CARD_MARKET_INDEX_ENGINE_POC.md) - Finance-grade architecture
- [Collection Sets](docs/Collection-Sets-Documentation.md) - Data source mapping

## Future: API Layer

The `src/` directory is reserved for future Express.js API development:

```
src/
├── api/
│   ├── routes/
│   │   ├── cards.js
│   │   ├── indices.js
│   │   └── metrics.js
│   ├── controllers/
│   └── middleware/
├── models/
├── services/
└── app.js
```
