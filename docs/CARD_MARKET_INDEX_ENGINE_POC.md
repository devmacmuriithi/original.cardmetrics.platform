# Card Market Index Engine POC
## Technical Specification & Architecture

---

## Executive Summary

The **Card Market Index Engine** is a finance-grade analytics platform that treats sports trading cards as tradable assets. It provides deterministic price discovery, trend analysis, and market signals equivalent to Bloomberg for sports cards.

**Core Value Proposition:**
> *"Treat sports cards like tradable assets and compute market signals the same way finance does."*

---

## 1. What "Index Engine" Means in Practice

An index engine performs 5 critical functions:

| Function | Purpose | Output |
|----------|---------|--------|
| **Normalize Assets** | Same card ≠ many messy listings | `card_fingerprint` |
| **Aggregate Prices** | Raw sales → clean signals | `price_index` |
| **Track Time-Series** | Price over time, not snapshots | `card_daily_snapshots` |
| **Compute Indicators** | Trend, momentum, volatility, liquidity | `card_computed_metrics` |
| **Expose Decisions** | Buy/Hold/Watch signals | Dashboard & Alerts |

**POC Goal:** Prove these 5 functions exist and produce investable insights.

---

## 2. POC Architecture (Lean but Legit)

### A. Data Ingestion Layer

**Goal:** Get raw market truth

**Sources (POC-friendly):**
- SportCardsPro Market API (primary)
- eBay completed sales (optional fallback)
- GemRate (grading + population data)

**Ingested Fields:**
- Sale price (actual transaction price)
- Sale date (timestamp)
- Card fingerprint fields (sport, year, manufacturer, set, card #, variation)
- Grade (PSA 10, BGS 9.5, etc.)
- Grader (PSA, BGS, SGC, etc.)
- Platform (eBay, SportCardsPro, etc.)

**Output Table:** `cards_raw_ingests`
```sql
- ingest_date (partition key)
- console_uid (set identifier)
- card_id (source identifier)
- payload (JSONB with all fields)
```

---

### B. Card Normalization Engine (Critical)

**Problem:** "LeBron 2019 Prizm Silver PSA 10" appears 200 different ways in raw data.

**Solution:** Deterministic `card_fingerprint` generation

**Fingerprint Formula:**
```
sport|year|manufacturer|set|card_number|variation|player_name
```

**Normalization Rules:**
| Input | Normalized |
|-------|-----------|
| `Panini America` | `panini` |
| `PSA Gem Mint 10` | `psa\|10` |
| `Silver Prizm` | `silver_prizm` |
| `LeBron James` | `lebron-james` |

**Example Fingerprint:**
```
basketball|2019|panini|prizm|1|silver|lebron-james
```

**Hash Generation:** SHA256 of fingerprint for deterministic joins
```
c7a3e1c9f1b2... (32-char hex)
```

**Output:** 
- `cards.card_fingerprint` (human-readable)
- `cards.card_fingerprint_hash` (join key)

**Key Insight:** This proves you can **own price discovery**, not just display prices.

---

### C. Price Aggregation Engine

For each `card_fingerprint_hash`, compute:

| Metric | Formula | Use Case |
|--------|---------|----------|
| **Last Sale** | Most recent transaction | Current value estimate |
| **7d VWAP** | Volume-weighted avg (7 days) | Short-term trend |
| **30d VWAP** | Volume-weighted avg (30 days) | Medium-term baseline |
| **90d VWAP** | Volume-weighted avg (90 days) | Long-term trend |
| **30d High** | Max price in window | Resistance level |
| **30d Low** | Min price in window | Support level |
| **Sales Count** | Number of transactions | Liquidity indicator |
| **Avg Days Between Sales** | Time between transactions | Velocity metric |

**Output Table:** `card_daily_snapshots` (fact table)
```sql
- card_id (FK)
- date (partition key)
- loose_price (ungraded)
- graded_price (generic)
- psa10_price (PSA 10 specific)
- sales_volume (365-day rolling)
```

---

### D. Index Metrics (The "Aha")

This is what separates hobby apps from investable analytics.

For each card, compute:

#### 1. Momentum (Early Trend Detection)
```
momentum = (30d_avg - 90d_avg) / 90d_avg
```
**Interpretation:**
- `> 0.05` (5%): **Rising** - Price accelerating upward
- `-0.05 to 0.05`: **Stable** - Price in consolidation
- `< -0.05` (-5%): **Declining** - Price decelerating

#### 2. Volatility (Risk Assessment)
```
volatility = stddev(price, 30d) / avg_price_30d
```
**Interpretation:**
- `< 0.10`: Low volatility (stable investment)
- `0.10 - 0.25`: Moderate volatility (normal market)
- `> 0.25`: High volatility (risky/speculative)

#### 3. Liquidity Score (Execution Confidence)
```
liquidity_score = sales_velocity / 100  (capped at 1.0)
```
**Interpretation:**
- `> 0.70`: High liquidity (easy to trade)
- `0.30 - 0.70`: Medium liquidity
- `< 0.30`: Low liquidity (difficult to exit)

#### 4. Trend State (Quick Filtering)
```
CASE 
  WHEN momentum > 0.05 THEN 'Rising'
  WHEN momentum < -0.05 THEN 'Declining'
  ELSE 'Stable'
END
```

#### 5. Execution Eligible (Pre-Trade Validation)
```
execution_eligible = (
  liquidity_score >= 0.30 AND
  volatility_score < 0.50 AND
  days_of_data >= 14
)
```

**Output Table:** `card_computed_metrics`
```sql
- card_id (FK)
- date (partition key)
- momentum
- price_stddev_30d
- trend_state
- liquidity_score
- execution_eligible
- avg_price_7d / 30d / 90d
- price_change_1d / 7d / 30d / 90d
```

---

### E. Index Grouping (Mini Indices)

**Concept:** Indices of indices - weighted baskets of cards

**Examples:**
| Index Code | Name | Strategy |
|------------|------|----------|
| `NBA-MODERN-001` | Modern NBA Stars Index | Top 30 NBA stars, 2019-2024 |
| `PSA10-BLUE-CHIP` | PSA 10 Blue Chips | Premium graded cards |
| `ROOKIE-PREMIUM` | Rookie Speculation Index | High-momentum rookies |
| `BASKETBALL-CORE` | Basketball Core Market | Broad market representation |
| `PANINI-PRIZM` | Panini Prizm Index | Brand-specific tracking |

**Index Value Formula:**
```
index_value = Σ(card_price × weight)
```

**Weighting Methods:**
- `equal`: Each card = 1/N of index
- `market_cap`: Weight by estimated market cap
- `liquidity_weighted`: Weight by liquidity score
- `momentum_weighted`: Weight by momentum signal

**Tables:**
- `market_indices` (index definitions)
- `market_index_constituents` (membership + weights)
- `market_index_values` (daily computed index time-series)

---

## 3. POC UI (Minimal but Impressive)

### Screen 1: Index Dashboard

**Components:**
- Total index value (base 1000 at inception)
- 7d / 30d / 90d change percentages
- Top 5 movers (biggest gainers/losers)
- Volume spike alerts (unusual trading activity)
- Trend distribution (% Rising / Stable / Declining)

**Query:**
```sql
SELECT * FROM vw_index_performance WHERE is_active = TRUE;
```

---

### Screen 2: Card Detail Page

**Components:**
- Price chart (30d / 90d / 1Y)
- Sales dots on chart (individual transactions)
- Grade distribution (PSA 10: 45%, BGS 9.5: 30%, etc.)
- Liquidity badge (High / Medium / Low)
- Current metrics (Momentum, Volatility, Trend)
- Similar cards comparison

**Query:**
```sql
SELECT * FROM vw_card_complete WHERE card_id = :id;
```

---

### Screen 3: Compare View

**Components:**
- Card vs Card price correlation
- Card vs Index performance
- Divergence alerts (card outperforming/underperforming index)

**Query:**
```sql
SELECT * FROM vw_index_comparison WHERE index_id = :index_id;
```

---

## 4. What Makes This a Real POC (Not a Toy)

**Validation Criteria:**
> "If I bought this card 90 days ago, what signal would I have seen?"

**Checklist:**

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| ✅ Historical backfill | `card_daily_snapshots` (full time-series) | Complete |
| ✅ Deterministic card IDs | `card_fingerprint_hash` (SHA256) | Complete |
| ✅ Time-based recalculation | Daily cron job recomputes metrics | Complete |
| ✅ Metrics update daily | `card_computed_metrics` | Complete |
| ✅ Reproducible index value | `market_index_values` (versioned) | Complete |

**If it can't backtest, it's not an index.**

---

## 5. Tech Stack (Opinionated & POC-Safe)

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | **PostgreSQL** | Primary data store |
| Time-Series | **TimescaleDB** | Efficient time-series queries |
| Search | **Algolia / Typesense** | Instant card search |
| API | **FastAPI / Node.js** | RESTful endpoints |
| Vector Search | **PGVector** | Future semantic similarity |

### Indexing & Search
**Indexed Fields:**
- `player_name` (text search)
- `set_name` (filter)
- `year` (range filter)
- `grade` (filter)
- `trend_state` (filter: Rising/Stable/Declining)
- `card_fingerprint_hash` (exact match joins)

### Jobs & Scheduling
| Job | Frequency | Tool |
|-----|-----------|------|
| Data Ingestion | Daily | Cron / Temporal |
| Metric Computation | Daily | Cron / DB triggers |
| Index Rebalancing | Weekly | Scheduled job |
| VACUUM ANALYZE | Weekly | PostgreSQL maintenance |

---

## 6. Client Expectations

### What POC WILL Prove
✅ Market normalization works (deterministic fingerprints)  
✅ Prices are consistent (VWAP aggregation)  
✅ Trends are meaningful (momentum, volatility signals)  
✅ Cards behave like assets (time-series analysis)  
✅ Indices are investable (backtestable, reproducible)  

### What POC Will NOT Do (Yet)
❌ Real-time trading (requires marketplace integration)  
❌ Perfect pricing (approximate VWAP, not exchange prices)  
❌ Full marketplace coverage (sampled data sources)  
❌ Regulatory compliance (not a financial advisor)  

**This honesty builds trust.**

---

## 7. POC Success Signal

**Win Condition:**
> *"Oh… this looks like Bloomberg for cards."*

**Key Indicators:**
- User recognizes finance-grade presentation
- User asks "Can I see what this card looked like 6 months ago?"
- User requests export to Excel/CSV for further analysis
- User mentions "backtesting" or "signals"

---

## 8. Current Implementation Status

### ✅ Complete
- [x] Card fingerprint system (deterministic, hash-based)
- [x] Normalized dimension tables (players, sets, manufacturers)
- [x] Daily snapshot ingestion pipeline
- [x] Computed metrics (momentum, volatility, liquidity, trend)
- [x] Market index framework (definitions, constituents, values)
- [x] Index views (composition, performance, comparison)
- [x] CLI management tools (populate fingerprints, manage indices)

### 🔄 Next Steps
- [ ] Connect SportCardsPro API for live data
- [ ] Build dashboard UI (React/Vue)
- [ ] Deploy to staging environment
- [ ] Create demo dataset (basketball cards, 90-day history)

---

## 9. Database Schema Summary

### Core Tables
```
cards_raw_ingests (bronze - staging)
card_daily_snapshots (silver - facts)
card_computed_metrics (gold - signals)
```

### Dimension Tables
```
cards (with fingerprints)
players
sets
manufacturers
sports
leagues
teams
grading_companies
```

### Index Tables
```
market_indices (definitions)
market_index_constituents (membership)
market_index_values (time-series)
```

### Views
```
vw_card_complete (full card profile)
vw_card_metrics_current (latest metrics)
vw_index_composition (index holdings)
vw_index_performance (index returns)
vw_index_comparison (benchmark vs market)
```

---

## 10. Quick Start Commands

```bash
# 1. Deploy schema
psql $DATABASE_URL -f fingerprint-and-indices-schema.sql

# 2. Populate fingerprints
node populate-fingerprints.js

# 3. List available indices
node manage-indices.js list

# 4. Add cards to index
node manage-indices.js add-cards NBA-MODERN-001

# 5. Compute index values
node manage-indices.js compute NBA-MODERN-001 2026-01-01 2026-01-31

# 6. Query index performance
psql $DATABASE_URL -c "SELECT * FROM vw_index_performance;"
```

---

## Conclusion

The Card Market Index Engine POC delivers:
- **Deterministic** card identity (fingerprint hashing)
- **Reproducible** price signals (VWAP aggregation)
- **Investable** metrics (momentum, volatility, liquidity)
- **Backtestable** indices (weighted baskets with time-series)

This is not a hobby app. This is finance-grade infrastructure for sports card price discovery.

**Next:** Connect live data sources, deploy dashboard, run 90-day backtest demo.
