# Database Schema Architecture

## Overview

This document provides a complete reference of the database schema architecture for the Card Price Analytics platform. The schema follows a **Kimball-style star schema** design with normalized dimension tables and fact tables optimized for time-series analytics.

---

## Architecture Pattern: Star Schema

```
                    ┌─────────────────────────────────────────┐
                    │           DIMENSION TABLES                │
                    │  (Normalized, slowly-changing dimensions) │
                    └─────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│    sports     │            │    leagues    │            │  players      │
│   (9 rows)    │            │   (5 rows)    │            │  (athletes)   │
└───────┬───────┘            └───────┬───────┘            └───────┬───────┘
        │                            │                            │
        │     ┌───────────────┐      │      ┌───────────────┐      │
        └────▶│   leagues     │◄─────┘      │     teams     │◄─────┘
              │  (sport_id FK)  │             │ (league_id FK)│
              └───────────────┘             └───────────────┘
                                                    │
                          ┌───────────────┐      │      ┌───────────────┐
                          │ manufacturers │◄─────┘      │     sets      │
                          │ (Panini, etc) │             │(card sets)    │
                          └───────────────┘             └───────┬───────┘
                                                                │
                    ┌─────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           CARDS (Dimension)                              │
│                                                                          │
│  PK: id (BIGINT)                                                         │
│  FK: set_id → sets(id)                                                   │
│      player_id → players(id)                                             │
│      team_id → teams(id)                                                 │
│      sport_id, league_id, manufacturer_id (denormalized for perf)         │
│                                                                          │
│  Attributes: card_number, variation, rookie_card, psa_pop_report, etc.     │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │  card_grades      │ │ card_attributes   │ │card_daily_snapshots│
        │ (grading info)    │ │ (types/variations)│ │   (FACT TABLE)    │
        └───────────────────┘ └───────────────────┘ └─────────┬─────────┘
                                                                │
                                                                │
        ┌─────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    card_computed_metrics (DERIVED FACT)                  │
│                                                                          │
│  PK: id (SERIAL)                                                         │
│  FK: card_id → cards(id)                                                 │
│  UK: (card_id, date)                                                     │
│                                                                          │
│  Computed: momentum, volatility, trend_state, liquidity, etc.            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Dimension Tables (Normalized)

### 1. **sports**
Top-level sport categories.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| name | TEXT | Basketball, Baseball, etc. |
| slug | TEXT | basketball, baseball |
| display_order | INTEGER | Sort order |

**Relationships:** 
- Parent of: `leagues.sport_id`
- Referenced by: `cards.sport_id`

---

### 2. **leagues**
Professional leagues by sport.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| sport_id | INTEGER FK | → sports.id |
| name | TEXT | NBA, MLB, NFL |
| slug | TEXT | nba, mlb |
| abbreviation | TEXT | NBA, MLB |

**Relationships:**
- Child of: `sports`
- Parent of: `teams.league_id`
- Referenced by: `cards.league_id`

---

### 3. **teams**
League-specific teams.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| league_id | INTEGER FK | → leagues.id |
| name | TEXT | Los Angeles Lakers |
| slug | TEXT | los-angeles-lakers |
| city | TEXT | Los Angeles |
| abbreviation | TEXT | LAL |

**Relationships:**
- Child of: `leagues`
- Referenced by: `cards.team_id`

---

### 4. **players**
Athletes across all sports.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| full_name | TEXT | LeBron James |
| slug | TEXT UNIQUE | lebron-james |
| first_name | TEXT | LeBron |
| last_name | TEXT | James |
| birth_date | DATE | 1984-12-30 |
| position | TEXT | Forward |
| hall_of_fame | BOOLEAN | False |

**Relationships:**
- Referenced by: `cards.player_id`

---

### 5. **manufacturers**
Card manufacturers.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| name | TEXT UNIQUE | Panini, Topps |
| slug | TEXT UNIQUE | panini, topps |
| country | TEXT | Italy, USA |

**Relationships:**
- Referenced by: `sets.manufacturer_id`, `cards.manufacturer_id`

---

### 6. **sets**
Card sets (replaces sets_master).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| console_uid | TEXT UNIQUE | G78842, G1096 (source ID) |
| slug | TEXT | basketball-cards-2024-panini-prizm |
| sport_id | INTEGER FK | → sports.id |
| league_id | INTEGER FK | → leagues.id |
| manufacturer_id | INTEGER FK | → manufacturers.id |
| name | TEXT | 2024 Panini Prizm Basketball |
| year | INTEGER | 2024 |
| release_date | DATE | 2024-03-15 |
| total_cards | INTEGER | Known set size |
| page_name | TEXT | Source page reference |
| url | TEXT | Source URL |
| csv_path | TEXT | S3 file pattern |

**Relationships:**
- Children: `cards.set_id`
- References: `sports`, `leagues`, `manufacturers`

---

### 7. **cards**
Individual trading cards (central dimension).

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT PK | Unique card ID (same as source) |
| set_id | INTEGER FK | → sets.id |
| player_id | INTEGER FK | → players.id |
| team_id | INTEGER FK | → teams.id |
| sport_id | INTEGER FK | → sports.id (denormalized) |
| league_id | INTEGER FK | → leagues.id (denormalized) |
| manufacturer_id | INTEGER FK | → manufacturers.id (denormalized) |
| card_number | TEXT | 1, 251, RC1 |
| variation | TEXT | Silver Prizm, Base |
| rookie_card | BOOLEAN | First year designation |
| psa_pop_report | INTEGER | PSA population |
| bgs_pop_report | INTEGER | BGS population |
| raw_product_name | TEXT | Original CSV product-name |
| raw_console_name | TEXT | Original CSV console-name |
| first_seen_date | DATE | First ingestion date |

**Relationships:**
- Parent of: `card_daily_snapshots.card_id`, `card_computed_metrics.card_id`
- Children: `card_grades.card_id`, `card_attributes.card_id`
- References: All dimension tables

---

### 8. **grading_companies**
Third-party grading services.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| name | TEXT | Professional Sports Authenticator |
| slug | TEXT UNIQUE | psa |
| abbreviation | TEXT UNIQUE | PSA |
| grading_scale | TEXT | 1-10 |
| premium_service | BOOLEAN | Express options available |

**Relationships:**
- Parent of: `card_grades.grading_company_id`

---

### 9. **card_grades**
Specific grades assigned to cards.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| card_id | BIGINT FK | → cards.id |
| grading_company_id | INTEGER FK | → grading_companies.id |
| grade | NUMERIC(3,1) | 10, 9.5, 9 |
| grade_label | TEXT | Gem Mint, Mint |
| subgrades | JSONB | {centering: 10, corners: 9.5} |
| cert_number | TEXT | Certification number |
| graded_date | DATE | When graded |
| population | INTEGER | Count at this grade |
| population_higher | INTEGER | Count above this grade |

**Relationships:**
- Child of: `cards`, `grading_companies`

---

### 10. **card_types**
Card classification (Base, Parallel, Auto, etc.).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| name | TEXT UNIQUE | Base, Parallel, Autograph |
| slug | TEXT UNIQUE | base, parallel, auto |
| category | TEXT | standard, premium, hit |
| is_serial_numbered | BOOLEAN | Has serial number |
| rarity_multiplier | NUMERIC | Value multiplier (1.0 - 50.0) |

---

### 11. **variations**
Specific parallels (Silver Prizm, Gold Refractor).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| name | TEXT UNIQUE | Silver Prizm |
| slug | TEXT UNIQUE | silver-prizm |
| color | TEXT | Silver, Gold, Blue |
| finish | TEXT | Prizm, Refractor |
| serial_number | INTEGER | /25 = 25 |
| value_multiplier | NUMERIC | 1.5, 5.0, 50.0 |

---

### 12. **card_attributes** (Junction)
Many-to-many: cards × types × variations.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| card_id | BIGINT FK | → cards.id |
| card_type_id | INTEGER FK | → card_types.id |
| variation_id | INTEGER FK | → variations.id |
| serial_number | TEXT | "12/25" if stamped |
| is_rookie_card | BOOLEAN | Rookie designation |
| is_autographed | BOOLEAN | Has auto |
| has_relic | BOOLEAN | Has game-worn material |

---

## Fact Tables

### 1. **card_daily_snapshots**
Raw daily price data from CSV ingestion.

| Column | Type | Description |
|--------|------|-------------|
| card_id | BIGINT PK/FK | → cards.id |
| date | DATE PK | Snapshot date |
| console_uid | TEXT | Set identifier (G78842) |
| console_name | TEXT | Denormalized set name |
| product_name | TEXT | Denormalized card/player name |
| loose_price | NUMERIC(12,2) | Ungraded market price |
| graded_price | NUMERIC(12,2) | Generic graded price |
| psa10_price | NUMERIC(12,2) | PSA 10 proxy (manual-only-price) |
| bgs10_price | NUMERIC(12,2) | BGS 10 price |
| retail_loose_buy | NUMERIC(12,2) | Retail buy price |
| retail_loose_sell | NUMERIC(12,2) | Retail sell price |
| sales_volume | NUMERIC | 365-day rolling total count |
| created_at | TIMESTAMP | Ingestion timestamp |
| source_file | TEXT | CSV filename |

**Primary Key:** (card_id, date) - Composite for time-series

**Indexes:**
- idx_snapshots_date (date)
- idx_snapshots_console (console_uid)
- idx_snapshots_card (card_id)
- idx_snapshots_recent (date, card_id)

---

### 2. **card_computed_metrics**
Derived analytics computed from snapshots.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Surrogate key |
| card_id | BIGINT FK | → cards.id |
| date | DATE | Metric date |
| last_sale_price | NUMERIC(12,2) | Last known price |
| last_sale_date | DATE | Date of last sale |
| avg_price_7d | NUMERIC(12,2) | 7-day moving average |
| avg_price_30d | NUMERIC(12,2) | 30-day moving average |
| avg_price_90d | NUMERIC(12,2) | 90-day moving average |
| price_change_1d | NUMERIC(5,2) | 1-day % change |
| price_change_7d | NUMERIC(5,2) | 7-day % change |
| price_change_30d | NUMERIC(5,2) | 30-day % change |
| price_change_90d | NUMERIC(5,2) | 90-day % change |
| high_price_30d | NUMERIC(12,2) | 30-day high |
| low_price_30d | NUMERIC(12,2) | 30-day low |
| volatility_score | NUMERIC(4,2) | 0-1 scale (price variance) |
| price_stability_index | NUMERIC(4,2) | 0-1 scale (higher = stable) |
| momentum | NUMERIC(6,3) | (30d_avg - 90d_avg) / 90d_avg |
| price_stddev_30d | NUMERIC(12,2) | 30-day price std dev |
| trend_state | TEXT | Rising, Stable, Declining |
| liquidity_score | NUMERIC(4,2) | 0-1 scale (normalized velocity) |
| sales_velocity | NUMERIC(8,2) | Units per day estimate |
| liquidity_tier | TEXT | High, Medium, Low |
| execution_eligible | BOOLEAN | Can execute trades |
| trend_direction | TEXT | up, down, sideways |
| trend_strength | NUMERIC(4,2) | 0-1 scale |
| estimated_market_cap | NUMERIC(15,2) | price × velocity × 365 |
| days_of_data | INTEGER | Snapshot days used |
| computed_at | TIMESTAMP | Calculation timestamp |

**Unique Constraint:** (card_id, date)

**Indexes:**
- idx_metrics_card (card_id)
- idx_metrics_date (date)
- idx_metrics_liquidity (liquidity_score)
- idx_metrics_volatility (volatility_score)
- idx_metrics_trend (trend_direction) - partial
- idx_metrics_execution (execution_eligible) - partial
- idx_metrics_composite (card_id, date, liquidity, volatility)

---

## Views

### 1. **vw_card_metrics_current**
Latest computed metrics per card.

```sql
SELECT DISTINCT ON (card_id) *
FROM card_computed_metrics
ORDER BY card_id, date DESC;
```

**Use Case:** Dashboards, "current price" lookups

---

### 2. **vw_card_complete**
Full card profile with all dimensions and current metrics.

**Joins:**
- cards → players, teams, sets, manufacturers, leagues, sports
- cards → vw_card_metrics_current (current metrics)

**Use Case:** API responses, detailed card pages

---

### 3. **vw_cards_enriched**
Cards with dimension names resolved.

**Use Case:** Analytics queries, exports

---

### 4. **vw_cards_full**
Complete card view with attributes, grades, and variations (aggregated).

**Use Case:** Search results, filtering

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                │
│  S3 CSV Files → basketball-cards-YYYY-setname_GXXXXX.csv               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          INGESTION PIPELINE                              │
│  mvp-test-basketball.js                                                │
│  ├── Load sets from basketball_sets.csv                                  │
│  ├── Download CSVs from S3                                              │
│  ├── Transform & normalize                                             │
│  ├── Ensure cards exist (UPSERT)                                       │
│  └── Load to card_daily_snapshots                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          TRANSFORMATION                                  │
│  compute-metrics.js                                                      │
│  ├── Calculate moving averages (7d, 30d, 90d)                          │
│  ├── Compute momentum & volatility                                       │
│  ├── Determine trend state                                               │
│  └── Write to card_computed_metrics                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONSUMPTION                                    │
│  Views: vw_card_complete, vw_card_metrics_current                        │
│  API → Dashboards → Analytics                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Scalability Considerations

### Partitioning Strategy

**card_daily_snapshots** - Partition by `date` (monthly)
```sql
-- When data grows > 10M rows
CREATE TABLE card_daily_snapshots_y2024m01 PARTITION OF card_daily_snapshots
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

**card_computed_metrics** - Partition by `date` (monthly)

### Indexing Strategy

- **Time-series queries:** Index on (date, card_id)
- **Card lookups:** Index on card_id
- **Set queries:** Index on console_uid
- **Analytics filters:** Partial indexes on boolean flags

### Data Retention

- **Raw snapshots:** Keep 2 years (archived to S3)
- **Computed metrics:** Keep indefinitely (aggregated, smaller)
- **Derived signals:** Keep indefinitely

---

## Legacy Tables (Deprecated)

| Old Table | Replacement | Migration Status |
|-----------|-------------|------------------|
| cards_raw_ingests | **REMOVED** | Use cards + card_daily_snapshots |
| card_market_daily | card_daily_snapshots | ✅ Renamed |
| sets_master | sets | ✅ Normalized with FKs |
| cards_master | cards | ✅ Normalized with FKs |

---

## Foreign Key Reference

```
cards.set_id → sets.id
cards.player_id → players.id
cards.team_id → teams.id
cards.sport_id → sports.id
cards.league_id → leagues.id
cards.manufacturer_id → manufacturers.id

sets.sport_id → sports.id
sets.league_id → leagues.id
sets.manufacturer_id → manufacturers.id

leagues.sport_id → sports.id
teams.league_id → leagues.id

card_computed_metrics.card_id → cards.id
card_daily_snapshots.card_id → cards.id
card_grades.card_id → cards.id
card_grades.grading_company_id → grading_companies.id
card_attributes.card_id → cards.id
card_attributes.card_type_id → card_types.id
card_attributes.variation_id → variations.id
```

---

## Summary Statistics (Example)

| Table | Type | Expected Rows | Growth Rate |
|-------|------|---------------|-------------|
| sports | Dimension | 9 | Static |
| leagues | Dimension | 5-10 | Slow |
| teams | Dimension | 150 | Slow |
| players | Dimension | 50,000 | Medium |
| manufacturers | Dimension | 11 | Static |
| sets | Dimension | 2,000 | Medium |
| cards | Dimension | 500,000 | High |
| card_daily_snapshots | Fact | 50M+ | Very High |
| card_computed_metrics | Derived | 50M+ | Very High |
| card_grades | Dimension | 2M | High |

---

## Query Patterns

### 1. Get current price for a card
```sql
SELECT * FROM vw_card_metrics_current 
WHERE card_id = 12345;
```

### 2. Get complete card profile
```sql
SELECT * FROM vw_card_complete 
WHERE card_id = 12345;
```

### 3. Find rising cards in a set
```sql
SELECT c.*, cm.momentum, cm.trend_state
FROM vw_card_complete c
JOIN vw_card_metrics_current cm ON c.card_id = cm.card_id
WHERE c.console_uid = 'G78842'
  AND cm.trend_state = 'Rising'
ORDER BY cm.momentum DESC;
```

### 4. Historical price chart
```sql
SELECT date, loose_price, sales_volume
FROM card_daily_snapshots
WHERE card_id = 12345
  AND date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY date;
```

---

**Last Updated:** February 2026
**Schema Version:** Core Schema v3.0
