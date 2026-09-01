# Database Fields Reference
## Complete Field Listing for All Tables and Views

---

## Bronze Layer

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| Bronze | cards_raw_ingests | Table | id, ingest_date, console_uid, card_id, payload, filename |

---

## Silver Layer - Dimension Tables

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| Silver | sports | Table | id, name, slug, display_order, created_at |
| Silver | leagues | Table | id, sport_id, name, slug, abbreviation, display_order, created_at |
| Silver | manufacturers | Table | id, name, slug, country, website_url, created_at |
| Silver | teams | Table | id, league_id, name, slug, city, abbreviation, logo_url, created_at |
| Silver | players | Table | id, full_name, slug, first_name, last_name, birth_date, position, hall_of_fame, created_at, last_updated |
| Silver | sets | Table | id, console_uid, slug, sport_id, league_id, manufacturer_id, name, year, release_date, total_cards, page_name, url, csv_path, created_at, last_updated |
| Silver | cards | Table | id, set_id, player_id, team_id, sport_id, league_id, manufacturer_id, card_number, variation, rookie_card, psa_pop_report, bgs_pop_report, raw_product_name, raw_console_name, first_seen_date, created_at, last_updated, card_fingerprint, card_fingerprint_hash, fingerprint_version |
| Silver | grading_companies | Table | id, name, slug, abbreviation, website_url, grading_scale, premium_service, created_at |
| Silver | card_grades | Table | id, card_id, grading_company_id, grade, grade_label, subgrades, cert_number, graded_date, population, population_higher, pop_report_url, created_at, last_updated |
| Silver | card_types | Table | id, name, slug, category, description, is_serial_numbered, is_limited, typical_print_run, rarity_multiplier, created_at |
| Silver | variations | Table | id, name, slug, description, color, finish, is_serial_numbered, serial_number, value_multiplier, created_at |
| Silver | card_attributes | Table | id, card_id, card_type_id, variation_id, serial_number, is_rookie_card, is_autographed, has_relic, created_at |

---

## Silver Layer - Views

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| Silver | vw_cards_enriched | View | card_id, card_number, variation, rookie_card, player_id, player_name, first_name, last_name, position, team_id, team_name, team_city, team_abbr, set_id, set_name, year, console_uid, manufacturer_id, manufacturer, league_id, league_name, league_abbr, sport_id, sport |
| Silver | vw_market_enriched | View | date, card_id, loose_price, graded_price, psa10_price, bgs10_price, retail_loose_buy, retail_loose_sell, sales_volume, card_number, variation, rookie_card, player_name, team_name, set_name, year, console_uid, manufacturer, league_name, league_abbr, sport |
| Silver | vw_cards_full | View | card_id, card_number, player_name, first_name, last_name, team_name, team_city, set_name, year, manufacturer, sport, league, card_types, variations, best_grade, rookie_card |

---

## Gold Layer - Fact Tables

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| Gold | card_daily_snapshots | Table | card_id, date, console_uid, console_name, product_name, loose_price, graded_price, psa10_price, bgs10_price, retail_loose_buy, retail_loose_sell, sales_volume, created_at, source_file |
| Gold | card_computed_metrics | Table | id, card_id, date, last_sale_price, last_sale_date, currency, avg_price_7d, avg_price_30d, avg_price_90d, price_change_1d, price_change_7d, price_change_30d, price_change_90d, high_price_30d, low_price_30d, volatility_score, price_stability_index, momentum, price_stddev_30d, trend_state, liquidity_score, sales_velocity, liquidity_tier, execution_eligible, trend_direction, trend_strength, estimated_market_cap, computed_at, days_of_data |

---

## Gold Layer - Views

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| Gold | vw_card_metrics_current | View | card_id, metric_date, last_sale_price, last_sale_date, avg_price_7d, avg_price_30d, avg_price_90d, price_change_1d, price_change_7d, price_change_30d, price_change_90d, high_price_30d, low_price_30d, volatility_score, liquidity_score, sales_velocity, liquidity_tier, execution_eligible, trend_direction, trend_strength, momentum, price_stddev_30d, trend_state, estimated_market_cap, computed_at, days_of_data |
| Gold | vw_card_complete | View | card_id, card_number, rookie_card, player_name, first_name, last_name, team_name, team_city, team_abbr, set_name, year, console_uid, manufacturer, league_name, league_abbr, sport, last_sale_price, last_sale_date, avg_price_7d, avg_price_30d, avg_price_90d, price_change_1d, price_change_7d, price_change_30d, price_change_90d, high_price_30d, low_price_30d, volatility_score, liquidity_score, sales_velocity, liquidity_tier, execution_eligible, trend_direction, trend_strength, momentum, price_stddev_30d, trend_state, estimated_market_cap, metrics_updated |

---

## Indices Layer - Tables

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| Indices | market_indices | Table | index_id, index_code, index_name, index_description, index_type, sport_id, rebalance_frequency, last_rebalanced, next_rebalance, weighting_method, min_liquidity_threshold, max_constituents, created_at, is_active, methodology_version |
| Indices | market_index_constituents | Table | id, index_id, card_id, card_fingerprint_hash, weight, entry_date, exit_date, entry_reason, exit_reason, constituents_version, created_at |
| Indices | market_index_values | Table | id, index_id, date, index_value, index_value_change, index_value_change_pct, constituent_count, avg_constituent_price, total_market_cap, index_volatility_30d, max_drawdown_30d, constituents_version, computed_at |

---

## Indices Layer - Views

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| Indices | vw_index_composition | View | index_id, index_code, index_name, card_id, card_fingerprint, card_fingerprint_hash, weight, entry_date, entry_reason, player_name, year, set_name, manufacturer, last_sale_price, momentum, trend_state, liquidity_score |
| Indices | vw_index_performance | View | index_id, index_code, index_name, index_type, current_value, daily_change_pct, change_30d_pct, volatility_30d, constituent_count, last_updated, is_active |
| Indices | vw_index_comparison | View | date, index_id, index_code, index_value, index_return, market_avg_return, alpha |

---

## ALX Signals Layer - Tables

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| ALX | alx_signal_config | Table | id, config_key, config_value, description, updated_at |
| ALX | alx_market_signals_daily | Table | date, card_id, console_uid, sales_volume_365, liquidity_baseline, liquidity_tier, rolloff_flag, execution_eligible, computed_at |

---

## ALX Signals Layer - Views

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| ALX | vw_rolloff_alerts | View | date, card_id, console_uid, sales_volume_365, units_per_day, rolloff_flag, computed_at |
| ALX | vw_execution_eligible | View | date, card_id, console_uid, liquidity_tier, units_per_day, yearly_total, execution_eligible, computed_at |
| ALX | vw_liquidity_distribution | View | date, liquidity_tier, asset_count, total_yearly_volume, avg_units_per_day |
| ALX | vw_signals_summary | View | date, total_cards, eligible_count, rolloff_count, high_tier, medium_tier, low_tier, avg_liquidity, last_computed |

---

## Legacy Layer

| Layer | Object | Type | Fields (Columns) |
|-------|--------|------|------------------|
| Legacy | sets_master | Table | console_uid, slug, category, page_name, url, csv_path |
| Legacy | card_market_daily | Table | card_id, console_uid, date, console_name, product_name, loose_price, graded_price, psa10_price, bgs10_price, retail_loose_buy, retail_loose_sell, sales_volume, created_at, source_file |
| Legacy | card_market_diff | View | card_id, console_uid, console_name, product_name, date, loose_price, sales_volume, loose_price_diff, sales_volume_diff, daily_sales_est |

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Total Objects | 35 |
| Tables | 21 |
| Views | 14 |
| Total Fields | 350+ |

---

## Field Count by Object

### Tables (sorted by field count)
| Object | Fields |
|--------|--------|
| cards | 20 |
| card_computed_metrics | 29 |
| card_daily_snapshots | 13 |
| card_market_daily | 12 |
| market_index_values | 14 |
| market_indices | 13 |
| sets | 14 |
| market_index_constituents | 11 |
| card_grades | 13 |
| card_attributes | 8 |
| variations | 9 |
| card_types | 9 |
| players | 10 |
| grading_companies | 7 |
| teams | 8 |
| leagues | 7 |
| manufacturers | 6 |
| sports | 5 |
| alx_market_signals_daily | 9 |
| alx_signal_config | 5 |
| cards_raw_ingests | 6 |
| sets_master | 6 |

### Views (sorted by field count)
| Object | Fields |
|--------|--------|
| vw_card_complete | 33 |
| vw_cards_enriched | 22 |
| vw_market_enriched | 20 |
| vw_card_metrics_current | 25 |
| vw_index_composition | 16 |
| vw_cards_full | 15 |
| vw_index_performance | 11 |
| vw_signals_summary | 10 |
| card_market_diff | 11 |
| vw_execution_eligible | 8 |
| vw_rolloff_alerts | 7 |
| vw_index_comparison | 7 |
| vw_liquidity_distribution | 6 |

---

## Common Field Patterns

### ID Fields
- `id` - Primary key (serial/bigserial)
- `card_id` - Card identifier (bigint)
- `*_id` - Foreign key references

### Timestamp Fields
- `created_at` - Record creation time
- `last_updated` - Last modification time
- `computed_at` - Calculation timestamp
- `updated_at` - General update timestamp

### Date Fields
- `date` - Metric/snapshot date
- `ingest_date` - Data ingestion date
- `entry_date` - Index membership start
- `exit_date` - Index membership end
- `release_date` - Set release date
- `birth_date` - Player birth date
- `graded_date` - Card grading date

### Name Fields
- `name` - Display name
- `full_name` - Complete name
- `first_name`, `last_name` - Split names
- `slug` - URL-friendly identifier

### Price Fields (NUMERIC 12,2)
- `loose_price` - Ungraded card price
- `graded_price` - Generic graded price
- `psa10_price` - PSA 10 specific price
- `bgs10_price` - BGS 10 specific price
- `retail_loose_buy` - Retail buy price
- `retail_loose_sell` - Retail sell price
- `last_sale_price` - Last transaction price
- `avg_price_*d` - Moving averages (7d, 30d, 90d)
- `high_price_30d`, `low_price_30d` - Price range

### Metric Fields (NUMERIC 4,2 or 6,4)
- `liquidity_score` - 0-1 scale
- `volatility_score` - 0-1 scale
- `momentum` - Price momentum indicator
- `trend_strength` - 0-1 scale
- `weight` - Index weight (0-1)

### Boolean Flags
- `is_active` - Active status
- `is_authenticated` - Auth status
- `execution_eligible` - Trading eligibility
- `rolloff_flag` - Volatility alert
- `rookie_card` - Rookie designation
- `hall_of_fame` - HOF status
- `premium_service` - Premium tier
- `is_serial_numbered` - Limited edition

### JSONB Fields
- `payload` - Raw CSV data
- `subgrades` - Grading sub-scores

---

## Schema File Locations

| Schema File | Contains |
|-------------|----------|
| `db/schemas/01-base-schema.sql` | sets_master, cards_raw_ingests, card_market_daily |
| `db/schemas/02-normalized-schema.sql` | All dimension tables + 3 views |
| `db/schemas/03-core-schema.sql` | card_daily_snapshots, card_computed_metrics + 2 views |
| `db/schemas/04-cards-master-schema.sql` | Legacy cards_master |
| `db/schemas/05-fingerprint-indices-schema.sql` | Indices tables + 3 views |
| `db/schemas/06-alx-signals-schema.sql` | ALX tables |
| `db/schemas/07-views.sql` | ALX views |
