# Database Schema Reference
## Complete List of Tables and Views

---

## Summary

| Layer | Object | Type | Fields |
|-------|--------|------|--------|
| Bronze | cards_raw_ingests | Table | 6 |
| Silver | sports | Table | 5 |
| Silver | leagues | Table | 6 |
| Silver | manufacturers | Table | 6 |
| Silver | teams | Table | 7 |
| Silver | players | Table | 8 |
| Silver | sets | Table | 12 |
| Silver | cards | Table | 15 |
| Silver | grading_companies | Table | 7 |
| Silver | card_grades | Table | 11 |
| Silver | card_types | Table | 9 |
| Silver | variations | Table | 8 |
| Silver | card_attributes | Table | 8 |
| Silver | vw_cards_enriched | View | 9 |
| Silver | vw_market_enriched | View | 13 |
| Silver | vw_cards_full | View | 12 |
| Gold | card_daily_snapshots | Table | 13 |
| Gold | card_computed_metrics | Table | 29 |
| Gold | vw_card_metrics_current | View | 18 |
| Gold | vw_card_complete | View | 22 |
| Indices | market_indices | Table | 12 |
| Indices | market_index_constituents | Table | 11 |
| Indices | market_index_values | Table | 14 |
| Indices | vw_index_composition | View | 11 |
| Indices | vw_index_performance | View | 9 |
| Indices | vw_index_comparison | View | 7 |
| ALX | alx_signal_config | Table | 5 |
| ALX | alx_market_signals_daily | Table | 9 |
| ALX | vw_rolloff_alerts | View | 7 |
| ALX | vw_execution_eligible | View | 8 |
| ALX | vw_liquidity_distribution | View | 6 |
| ALX | vw_signals_summary | View | 10 |
| Legacy | sets_master | Table | 7 |
| Legacy | card_market_daily | Table | 12 |
| Legacy | card_market_diff | View | 8 |
| **Total** | **32 Objects** | **21 Tables / 13 Views** | **337+ Fields** |

---

## Bronze Layer (Staging)

### `cards_raw_ingests`
Staging table for CSV data ingestion.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL PK | Auto-generated ID |
| ingest_date | DATE | Date of data ingestion |
| console_uid | TEXT | Set identifier (e.g., G78842) |
| card_id | BIGINT | Card ID from source |
| payload | JSONB | All CSV fields as JSON |
| filename | TEXT | Source CSV filename |

**Purpose:** Fast bulk loading of raw CSV data before extraction.

---

## Silver Layer (Dimensions)

### `sports`
Sports categories.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Sport ID |
| name | TEXT | Display name (Basketball) |
| slug | TEXT | URL slug (basketball) |
| display_order | INTEGER | Sort order |

**Seed Data:** Basketball, Baseball, Football, Hockey, Soccer, Racing, Golf, Wrestling

---

### `leagues`
Professional leagues.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | League ID |
| sport_id | INTEGER FK | → sports |
| name | TEXT | Full name (National Basketball Association) |
| slug | TEXT | URL slug (nba) |
| abbreviation | TEXT | NBA, MLB, NFL |

**Seed Data:** NBA, MLB, NFL, NHL, MLS

---

### `manufacturers`
Card manufacturers.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Manufacturer ID |
| name | TEXT | Display name (Panini) |
| slug | TEXT | URL slug (panini) |
| country | TEXT | Origin country |
| website_url | TEXT | Official website |

**Seed Data:** Panini, Topps, Upper Deck, Leaf, Donruss, Bowman, Fleer, Score, Stadium Club, Chrome, Prizm

---

### `teams`
Sports teams.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Team ID |
| league_id | INTEGER FK | → leagues |
| name | TEXT | Team name (Los Angeles Lakers) |
| slug | TEXT | URL slug |
| city | TEXT | City |
| abbreviation | TEXT | LAL, NYY |
| logo_url | TEXT | Logo image URL |

---

### `players`
Athletes and players.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Player ID |
| full_name | TEXT | Full name (LeBron James) |
| slug | TEXT | URL slug (lebron-james) |
| first_name | TEXT | First name |
| last_name | TEXT | Last name |
| birth_date | DATE | Date of birth |
| position | TEXT | Guard, Forward, etc. |
| hall_of_fame | BOOLEAN | HOF status |

---

### `sets`
Card sets (replaces sets_master).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Set ID |
| console_uid | TEXT | Source ID (G78842) |
| slug | TEXT | URL slug |
| sport_id | INTEGER FK | → sports |
| league_id | INTEGER FK | → leagues |
| manufacturer_id | INTEGER FK | → manufacturers |
| name | TEXT | Set name (2024 Panini Prizm Basketball) |
| year | INTEGER | Release year |
| release_date | DATE | Official release date |
| total_cards | INTEGER | Known set size |

---

### `cards`
Individual trading cards with normalized FKs.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT PK | Card ID (from source) |
| set_id | INTEGER FK | → sets |
| player_id | INTEGER FK | → players |
| team_id | INTEGER FK | → teams |
| sport_id | INTEGER FK | → sports |
| league_id | INTEGER FK | → leagues |
| manufacturer_id | INTEGER FK | → manufacturers |
| card_number | TEXT | Card number (1, RC1) |
| variation | TEXT | Silver Prizm, Base |
| rookie_card | BOOLEAN | Rookie designation |
| card_fingerprint | TEXT | Canonical identity string |
| card_fingerprint_hash | TEXT | SHA256 hash for joins |
| fingerprint_version | INTEGER | Fingerprint version |

**Key Feature:** Deterministic fingerprint for cross-system identity.

---

### `grading_companies`
Third-party grading services.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Company ID |
| name | TEXT | Full name (Professional Sports Authenticator) |
| slug | TEXT | URL slug (psa) |
| abbreviation | TEXT | PSA, BGS, SGC |
| grading_scale | TEXT | 1-10, 1-100 |
| premium_service | BOOLEAN | Express options |

**Seed Data:** PSA, BGS, SGC, HGA, CSG, GMA

---

### `card_grades`
Individual card grades.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Grade record ID |
| card_id | BIGINT FK | → cards |
| grading_company_id | INTEGER FK | → grading_companies |
| grade | NUMERIC | Grade value (10, 9.5) |
| grade_label | TEXT | Gem Mint, Mint |
| subgrades | JSONB | Centering, Corners, Edges, Surface |
| cert_number | TEXT | Certification number |
| population | INTEGER | Count at this grade |
| population_higher | INTEGER | Count at higher grades |

---

### `card_types`
Card classification (Base, Parallel, Insert, Auto).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Type ID |
| name | TEXT | Display name (Autograph) |
| slug | TEXT | URL slug (auto) |
| category | TEXT | standard, premium, hit, short_print |
| is_serial_numbered | BOOLEAN | Has serial number |
| rarity_multiplier | NUMERIC | Value multiplier (1.00-50.00) |

**Seed Data:** Base, Parallel, Insert, Autograph, Relic, Autograph Relic, Short Print, Super Short Print, Patch, Printing Plate, Rookie Card, Numbered

---

### `variations`
Specific parallels (Silver Prizm, Gold Refractor).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Variation ID |
| name | TEXT | Display name (Silver Prizm) |
| slug | TEXT | URL slug (silver-prizm) |
| color | TEXT | Silver, Gold, Blue |
| finish | TEXT | Prizm, Refractor, Chrome |
| is_serial_numbered | BOOLEAN | Limited edition |
| serial_number | INTEGER | /25 = 25 |
| value_multiplier | NUMERIC | Price multiplier |

---

### `card_attributes`
Junction table linking cards to types/variations.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Junction ID |
| card_id | BIGINT FK | → cards |
| card_type_id | INTEGER FK | → card_types |
| variation_id | INTEGER FK | → variations |
| serial_number | TEXT | Stamped serial (12/25) |
| is_rookie_card | BOOLEAN | Rookie flag |
| is_autographed | BOOLEAN | Auto flag |
| has_relic | BOOLEAN | Relic flag |

---

## Gold Layer (Facts & Metrics)

### `card_daily_snapshots`
Raw daily snapshots from CSV (renamed from card_market_daily).

| Column | Type | Description |
|--------|------|-------------|
| card_id | BIGINT PK | Card ID |
| date | DATE PK | Snapshot date |
| console_uid | TEXT | Set identifier |
| console_name | TEXT | Set name from CSV |
| product_name | TEXT | Player/card name from CSV |
| loose_price | NUMERIC | Ungraded price |
| graded_price | NUMERIC | Generic graded price |
| psa10_price | NUMERIC | PSA 10 proxy price |
| bgs10_price | NUMERIC | BGS 10 price |
| retail_loose_buy | NUMERIC | Retail buy price |
| retail_loose_sell | NUMERIC | Retail sell price |
| sales_volume | NUMERIC | 365-day rolling sales |

---

### `card_computed_metrics`
Derived analytics and investment signals.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Metric record ID |
| card_id | BIGINT FK | → cards |
| date | DATE | Metric date |
| last_sale_price | NUMERIC | Last known price |
| avg_price_7d | NUMERIC | 7-day VWAP |
| avg_price_30d | NUMERIC | 30-day VWAP |
| avg_price_90d | NUMERIC | 90-day VWAP |
| price_change_1d | NUMERIC | 1-day % change |
| price_change_7d | NUMERIC | 7-day % change |
| price_change_30d | NUMERIC | 30-day % change |
| price_change_90d | NUMERIC | 90-day % change |
| high_price_30d | NUMERIC | 30-day high |
| low_price_30d | NUMERIC | 30-day low |
| **momentum** | NUMERIC | (30d_avg - 90d_avg) / 90d_avg |
| **price_stddev_30d** | NUMERIC | 30-day volatility |
| **trend_state** | TEXT | Rising, Stable, Declining |
| **liquidity_score** | NUMERIC | 0-1 scale (sales velocity) |
| **execution_eligible** | BOOLEAN | Safe to trade flag |
| estimated_market_cap | NUMERIC | Price × velocity × 365 |

---

## Market Indices

### `market_indices`
Index definitions (thematic, grade-based, era-based).

| Column | Type | Description |
|--------|------|-------------|
| index_id | SERIAL PK | Index ID |
| index_code | TEXT | NBA-MODERN-001, PSA10-BLUE-CHIP |
| index_name | TEXT | Display name |
| index_type | TEXT | thematic, grade_based, era_based |
| rebalance_frequency | TEXT | daily, weekly, monthly |
| weighting_method | TEXT | equal, market_cap, liquidity_weighted |
| min_liquidity_threshold | NUMERIC | Min liquidity to qualify |
| max_constituents | INTEGER | Max cards in index |
| is_active | BOOLEAN | Active status |

**Seed Data:** NBA-MODERN-001, PSA10-BLUE-CHIP, ROOKIE-PREMIUM, BASKETBALL-CORE, PANINI-PRIZM

---

### `market_index_constituents`
Index membership with weights.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Membership ID |
| index_id | INTEGER FK | → market_indices |
| card_id | BIGINT FK | → cards |
| card_fingerprint_hash | TEXT | Denormalized for joins |
| weight | NUMERIC | % of index (0.02 = 2%) |
| entry_date | DATE | When added |
| exit_date | DATE | When removed (NULL = active) |
| entry_reason | TEXT | Why added |
| exit_reason | TEXT | Why removed |

---

### `market_index_values`
Daily computed index time-series.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Value record ID |
| index_id | INTEGER FK | → market_indices |
| date | DATE | Value date |
| index_value | NUMERIC | Base 1000 at inception |
| index_value_change | NUMERIC | Day-over-day change |
| index_value_change_pct | NUMERIC | % change |
| constituent_count | INTEGER | Cards in index |
| avg_constituent_price | NUMERIC | Mean price |
| total_market_cap | NUMERIC | Sum of market caps |
| index_volatility_30d | NUMERIC | Rolling volatility |
| max_drawdown_30d | NUMERIC | Max decline from peak |

---

## ALX v1 Liquidity Signals

### `alx_signal_config`
Tunable thresholds for signal computation.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Config ID |
| config_key | TEXT | Threshold name |
| config_value | DECIMAL | Threshold value |
| description | TEXT | What it controls |

**Seed Data:**
- rolloff_multiplier: 5 (D > B_prev * 5)
- execution_multiplier: 10 (D < B_prev * 10)
- high_tier_threshold: 1000 (sales volume)
- medium_tier_threshold: 300 (sales volume)

---

### `alx_market_signals_daily`
Canonical daily liquidity signals per card.

| Column | Type | Description |
|--------|------|-------------|
| date | DATE PK | Signal date |
| card_id | BIGINT PK | Card ID |
| console_uid | TEXT | Set identifier |
| sales_volume_365 | DECIMAL | 365-day sales |
| liquidity_baseline | DECIMAL | V / 365 (units/day) |
| liquidity_tier | TEXT | High, Medium, Low |
| rolloff_flag | BOOLEAN | Ghost volatility detected |
| execution_eligible | BOOLEAN | Safe to trade |

---

## Silver Views (Dimension Enrichment)

### `vw_cards_enriched`
Cards with all dimension names resolved.

**Columns:** card_id, card_number, variation, player_name, team_name, set_name, year, manufacturer, sport

**Use Case:** Metabase filtering and card lookup.

---

### `vw_market_enriched`
Market data with full card dimension enrichment.

**Columns:** date, card_id, all prices, sales_volume, player_name, team_name, set_name, year, manufacturer, sport

**Use Case:** Price analysis with card context.

---

### `vw_cards_full`
Complete card view with attributes, grades, and dimensions.

**Columns:** card_id, player_name, team_name, set_name, year, manufacturer, sport, card_types (aggregated), variations (aggregated), best_grade, rookie_card

**Use Case:** Card detail pages.

---

## Gold Views (Analytics)

### `vw_card_metrics_current`
Latest computed metrics for each card.

**Columns:** card_id, metric_date, all price metrics, momentum, volatility, liquidity_score, trend_state, execution_eligible

**Use Case:** Current investment signals.

---

### `vw_card_complete`
Complete card profile with dimensions and current metrics.

**Columns:** All card dimensions + all current metrics joined

**Use Case:** Single query for card detail page.

---

## Index Views

### `vw_index_composition`
Current index composition with live card metrics.

**Columns:** index_id, index_code, card_id, weight, player_name, set_name, momentum, trend_state, liquidity_score

**Use Case:** See what's in an index right now.

---

### `vw_index_performance`
Index performance summary with current metrics.

**Columns:** index_id, index_code, current_value, daily_change_pct, change_30d_pct, volatility_30d, constituent_count

**Use Case:** Index dashboard.

---

### `vw_index_comparison`
Index performance vs market benchmark.

**Columns:** date, index_id, index_code, index_value, index_return, market_avg_return, alpha

**Use Case:** Compare index to overall market.

---

## ALX Signal Views

### `vw_rolloff_alerts`
Roll-off alerts for today (ghost volatility detector).

**Columns:** date, card_id, console_uid, sales_volume_365, units_per_day, rolloff_flag

**Use Case:** "Don't Panic" panel - cards with suspicious volatility.

---

### `vw_execution_eligible`
Execution eligible cards for today (safe to trade).

**Columns:** date, card_id, console_uid, liquidity_tier, units_per_day, yearly_total, execution_eligible

**Use Case:** "Safe to Trade" leaderboard.

---

### `vw_liquidity_distribution`
Liquidity tier distribution over last 30 days.

**Columns:** date, liquidity_tier, asset_count, total_yearly_volume, avg_units_per_day

**Use Case:** Exchange breadth - market health indicator.

---

### `vw_signals_summary`
Daily signal counts for quick health checks.

**Columns:** date, total_cards, eligible_count, rolloff_count, high_tier, medium_tier, low_tier, avg_liquidity, last_computed

**Use Case:** Daily summary dashboard.

---

## Legacy Views

### `card_market_diff`
Delta view using window functions (from base schema).

**Columns:** card_id, console_uid, date, loose_price, sales_volume, loose_price_diff, sales_volume_diff, daily_sales_est

**Use Case:** Day-over-day price and volume changes.

---

## Schema File Reference

| File | Contents |
|------|----------|
| `db/schemas/01-base-schema.sql` | sets_master, cards_raw_ingests, card_market_daily, card_market_diff view |
| `db/schemas/02-normalized-schema.sql` | sports, leagues, manufacturers, teams, players, sets, cards, grading_companies, card_grades, card_types, variations, card_attributes + 3 views |
| `db/schemas/03-core-schema.sql` | card_daily_snapshots, card_computed_metrics + 2 views |
| `db/schemas/04-cards-master-schema.sql` | Legacy cards_master (deprecated) |
| `db/schemas/05-fingerprint-indices-schema.sql` | Fingerprint functions, market_indices, constituents, values + 3 views |
| `db/schemas/06-alx-signals-schema.sql` | alx_signal_config, alx_market_signals_daily |
| `db/schemas/07-views.sql` | ALX views: rolloff_alerts, execution_eligible, liquidity_distribution, signals_summary |

---

## Quick Query Reference

```sql
-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- List all views
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'VIEW'
ORDER BY table_name;

-- Count records per table
SELECT 'cards' as table_name, COUNT(*) as count FROM cards
UNION ALL
SELECT 'card_daily_snapshots', COUNT(*) FROM card_daily_snapshots
UNION ALL
SELECT 'card_computed_metrics', COUNT(*) FROM card_computed_metrics;
```
