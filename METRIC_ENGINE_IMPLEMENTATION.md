# Comprehensive Metric Engine Implementation

## ✅ Completed - Backend APIs

### 1. Enhanced `/api/cards` Endpoint
**Status:** ✅ Complete

**Features:**
- Returns 50+ metrics per card across 5 intelligence domains
- Supports advanced filtering:
  - `trendState` - Rising/Stable/Declining
  - `minLiquidity` / `maxLiquidity` - Liquidity score range
  - `minMomentum` / `maxMomentum` - Momentum range
  - `minOpportunity` / `maxOpportunity` - Opportunity score range
  - `riskLevel` - Risk classification
  - `search` - Text search

**Metrics Returned:**

#### Price Intelligence
- `trend_slope_7d` - 7-day trend slope (%)
- `trend_slope_30d` - 30-day trend slope (%)
- `trend_slope_90d` - 90-day trend slope (%)
- `volatility_regime` - Low/Medium/High classification
- `fair_value_deviation_pct` - % over/underpriced vs 30d avg
- `volatility_ratio` - Normalized volatility (0-1)

#### Liquidity Intelligence
- `days_to_liquidity` - Estimated days to sell
- `weekly_sales_velocity` - Comparable sales per week
- `spread_proxy_pct` - Bid-ask spread estimate
- `liquidity_score` - 0-1 liquidity rating
- `sales_velocity` - Daily sales rate

#### Grade Intelligence
- `psa10_premium_pct` - PSA 10 premium over raw (%)
- `grading_expected_value` - Net EV after grading costs
- Premium stability (via historical data)

#### Opportunity Scoring
- `opportunity_score` - Unified 0-100 score weighted:
  - 30 points: Undervaluation
  - 25 points: Momentum
  - 25 points: Liquidity
  - 20 points: Low volatility bonus

#### Risk Metrics
- `drawdown_risk_pct` - Max drawdown from 30d high
- `trend_break_risk` - High/Medium/Low
- `data_confidence_score` - 0-100 based on sample size & freshness
- `volatility_regime` - Risk classification

### 2. Enhanced `/api/cards/:id` Endpoint
**Status:** ✅ Complete

**Features:**
- Full metric dashboard for individual cards
- All 5 intelligence domains
- Historical data with metrics over time
- Same comprehensive metrics as list endpoint

## 🔄 In Progress - Frontend Implementation

### Cards List Page
**Status:** Partially complete (existing basic version)
**Needs:**
- ✅ Metric columns in table (opportunity score, trend, liquidity)
- ✅ Advanced filter panel with all metric filters
- ✅ Sort by opportunity score, momentum, liquidity
- ⏳ Visual indicators (badges, color coding)
- ⏳ Metric tooltips/explanations

### Card Detail Page
**Status:** Existing basic version
**Needs:**
- ⏳ 5-domain metric dashboard layout
- ⏳ Price Intelligence panel with trend slopes & fair value
- ⏳ Liquidity Intelligence panel with days-to-liquidity
- ⏳ Grade Intelligence panel with premium analysis
- ⏳ Opportunity Score gauge (0-100)
- ⏳ Risk Metrics panel with confidence scores
- ⏳ Historical metric charts

## 📋 Next Steps

### Priority 1: Update Cards List Display
1. Add metric columns to cards table
2. Implement advanced filter panel
3. Add visual metric indicators
4. Enable sorting by metrics

### Priority 2: Create Card Detail Dashboard
1. Design 5-panel metric layout
2. Implement each intelligence domain panel
3. Add opportunity score gauge
4. Create metric trend charts

### Priority 3: Documentation
1. User guide for metric interpretation
2. Metric calculation formulas
3. Filter usage examples

## 🎯 Metric Calculation Formulas

### Opportunity Score (0-100)
```
Score = MIN(100, MAX(0,
  Undervaluation (0-30) +
  Momentum (0-25) +
  Liquidity (0-25) +
  Low Volatility Bonus (0-20)
))

Where:
- Undervaluation = -1 * (current_price - avg_30d) / avg_30d * 100
- Momentum = momentum * 100 (capped at 25)
- Liquidity = liquidity_score * 25
- Volatility Bonus = 20 - (stddev_30d / avg_30d * 100)
```

### Days to Liquidity
```
days_to_liquidity = 1 / sales_velocity
```

### Fair Value Deviation
```
fair_value_deviation = (current_price - avg_30d) / avg_30d * 100
```

### Grading Expected Value
```
grading_ev = psa10_price - loose_price - grading_cost - shipping
(Assuming $30 total cost)
```

### Data Confidence Score
```
IF sales_volume >= 100 AND data_age <= 30 days: 95
ELSE IF sales_volume >= 50 AND data_age <= 30 days: 80
ELSE IF sales_volume >= 20 AND data_age <= 60 days: 60
ELSE IF sales_volume >= 10: 40
ELSE: 20
```

## 🔍 Filter Examples

### High Opportunity Cards
```
GET /api/cards?minOpportunity=70&trendState=Rising&minLiquidity=0.5
```

### Low Risk, High Liquidity
```
GET /api/cards?maxMomentum=0.1&minLiquidity=0.7&riskLevel=Low
```

### Undervalued with Momentum
```
GET /api/cards?minMomentum=0.05&trendState=Rising&minOpportunity=60
```

## 📊 Sample API Response

```json
{
  "cards": [{
    "card_id": 12345,
    "product_name": "LeBron James Prizm",
    "console_name": "2019-20 Prizm",
    "loose_price": 125.50,
    "psa10_price": 450.00,
    
    // Price Intelligence
    "trend_slope_7d": 2.5,
    "trend_slope_30d": 5.2,
    "trend_slope_90d": 8.1,
    "volatility_regime": "Low Volatility",
    "fair_value_deviation_pct": -3.2,
    
    // Liquidity Intelligence
    "days_to_liquidity": 12.5,
    "weekly_sales_velocity": 5.6,
    "spread_proxy_pct": 4.2,
    "liquidity_score": 0.75,
    
    // Grade Intelligence
    "psa10_premium_pct": 258.6,
    "grading_expected_value": 294.50,
    
    // Opportunity Score
    "opportunity_score": 78,
    
    // Risk Metrics
    "drawdown_risk_pct": 5.2,
    "trend_break_risk": "Low",
    "data_confidence_score": 95
  }],
  "total": 1247,
  "limit": 50,
  "offset": 0
}
```

## 🚀 Usage

### Backend
All endpoints are live and ready to use. The metric engine runs on existing `card_computed_metrics` table data.

### Frontend
Existing cards.js needs enhancement to display new metrics. Card detail page needs full rebuild with 5-domain dashboard.

## 📝 Notes

- All metrics computed server-side for performance
- Metrics cached in `card_computed_metrics` table (updated daily)
- Opportunity score is investor-focused composite metric
- Data confidence score helps users assess metric reliability
- All percentage changes use consistent calculation methods
