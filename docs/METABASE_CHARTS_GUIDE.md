# Metabase Chart Creation Guide for card_computed_metrics

This guide provides step-by-step instructions for creating analytics charts in Metabase using the `card_computed_metrics` table.

---

## Prerequisites

1. Connect Metabase to your PostgreSQL database
2. Ensure `card_computed_metrics` table is populated with data
3. Navigate to: **New** → **Question** in Metabase

---

## Chart 1: Price Trend Over Time (Line Chart)

**Purpose:** Track how a card's price evolves over time

### Steps:
1. **Data Source:** Select `card_computed_metrics` table
2. **Filters:**
   - Add filter: `product_name` = "LeBron James Rookie Card" (or any card)
   - Add filter: `date` between last 90 days
3. **Summarize:** 
   - No summarization needed (raw data)
4. **Visualization:**
   - Click **Visualization** → Select **Line**
   - X-axis: `date`
   - Y-axis: `loose_price`
5. **Add Multiple Lines:**
   - Click **Add series**
   - Add `graded_price` as second line
   - Add `psa10_price` as third line
6. **Customize:**
   - Settings → Line colors (blue, green, gold)
   - Enable data labels
   - Title: "Price Evolution - [Card Name]"

---

## Chart 2: Price Change Distribution (Bar Chart)

**Purpose:** Show top gainers/losers for a specific date

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `date` = "2026-01-24" (specific date)
   - `price_change_pct` is not null
3. **Summarize:**
   - No summarization (show individual cards)
4. **Sort:**
   - Order by `price_change_pct` descending
   - Limit: 20 rows
5. **Visualization:**
   - Select **Bar** chart
   - X-axis: `product_name`
   - Y-axis: `price_change_pct`
6. **Customize:**
   - Settings → Conditional formatting
   - Green bars for positive values
   - Red bars for negative values
   - Rotate X-axis labels 45°
   - Title: "Top 20 Price Movers - Jan 24"

---

## Chart 3: Volatility vs Return Scatter Plot

**Purpose:** Identify risk-return profile of cards

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `date` = "2026-01-24"
   - `loose_price_volatility` is not null
   - `price_change_pct` is not null
3. **Summarize:**
   - No summarization
4. **Visualization:**
   - Select **Scatter** plot
   - X-axis: `loose_price_volatility` (Risk)
   - Y-axis: `price_change_pct` (Return)
   - Bubble size: `sales_volume`
   - Label: `product_name`
5. **Customize:**
   - Add quadrant lines (X=0, Y=0)
   - Color by `trend_state`
   - Title: "Risk-Return Analysis"
   - Add tooltip showing card details

---

## Chart 4: Trend State Distribution (Pie Chart)

**Purpose:** Show market sentiment breakdown

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `date` = "2026-01-24"
   - `trend_state` is not null
3. **Summarize:**
   - Group by: `trend_state`
   - Count: rows
4. **Visualization:**
   - Select **Pie** chart
   - Dimension: `trend_state`
   - Metric: Count
5. **Customize:**
   - Colors: Green (Rising), Red (Declining), Gray (Stable)
   - Show percentages
   - Title: "Market Sentiment - Jan 24"

---

## Chart 5: Liquidity Heatmap

**Purpose:** Visualize trading activity across cards

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `date` = "2026-01-24"
   - `sales_volume` > 0
3. **Summarize:**
   - Group by: `console_name` (set name)
   - Average: `sales_volume`
   - Count: rows
4. **Visualization:**
   - Select **Table**
   - Columns: `console_name`, `Average of sales_volume`, `Count`
5. **Customize:**
   - Settings → Conditional formatting
   - Heatmap on `Average of sales_volume`
   - Color scale: White → Blue → Dark Blue
   - Sort by volume descending
   - Title: "Set Liquidity Rankings"

---

## Chart 6: Price Position Gauge

**Purpose:** Show where current price sits in 7-day range

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `product_name` = specific card
   - `date` = latest date
3. **Summarize:**
   - No summarization
4. **Visualization:**
   - Select **Gauge** (or **Progress**)
   - Value: `price_position_7d`
   - Min: 0
   - Max: 100
5. **Customize:**
   - Goal line at 50 (midpoint)
   - Green zone: 0-30 (near low)
   - Red zone: 70-100 (near high)
   - Title: "Price Position in 7d Range"

---

## Chart 7: Graded Premium Analysis (Grouped Bar)

**Purpose:** Compare pricing across grading tiers

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `date` = "2026-01-24"
   - `loose_price` is not null
   - Limit to top 10 cards by value
3. **Summarize:**
   - No summarization
4. **Visualization:**
   - Select **Bar** chart (grouped)
   - X-axis: `product_name`
   - Y-axis: Multiple metrics
     - `loose_price`
     - `graded_price`
     - `psa10_price`
     - `bgs10_price`
5. **Customize:**
   - Stack: Side-by-side (not stacked)
   - Colors: Gray, Blue, Gold, Silver
   - Legend: Show
   - Title: "Price by Grade Tier"

---

## Chart 8: Volume Trend (Area Chart)

**Purpose:** Track trading volume over time

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `console_name` = specific set
   - `date` between last 30 days
3. **Summarize:**
   - Group by: `date`
   - Sum: `sales_volume`
4. **Visualization:**
   - Select **Area** chart
   - X-axis: `date`
   - Y-axis: `Sum of sales_volume`
5. **Customize:**
   - Fill opacity: 60%
   - Color: Blue gradient
   - Show trend line
   - Title: "Trading Volume - Last 30 Days"

---

## Chart 9: Price Range Bands (Combo Chart)

**Purpose:** Show price with high/low bands

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `card_id` = specific card
   - `date` between last 60 days
3. **Summarize:**
   - No summarization
4. **Visualization:**
   - Select **Combo** chart
   - X-axis: `date`
   - Line 1: `loose_price` (solid line)
   - Line 2: `high_30d` (dashed, upper band)
   - Line 3: `low_30d` (dashed, lower band)
5. **Customize:**
   - Fill area between high/low
   - Colors: Price (blue), Bands (gray)
   - Title: "Price with 30d Range Bands"

---

## Chart 10: Top Cards Dashboard Table

**Purpose:** Comprehensive card metrics table

### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Filters:**
   - `date` = "2026-01-24"
   - `loose_price` > 10
3. **Summarize:**
   - No summarization
4. **Columns to Show:**
   - `product_name`
   - `loose_price`
   - `psa10_price`
   - `price_change_pct`
   - `sales_volume`
   - `trend_state`
   - `loose_price_volatility`
5. **Visualization:**
   - Select **Table**
6. **Customize:**
   - Conditional formatting:
     - `price_change_pct`: Green (+), Red (-)
     - `trend_state`: Color badges
   - Sort by `price_change_pct` descending
   - Add mini sparklines (if available)
   - Title: "Card Performance Summary"

---

## Date-Independent Charts (No Date Filter Required)

These charts use the latest data or aggregates across all dates automatically.

---

### Chart 11: Overall Market Sentiment (Pie Chart)

**Purpose:** Current market sentiment distribution (no date filter needed)

#### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Summarize:**
   - Filter: `date` = Latest date (use MAX function)
   - Group by: `trend_state`
   - Count: rows
3. **Custom SQL Approach:**
   ```sql
   SELECT 
     trend_state,
     COUNT(*) as card_count
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
     AND trend_state IS NOT NULL
   GROUP BY trend_state
   ```
4. **Visualization:**
   - Select **Pie** chart
   - Dimension: `trend_state`
   - Metric: `card_count`
5. **Customize:**
   - Auto-updates with latest data
   - No date filter needed
   - Title: "Current Market Sentiment"

---

### Chart 12: Top Sets by Average Price (Bar Chart)

**Purpose:** Which sets have highest average card values

#### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Summarize:**
   - Group by: `console_name`
   - Average: `loose_price`
   - Count: rows (as card_count)
3. **Filters:**
   - `loose_price` > 0
   - Having: `card_count` > 10 (sets with enough data)
4. **Sort:**
   - Order by Average descending
   - Limit: 20
5. **Visualization:**
   - Select **Bar** chart (horizontal)
   - X-axis: Average of `loose_price`
   - Y-axis: `console_name`
6. **Customize:**
   - Shows all-time averages
   - No date filter needed
   - Title: "Top 20 Sets by Average Card Value"

---

### Chart 13: Volatility Distribution (Histogram)

**Purpose:** How many cards fall into each volatility bucket

#### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Custom SQL:**
   ```sql
   SELECT 
     CASE 
       WHEN loose_price_volatility < 0.05 THEN 'Very Low (0-5%)'
       WHEN loose_price_volatility < 0.10 THEN 'Low (5-10%)'
       WHEN loose_price_volatility < 0.20 THEN 'Medium (10-20%)'
       WHEN loose_price_volatility < 0.30 THEN 'High (20-30%)'
       ELSE 'Very High (30%+)'
     END as volatility_bucket,
     COUNT(*) as card_count
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
     AND loose_price_volatility IS NOT NULL
   GROUP BY volatility_bucket
   ORDER BY 
     CASE volatility_bucket
       WHEN 'Very Low (0-5%)' THEN 1
       WHEN 'Low (5-10%)' THEN 2
       WHEN 'Medium (10-20%)' THEN 3
       WHEN 'High (20-30%)' THEN 4
       ELSE 5
     END
   ```
3. **Visualization:**
   - Select **Bar** chart
   - X-axis: `volatility_bucket`
   - Y-axis: `card_count`
4. **Customize:**
   - Color gradient: Green → Yellow → Red
   - No date filter needed
   - Title: "Card Volatility Distribution"

---

### Chart 14: Liquidity Tiers (Donut Chart)

**Purpose:** Distribution of cards by trading volume

#### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Custom SQL:**
   ```sql
   SELECT 
     CASE 
       WHEN sales_volume >= 1000 THEN 'High Volume (1000+)'
       WHEN sales_volume >= 500 THEN 'Medium Volume (500-999)'
       WHEN sales_volume >= 100 THEN 'Low Volume (100-499)'
       ELSE 'Very Low Volume (<100)'
     END as volume_tier,
     COUNT(*) as card_count
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
     AND sales_volume IS NOT NULL
   GROUP BY volume_tier
   ```
3. **Visualization:**
   - Select **Donut** chart
   - Dimension: `volume_tier`
   - Metric: `card_count`
4. **Customize:**
   - Colors: Dark Blue → Light Blue
   - Show percentages
   - No date filter needed
   - Title: "Cards by Trading Volume"

---

### Chart 15: Price Range Comparison (Box Plot / Table)

**Purpose:** Compare price ranges across sets

#### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Summarize:**
   - Group by: `console_name`
   - Min: `loose_price`
   - Average: `loose_price`
   - Max: `loose_price`
   - Count: rows
3. **Filters:**
   - Having: Count > 20 (sets with enough cards)
4. **Sort:**
   - Order by Average descending
   - Limit: 15
5. **Visualization:**
   - Select **Table** with conditional formatting
   - Or use **Row** chart showing min/avg/max
6. **Customize:**
   - Heatmap on Average column
   - No date filter needed
   - Title: "Price Ranges by Set"

---

### Chart 16: Grading Premium Leaders (Bar Chart)

**Purpose:** Which cards have highest PSA 10 premium over loose

#### Steps:
1. **Data Source:** Custom SQL
2. **Query:**
   ```sql
   SELECT 
     product_name,
     console_name,
     loose_price,
     psa10_price,
     ROUND(
       ((psa10_price - loose_price) / NULLIF(loose_price, 0) * 100)::numeric,
       1
     ) as premium_pct
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
     AND psa10_price IS NOT NULL
     AND loose_price > 10
     AND psa10_price > loose_price
   ORDER BY premium_pct DESC
   LIMIT 20
   ```
3. **Visualization:**
   - Select **Bar** chart
   - X-axis: `product_name`
   - Y-axis: `premium_pct`
4. **Customize:**
   - Color: Gold gradient
   - Show values on bars
   - No date filter needed
   - Title: "Top 20 Grading Premium Opportunities"

---

### Chart 17: Set Performance Summary (Number Cards)

**Purpose:** Key metrics dashboard - no date needed

#### Steps:
1. **Create 4 separate Number visualizations:**

   **Total Cards Tracked:**
   ```sql
   SELECT COUNT(DISTINCT card_id)
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
   ```

   **Average Card Value:**
   ```sql
   SELECT ROUND(AVG(loose_price)::numeric, 2)
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
     AND loose_price > 0
   ```

   **Cards Trending Up:**
   ```sql
   SELECT COUNT(*)
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
     AND trend_state = 'Rising'
   ```

   **Total Market Volume:**
   ```sql
   SELECT SUM(sales_volume)::bigint
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
   ```

2. **Visualization:**
   - Each as **Number** card
   - Large font, centered
3. **Arrange:**
   - 4 cards in a row at top of dashboard
   - Auto-updates with latest data

---

### Chart 18: All-Time Price Leaders (Leaderboard Table)

**Purpose:** Highest value cards across all time

#### Steps:
1. **Data Source:** Custom SQL
2. **Query:**
   ```sql
   SELECT 
     product_name,
     console_name,
     MAX(loose_price) as peak_price,
     MAX(psa10_price) as peak_psa10,
     MAX(sales_volume) as peak_volume,
     MAX(date) as last_seen
   FROM card_computed_metrics
   WHERE loose_price > 0
   GROUP BY product_name, console_name
   ORDER BY peak_price DESC
   LIMIT 50
   ```
3. **Visualization:**
   - Select **Table**
4. **Customize:**
   - Conditional formatting on prices
   - Mini bar charts in cells
   - No date filter needed
   - Title: "All-Time Price Leaders"

---

### Chart 19: Set Count by Sport/Category (Treemap)

**Purpose:** Visual breakdown of set distribution

#### Steps:
1. **Data Source:** `card_computed_metrics`
2. **Summarize:**
   - Group by: `console_name`
   - Count: DISTINCT `card_id`
3. **Visualization:**
   - Select **Treemap** (if available) or **Pie**
   - Dimension: `console_name`
   - Size: Count of cards
4. **Customize:**
   - Color by count (gradient)
   - Show top 30 sets
   - No date filter needed
   - Title: "Card Distribution by Set"

---

### Chart 20: Correlation Matrix (Heatmap Table)

**Purpose:** Show relationships between metrics

#### Steps:
1. **Data Source:** Custom SQL
2. **Query:**
   ```sql
   SELECT 
     CORR(loose_price, sales_volume) as price_volume_corr,
     CORR(loose_price_volatility, sales_volume) as volatility_volume_corr,
     CORR(psa10_price, loose_price) as psa10_loose_corr,
     CORR(loose_price_volatility, loose_price_liquidity) as vol_liq_corr
   FROM card_computed_metrics
   WHERE date = (SELECT MAX(date) FROM card_computed_metrics)
     AND loose_price IS NOT NULL
     AND sales_volume IS NOT NULL
   ```
3. **Visualization:**
   - Format as **Table** with heatmap
   - Or create separate **Number** cards
4. **Customize:**
   - Color scale: -1 (red) → 0 (white) → 1 (green)
   - No date filter needed
   - Title: "Metric Correlations"

---

## Creating a Dashboard

### Steps:
1. **Create Dashboard:**
   - Click **New** → **Dashboard**
   - Name: "Trading Card Analytics"

2. **Add Charts:**
   - Click **Add a question**
   - Select saved questions (charts above)
   - Arrange in grid layout

3. **Suggested Layout:**
   ```
   Row 1: [Price Trend (wide)] [Price Position Gauge]
   Row 2: [Top Movers Bar] [Trend State Pie]
   Row 3: [Risk-Return Scatter (wide)]
   Row 4: [Volume Trend] [Liquidity Heatmap]
   Row 5: [Performance Table (full width)]
   ```

4. **Add Filters:**
   - Dashboard-level filter: `date`
   - Dashboard-level filter: `console_name` (set)
   - Link filters to all relevant charts

5. **Auto-refresh:**
   - Settings → Auto-refresh: Every 1 hour
   - Enable for live monitoring

---

## Advanced: Custom SQL Questions

For complex analytics, use **Native Query**:

### Example: 7-Day Moving Average
```sql
SELECT 
  date,
  product_name,
  loose_price,
  AVG(loose_price) OVER (
    PARTITION BY card_id 
    ORDER BY date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as ma_7d
FROM card_computed_metrics
WHERE card_id = {{card_id}}
ORDER BY date;
```

### Example: Grading Premium %
```sql
SELECT 
  product_name,
  loose_price,
  psa10_price,
  ROUND(
    ((psa10_price - loose_price) / NULLIF(loose_price, 0) * 100)::numeric, 
    2
  ) as grading_premium_pct
FROM card_computed_metrics
WHERE date = {{date}}
  AND psa10_price IS NOT NULL
  AND loose_price > 0
ORDER BY grading_premium_pct DESC
LIMIT 20;
```

---

## Tips for Better Metabase Charts

1. **Use Variables:** Create dashboard filters with `{{variable}}` syntax
2. **Color Consistency:** Use same colors across charts (green=up, red=down)
3. **Tooltips:** Enable detailed tooltips showing all metrics
4. **Drill-through:** Link charts to detail views
5. **Alerts:** Set up alerts for price changes > 10%
6. **Sharing:** Generate public links or embed in websites
7. **Caching:** Enable caching for large datasets
8. **Mobile:** Test dashboard on mobile view

---

## Common Metabase Formulas

### Custom Columns:
- **Grading Premium:** `([psa10_price] - [loose_price]) / [loose_price] * 100`
- **Price Momentum:** `[price_change_pct] * [sales_volume]`
- **Volatility Rank:** `case([loose_price_volatility] > 0.2, "High", [loose_price_volatility] > 0.1, "Medium", "Low")`

### Filters:
- **Recent Data:** `[date] = relative-datetime(-1, day)`
- **High Volume:** `[sales_volume] > 1000`
- **Trending Up:** `[trend_state] = "Rising"`

---

This guide covers the most valuable charts for trading card analytics in Metabase!
