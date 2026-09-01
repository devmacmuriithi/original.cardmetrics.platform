# Card Computed Metrics Specification
## Investment-Grade Analytics for Trading Card Price Discovery

---

## Overview

The `card_computed_metrics` table stores **derived analytics** computed from raw daily snapshots. These metrics enable quantitative analysis of card price movements, trend identification, and investment decision-making.

---

## Core Metrics

### 1. PRICE MOMENTUM ⭐ CRITICAL
**Purpose**: Identify accelerating or decelerating price trends

**Formula**:
```sql
momentum = (avg_price_30d - avg_price_90d) / avg_price_90d
```

**Interpretation**:
- `> 0.05` (5%): **Rising** - Price accelerating upward
- `-0.05 to 0.05`: **Stable** - Price in consolidation phase
- `< -0.05` (-5%): **Declining** - Price decelerating

**Business Value**: Early trend detection for entry/exit timing

**Example**:
```
Card A: 30d_avg = $110, 90d_avg = $100
Momentum = (110 - 100) / 100 = 0.10 (10% upward momentum)
→ Trend State: Rising
```

---

### 2. PRICE VOLATILITY ⭐ CRITICAL
**Purpose**: Measure price stability and risk assessment

**Formula**:
```sql
price_stddev_30d = STDDEV(loose_price) OVER 30 days
volatility_score = price_stddev_30d / avg_price_30d  -- Normalized 0-1
```

**Interpretation**:
- `< 0.10`: Low volatility (stable investment)
- `0.10 - 0.25`: Moderate volatility (normal market movement)
- `> 0.25`: High volatility (risky/speculative)

**Business Value**: Risk quantification for portfolio allocation

---

### 3. TREND STATE ⭐ CRITICAL
**Purpose**: Categorize price direction for quick filtering

**Calculation**:
```sql
CASE 
  WHEN momentum > 0.05 THEN 'Rising'
  WHEN momentum < -0.05 THEN 'Declining'
  ELSE 'Stable'
END
```

**Business Value**: Dashboard filtering, automated alerts, portfolio rebalancing

---

### 4. LIQUIDITY SCORE ⭐ CRITICAL
**Purpose**: Assess ease of buying/selling without moving the market

**Formula**:
```sql
sales_velocity = sales_volume_365 / 365  -- Units per day
liquidity_score = LEAST(sales_velocity / 100, 1.0)  -- Capped at 1.0
```

**Interpretation**:
- `> 0.70`: High liquidity (easy to trade)
- `0.30 - 0.70`: Medium liquidity
- `< 0.30`: Low liquidity (difficult to exit)

**Business Value**: Execution confidence, position sizing

---

### 5. EXECUTION ELIGIBILITY ⭐ CRITICAL
**Purpose**: Flag cards safe for immediate trading

**Formula**:
```sql
execution_eligible = (
  liquidity_score >= 0.30 AND     -- Sufficient volume
  volatility_score < 0.50 AND     -- Not too volatile
  days_of_data >= 14              -- Minimum history
)
```

**Business Value**: Pre-trade validation, automated trading systems

---

## Secondary Metrics

### 6. Moving Averages
**Purpose**: Smooth price data for trend analysis

| Metric | Window | Use Case |
|--------|--------|----------|
| avg_price_7d | 7 days | Short-term momentum |
| avg_price_30d | 30 days | Medium-term trend |
| avg_price_90d | 90 days | Long-term baseline |

**Formula**:
```sql
AVG(loose_price) OVER (PARTITION BY card_id ORDER BY date ROWS BETWEEN N PRECEDING AND CURRENT ROW)
```

---

### 7. Price Change Percentages
**Purpose**: Standardized price movement measurement

**Formula**:
```sql
price_change_7d = ((price_today - price_7d_ago) / price_7d_ago) * 100
```

**Available Periods**: 1d, 7d, 30d, 90d

---

### 8. Price Range (30-day)
**Purpose**: Support/resistance levels for technical analysis

**Formula**:
```sql
high_price_30d = MAX(loose_price) OVER 30 days
low_price_30d = MIN(loose_price) OVER 30 days
```

---

### 9. Estimated Market Cap
**Purpose**: Card "market size" for ranking and comparison

**Formula**:
```sql
estimated_market_cap = loose_price * sales_velocity * 365
```

**Interpretation**: Approximate annual dollar volume for the card

---

### 10. Trend Strength
**Purpose**: Confidence level in trend direction

**Formula**:
```sql
trend_strength = ABS(current_price - avg_price_30d) / avg_price_30d
```

**Interpretation**: Higher values = stronger deviation from mean = stronger trend

---

## Priority Matrix

| Metric | Criticality | Use Case | Computation Cost |
|--------|-------------|----------|------------------|
| **Momentum** | ⭐⭐⭐ HIGH | Trend detection, entry signals | Medium (90-day window) |
| **Trend State** | ⭐⭐⭐ HIGH | Dashboard filtering, alerts | Low (derived from momentum) |
| **Liquidity Score** | ⭐⭐⭐ HIGH | Trade execution, position sizing | Low (simple division) |
| **Execution Eligible** | ⭐⭐⭐ HIGH | Pre-trade validation | Low (boolean logic) |
| **Price StdDev** | ⭐⭐⭐ HIGH | Risk assessment, volatility analysis | High (30-day STDDEV) |
| **Moving Averages** | ⭐⭐ MEDIUM | Trend smoothing, baseline calc | Medium (window functions) |
| **Price Changes** | ⭐⭐ MEDIUM | Performance measurement | Low (simple delta) |
| **Price Range** | ⭐⭐ MEDIUM | Support/resistance levels | Low (MIN/MAX) |
| **Market Cap** | ⭐ LOW | Ranking, market sizing | Low (multiplication) |
| **Trend Strength** | ⭐ LOW | Confidence scoring | Low (percentage calc) |

---

## Computation Schedule

| Frequency | Metrics | Purpose |
|-----------|---------|---------|
| **Daily** | All metrics | Complete dataset refresh |
| **Intraday** | Liquidity only | Real-time execution decisions |
| **Weekly** | Momentum, Trend State | Portfolio rebalancing signals |

---

## Query Patterns

### Investment Screening
```sql
-- High-momentum, liquid cards
SELECT * FROM vw_card_metrics_current
WHERE trend_state = 'Rising'
  AND liquidity_score > 0.70
  AND execution_eligible = true
ORDER BY momentum DESC;
```

### Risk Management
```sql
-- Check volatility before large position
SELECT 
  card_id,
  price_stddev_30d,
  CASE 
    WHEN price_stddev_30d / last_sale_price < 0.10 THEN 'Low Risk'
    WHEN price_stddev_30d / last_sale_price < 0.25 THEN 'Medium Risk'
    ELSE 'High Risk'
  END as risk_level
FROM card_computed_metrics
WHERE date = CURRENT_DATE;
```

### Trend Monitoring
```sql
-- Cards transitioning from Stable to Rising
SELECT 
  card_id,
  LAG(trend_state) OVER (PARTITION BY card_id ORDER BY date) as prev_state,
  trend_state as current_state,
  momentum
FROM card_computed_metrics
WHERE trend_state = 'Rising'
  AND LAG(trend_state) OVER (PARTITION BY card_id ORDER BY date) = 'Stable';
```

---

## Data Quality Indicators

| Field | Purpose | Threshold |
|-------|---------|-----------|
| `days_of_data` | Minimum data confidence | ≥ 14 days for momentum calc |
| `last_sale_date` | Stale data detection | Within 30 days |
| `currency` | Price consistency | Always 'USD' |

---

## Schema Reference

```sql
CREATE TABLE card_computed_metrics (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    date DATE NOT NULL,
    
    -- Price metrics
    last_sale_price NUMERIC(12,2),
    last_sale_date DATE,
    currency TEXT DEFAULT 'USD',
    
    -- Moving averages
    avg_price_7d NUMERIC(12,2),
    avg_price_30d NUMERIC(12,2),
    avg_price_90d NUMERIC(12,2),
    
    -- Price changes
    price_change_1d NUMERIC(5,2),
    price_change_7d NUMERIC(5,2),
    price_change_30d NUMERIC(5,2),
    price_change_90d NUMERIC(5,2),
    
    -- Investment-grade signals (CRITICAL)
    momentum NUMERIC(6,3),              -- (30d - 90d) / 90d
    price_stddev_30d NUMERIC(12,2),      -- 30-day volatility
    trend_state TEXT,                    -- Rising, Stable, Declining
    
    -- Liquidity & execution
    liquidity_score NUMERIC(4,2),         -- 0-1 normalized
    sales_velocity NUMERIC(8,2),          -- Units/day
    execution_eligible BOOLEAN,
    
    -- Additional analytics
    high_price_30d NUMERIC(12,2),
    low_price_30d NUMERIC(12,2),
    estimated_market_cap NUMERIC(15,2),
    trend_strength NUMERIC(4,2),
    
    -- Metadata
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    days_of_data INTEGER,
    
    UNIQUE(card_id, date)
);
```

---

## Critical Metrics Summary

**Top 5 Metrics for Investment Decisions**:

1. **Momentum** - Is the price accelerating? (Early entry/exit)
2. **Trend State** - Quick directional filter (Dashboard views)
3. **Liquidity Score** - Can I actually trade this? (Execution confidence)
4. **Execution Eligible** - Safe to proceed? (Pre-trade check)
5. **Price StdDev** - How risky is this? (Position sizing)

These 5 metrics provide 80% of the analytical value for trading decisions.
