# Market Intelligence Dashboard

## Overview

The Market Intelligence section provides advanced analytics by combining **SportsCard Pro pricing data** with **GemRate grading statistics** from the `matched_G78842.csv` report. This creates powerful insights for investment opportunities, grading decisions, and market efficiency analysis.

## Data Source

- **Source File**: `matched_G78842.csv` (9,134 cards)
- **Database Table**: `matched_cards_final`
- **Data Combines**:
  - SportsCard Pro: Pricing, sales volume, market trends
  - GemRate: Gem rates, grading population, PSA grade distribution

## Analytics Features

### 1. **Investment Opportunities** 🎯
Ranks cards by investment potential using a composite score:

**Scoring Algorithm**:
- **40 points**: Grading difficulty (lower gem rate = higher score)
- **30 points**: Grade premium multiplier (PSA 10 vs raw price)
- **30 points**: Grading momentum (30-day trend)
- **Bonus**: Liquidity factor (sales volume)

**Opportunity Types**:
- **Grading Arbitrage**: Low gem rate (<15%) + high premium (>10x)
- **Rising Star**: Positive momentum + low population (<500 graded)
- **Undervalued Gem**: High volume + low price + high PSA 10 value
- **Improving Quality**: Increasing gem rates month-over-month

**Risk Levels**:
- High Risk: <100 total graded
- Medium Risk: 100-500 graded
- Low Risk: >500 graded

### 2. **Grading Intelligence** 📜
Expected value calculations for grading decisions:

**Metrics**:
- **Expected Value**: (PSA 10 price - Raw price - $25 grading cost) × Gem rate
- **Net Profit if Gem**: Potential profit if card grades PSA 10
- **Grading Difficulty**: Classification based on gem rate
  - Extremely Difficult: <10%
  - Very Difficult: 10-20%
  - Difficult: 20-30%
  - Moderate: 30-40%
  - Easy: >40%

**Grading Trends**:
- Surging: >30% momentum
- Hot: 10-30% momentum
- Rising: 0-10% momentum
- Cooling: -10-0% momentum
- Cold/Frozen: <-10% momentum

**Recommendations**:
- Strong Buy for Grading: EV > $50
- Good Grading Candidate: EV $20-$50
- Marginal: EV $0-$20
- Not Recommended: EV < $0

### 3. **Market Efficiency** ⚖️
Analyzes pricing efficiency vs expected premiums:

**Expected Premium Multipliers** (based on gem rate):
- <15% gem rate → 15x expected premium
- 15-25% gem rate → 10x expected premium
- 25-35% gem rate → 7x expected premium
- >35% gem rate → 5x expected premium

**Efficiency Classifications**:
- **Efficient**: Actual premium within ±2x of expected
- **Overpriced**: Actual > Expected + 2x
- **Underpriced**: Actual < Expected - 2x

**Market Signals**:
- **Strong Buy**: Underpriced by >3x + high volume (>200 sales)
- **Buy**: Underpriced by >1x
- **Sell**: Overpriced by >3x
- **Hold**: Within normal range

### 4. **Player Profiles** 👤
Player-level grading statistics across all parallels:

**Metrics**:
- Average gem rate across all parallels
- Gem rate variance (consistency)
- Average grade premium
- Total cards graded
- Market activity level

**Player Classifications**:
- **Grading Profile**: Difficult/Moderate/Easy to Grade
- **Market Tier**: Superstar/Star/Starter/Bench (by sales volume)
- **Investment Rating**: Premium/Good/Liquid/Speculative

### 5. **Opportunity Alerts** 🔔
Real-time signals based on multiple factors:

**Alert Types**:
- **HOT**: Surging momentum (>30%) + increasing grading activity
- **ARBITRAGE**: Low gem rate (<15%) + high premium (>12x)
- **QUALITY**: Improving gem rate (>10% increase month-over-month)
- **POPULATION**: High grading activity (>100/month) + low total pop (<500)
- **WARNING**: Cooling market (<-30% momentum)
- **VALUE**: High volume (>800 sales) + low price (<$15)
- **FRESH**: Recent PSA 10 within last 7 days

**Priority Levels**:
- **Critical**: Momentum >40% OR (gem rate <12% AND premium >15x)
- **High**: Momentum >25% OR gem rate <18%
- **Medium**: Momentum >10% OR grading activity >80/month
- **Low**: All other alerts

### 6. **Parallel Performance** 📊
Compares parallel variants within sets:

**Metrics**:
- Average gem rate by parallel
- Average grade premium
- Expected ROI: (PSA 10 - Raw - $25) × Gem rate
- Grading value recommendation

**Price Tiers**:
- Premium: >$50 raw
- Mid-Tier: $20-$50 raw
- Base: <$20 raw

## Database Views

All analytics are powered by SQL views:

1. `vw_investment_opportunities` - Top investment rankings
2. `vw_grading_intelligence` - Grading EV calculations
3. `vw_market_efficiency` - Pricing efficiency analysis
4. `vw_player_grading_profiles` - Player-level statistics
5. `vw_opportunity_alerts` - Real-time opportunity signals
6. `vw_parallel_performance` - Parallel comparison metrics

## API Endpoints

```
GET /api/intelligence/opportunities?limit=50&minScore=0
GET /api/intelligence/grading?limit=100&minExpectedValue=0
GET /api/intelligence/market-efficiency?limit=100&signal=Buy
GET /api/intelligence/player-profiles?search=LeBron&limit=50
GET /api/intelligence/alerts?priority=Critical&limit=100
GET /api/intelligence/parallel-performance?console_name=Prizm&limit=50
GET /api/intelligence/stats
```

## Setup Instructions

### 1. Create Database Table
```bash
node create_matched_table.js
```

### 2. Import Matched Data
```bash
node import_matched_cards.js --csv matched_G78842.csv
```

### 3. Create Analytics Views
```bash
node create_intelligence_views.js
```

### 4. Start Server
```bash
node server.js
```

### 5. Access Dashboard
Navigate to: `http://localhost:3002/intelligence/opportunities`

## Use Cases

### For Investors
- Identify undervalued cards with high grading potential
- Find arbitrage opportunities (low gem rate + high premium)
- Track market momentum and timing

### For Graders
- Calculate expected value before submitting cards
- Identify which cards are worth grading
- Understand grading difficulty by player/parallel

### For Traders
- Spot market inefficiencies (mispriced cards)
- Monitor liquidity and sales volume
- Track player popularity trends

### For Collectors
- Understand rarity (gem rates) by parallel
- Compare player grading profiles
- Stay informed on fresh PSA 10s

## Key Insights from Data

Based on the 9,134 matched cards:

- **Average Gem Rate**: ~25% (varies significantly by parallel)
- **Average PSA 10 Premium**: ~8-10x raw price
- **Hardest to Grade**: Certain parallels <15% gem rate
- **Best ROI**: Cards with <20% gem rate + >10x premium + high volume

## Future Enhancements

Potential additions:
- Historical tracking of gem rates over time
- Predictive modeling for future gem rates
- Set-level intelligence aggregations
- Custom alert notifications
- Export functionality for reports
- Integration with live pricing APIs

## Notes

- All percentages and statistics are based on PSA grading data
- Expected values assume $25 grading cost (adjust as needed)
- Market signals are informational only, not financial advice
- Data freshness depends on source CSV update frequency
