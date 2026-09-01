-- ============================================================================
-- MARKET INTELLIGENCE VIEWS
-- Advanced analytics based on matched_cards_final (SPC + GemRate data)
-- ============================================================================

-- ============================================================================
-- 1. INVESTMENT OPPORTUNITIES
-- ============================================================================

DROP VIEW IF EXISTS vw_investment_opportunities CASCADE;

CREATE VIEW vw_investment_opportunities AS
WITH card_metrics AS (
  SELECT 
    id,
    player_name,
    parallel,
    card_number,
    console_name,
    loose_price,
    bgs_10_price,
    sales_volume,
    
    -- Convert percentages to decimals
    CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100 as gem_rate,
    CAST(REPLACE(gem_rate_past_month, '%', '') AS NUMERIC) / 100 as gem_rate_recent,
    CAST(REPLACE(momentum_30d, '%', '') AS NUMERIC) / 100 as momentum,
    
    -- Convert comma-formatted numbers
    CAST(REPLACE(total_graded, ',', '') AS INTEGER) as total_graded,
    CAST(total_gems AS INTEGER) as total_gems,
    
    -- Links
    gemrate_url,
    cardladder_all_graded_url,
    psa_cert_url
    
  FROM matched_cards_final
  WHERE loose_price > 0 
    AND bgs_10_price > 0
    AND gem_rate_all_time IS NOT NULL
)
SELECT 
  player_name,
  parallel,
  card_number,
  console_name,
  loose_price,
  bgs_10_price,
  
  -- Key metrics
  ROUND(bgs_10_price / NULLIF(loose_price, 0), 2) as grade_premium_multiplier,
  ROUND(gem_rate * 100, 1) as gem_rate_pct,
  ROUND(gem_rate_recent * 100, 1) as gem_rate_recent_pct,
  ROUND(momentum * 100, 1) as momentum_pct,
  sales_volume,
  total_graded,
  
  -- Investment score calculation
  ROUND(
    (1 - COALESCE(gem_rate, 0.5)) * 40 +                                    -- Grading difficulty (40 points)
    LEAST(COALESCE(bgs_10_price / NULLIF(loose_price, 0), 1), 20) * 1.5 +   -- Grade premium (30 points max)
    (COALESCE(momentum, 0) + 1) * 15 +                                      -- Momentum (30 points max)
    LEAST(COALESCE(sales_volume, 0) / 100.0, 10)                            -- Liquidity bonus (10 points max)
  , 2) as investment_score,
  
  -- Opportunity type classification
  CASE 
    WHEN gem_rate < 0.15 AND bgs_10_price / NULLIF(loose_price, 0) > 10 THEN 'Grading Arbitrage'
    WHEN momentum > 0.20 AND total_graded < 500 THEN 'Rising Star'
    WHEN sales_volume > 500 AND loose_price < 10 AND bgs_10_price > 100 THEN 'Undervalued Gem'
    WHEN gem_rate_recent > gem_rate AND momentum > 0 THEN 'Improving Quality'
    ELSE 'Standard Opportunity'
  END as opportunity_type,
  
  -- Risk level
  CASE 
    WHEN total_graded < 100 THEN 'High Risk'
    WHEN total_graded < 500 THEN 'Medium Risk'
    ELSE 'Low Risk'
  END as risk_level,
  
  -- Links
  gemrate_url,
  cardladder_all_graded_url,
  psa_cert_url
  
FROM card_metrics
WHERE total_graded >= 50  -- Minimum population for statistical relevance
ORDER BY investment_score DESC;

COMMENT ON VIEW vw_investment_opportunities IS 'Top investment opportunities ranked by grading difficulty, premium, and momentum';

-- ============================================================================
-- 2. GRADING INTELLIGENCE
-- ============================================================================

DROP VIEW IF EXISTS vw_grading_intelligence CASCADE;

CREATE VIEW vw_grading_intelligence AS
WITH grading_stats AS (
  SELECT 
    player_name,
    parallel,
    card_number,
    console_name,
    loose_price,
    bgs_10_price,
    
    CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100 as gem_rate,
    CAST(REPLACE(gem_rate_past_month, '%', '') AS NUMERIC) / 100 as gem_rate_recent,
    CAST(REPLACE(momentum_30d, '%', '') AS NUMERIC) / 100 as momentum,
    CAST(REPLACE(total_graded, ',', '') AS INTEGER) as total_graded,
    CAST(total_gems AS INTEGER) as total_gems,
    CAST(graded_past_month AS INTEGER) as graded_past_month,
    
    -- Grade distribution
    CAST(REPLACE(pct_psa_10, '%', '') AS NUMERIC) / 100 as pct_10,
    CAST(REPLACE(pct_psa_9, '%', '') AS NUMERIC) / 100 as pct_9,
    CAST(REPLACE(pct_psa_8, '%', '') AS NUMERIC) / 100 as pct_8,
    
    last_gem_date,
    last_graded_date,
    gemrate_url
    
  FROM matched_cards_final
  WHERE gem_rate_all_time IS NOT NULL
)
SELECT 
  player_name,
  parallel,
  card_number,
  console_name,
  
  -- Grading difficulty metrics
  ROUND(gem_rate * 100, 1) as gem_rate_pct,
  ROUND(gem_rate_recent * 100, 1) as gem_rate_recent_pct,
  total_graded,
  total_gems,
  graded_past_month,
  
  -- Grading momentum
  ROUND(momentum * 100, 1) as momentum_pct,
  CASE 
    WHEN momentum > 0.30 THEN 'Surging'
    WHEN momentum > 0.10 THEN 'Hot'
    WHEN momentum > 0 THEN 'Rising'
    WHEN momentum > -0.10 THEN 'Cooling'
    WHEN momentum > -0.30 THEN 'Cold'
    ELSE 'Frozen'
  END as grading_trend,
  
  -- Grade distribution
  ROUND(pct_10 * 100, 1) as psa_10_pct,
  ROUND(pct_9 * 100, 1) as psa_9_pct,
  ROUND(pct_8 * 100, 1) as psa_8_pct,
  ROUND((pct_10 + pct_9) * 100, 1) as high_grade_pct,
  
  -- Grading economics
  loose_price,
  bgs_10_price,
  ROUND(bgs_10_price - loose_price - 25, 2) as net_profit_if_gem,  -- Assuming $25 grading cost
  ROUND((bgs_10_price - loose_price - 25) * gem_rate, 2) as expected_value,
  
  -- Grading recommendation
  CASE 
    WHEN (bgs_10_price - loose_price - 25) * gem_rate > 50 THEN 'Strong Buy for Grading'
    WHEN (bgs_10_price - loose_price - 25) * gem_rate > 20 THEN 'Good Grading Candidate'
    WHEN (bgs_10_price - loose_price - 25) * gem_rate > 0 THEN 'Marginal'
    ELSE 'Not Recommended'
  END as grading_recommendation,
  
  -- Difficulty classification
  CASE 
    WHEN gem_rate < 0.10 THEN 'Extremely Difficult'
    WHEN gem_rate < 0.20 THEN 'Very Difficult'
    WHEN gem_rate < 0.30 THEN 'Difficult'
    WHEN gem_rate < 0.40 THEN 'Moderate'
    ELSE 'Easy'
  END as grading_difficulty,
  
  last_gem_date,
  last_graded_date,
  gemrate_url
  
FROM grading_stats
WHERE total_graded >= 30
ORDER BY expected_value DESC;

COMMENT ON VIEW vw_grading_intelligence IS 'Grading difficulty analysis with expected value calculations';

-- ============================================================================
-- 3. MARKET EFFICIENCY ANALYSIS
-- ============================================================================

DROP VIEW IF EXISTS vw_market_efficiency CASCADE;

CREATE VIEW vw_market_efficiency AS
WITH efficiency_metrics AS (
  SELECT 
    player_name,
    parallel,
    console_name,
    loose_price,
    bgs_10_price,
    sales_volume,
    
    CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100 as gem_rate,
    CAST(REPLACE(total_graded, ',', '') AS INTEGER) as total_graded,
    
    -- Calculate expected premium based on gem rate
    CASE 
      WHEN CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100 < 0.15 THEN 15
      WHEN CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100 < 0.25 THEN 10
      WHEN CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100 < 0.35 THEN 7
      ELSE 5
    END as expected_multiplier
    
  FROM matched_cards_final
  WHERE loose_price > 0 
    AND bgs_10_price > 0
    AND gem_rate_all_time IS NOT NULL
    AND sales_volume > 100
)
SELECT 
  player_name,
  parallel,
  console_name,
  loose_price,
  bgs_10_price,
  sales_volume,
  total_graded,
  
  -- Efficiency metrics
  ROUND(gem_rate * 100, 1) as gem_rate_pct,
  ROUND(bgs_10_price / NULLIF(loose_price, 0), 2) as actual_multiplier,
  expected_multiplier,
  ROUND(bgs_10_price / NULLIF(loose_price, 0) - expected_multiplier, 2) as efficiency_variance,
  
  -- Market efficiency classification
  CASE 
    WHEN ABS(bgs_10_price / NULLIF(loose_price, 0) - expected_multiplier) < 2 THEN 'Efficient'
    WHEN bgs_10_price / NULLIF(loose_price, 0) > expected_multiplier + 2 THEN 'Overpriced'
    ELSE 'Underpriced'
  END as pricing_efficiency,
  
  -- Liquidity impact
  CASE 
    WHEN sales_volume > 1000 THEN 'High Liquidity'
    WHEN sales_volume > 500 THEN 'Medium Liquidity'
    ELSE 'Low Liquidity'
  END as liquidity_tier,
  
  -- Opportunity signal
  CASE 
    WHEN bgs_10_price / NULLIF(loose_price, 0) < expected_multiplier - 3 
         AND sales_volume > 200 THEN 'Strong Buy Signal'
    WHEN bgs_10_price / NULLIF(loose_price, 0) < expected_multiplier - 1 THEN 'Buy Signal'
    WHEN bgs_10_price / NULLIF(loose_price, 0) > expected_multiplier + 3 THEN 'Sell Signal'
    ELSE 'Hold'
  END as market_signal
  
FROM efficiency_metrics
ORDER BY ABS(bgs_10_price / NULLIF(loose_price, 0) - expected_multiplier) DESC;

COMMENT ON VIEW vw_market_efficiency IS 'Market pricing efficiency vs expected premiums based on gem rates';

-- ============================================================================
-- 4. PLAYER GRADING PROFILES
-- ============================================================================

DROP VIEW IF EXISTS vw_player_grading_profiles CASCADE;

CREATE VIEW vw_player_grading_profiles AS
WITH player_stats AS (
  SELECT 
    player_name,
    COUNT(*) as total_parallels,
    AVG(CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100) as avg_gem_rate,
    MIN(CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100) as min_gem_rate,
    MAX(CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100) as max_gem_rate,
    SUM(CAST(REPLACE(total_graded, ',', '') AS INTEGER)) as total_cards_graded,
    SUM(CAST(total_gems AS INTEGER)) as total_gems,
    AVG(loose_price) as avg_loose_price,
    AVG(bgs_10_price) as avg_psa10_price,
    AVG(sales_volume) as avg_sales_volume,
    MAX(CAST(REPLACE(momentum_30d, '%', '') AS NUMERIC) / 100) as best_momentum
    
  FROM matched_cards_final
  WHERE gem_rate_all_time IS NOT NULL
  GROUP BY player_name
  HAVING COUNT(*) >= 3  -- At least 3 parallels
)
SELECT 
  player_name,
  total_parallels,
  total_cards_graded,
  total_gems,
  
  -- Grading profile
  ROUND(avg_gem_rate * 100, 1) as avg_gem_rate_pct,
  ROUND(min_gem_rate * 100, 1) as min_gem_rate_pct,
  ROUND(max_gem_rate * 100, 1) as max_gem_rate_pct,
  ROUND((max_gem_rate - min_gem_rate) * 100, 1) as gem_rate_variance,
  
  -- Pricing profile
  ROUND(avg_loose_price, 2) as avg_loose_price,
  ROUND(avg_psa10_price, 2) as avg_psa10_price,
  ROUND(avg_psa10_price / NULLIF(avg_loose_price, 0), 2) as avg_grade_premium,
  
  -- Market activity
  ROUND(avg_sales_volume, 0) as avg_sales_volume,
  ROUND(best_momentum * 100, 1) as best_momentum_pct,
  
  -- Player classification
  CASE 
    WHEN avg_gem_rate < 0.20 THEN 'Difficult to Grade'
    WHEN avg_gem_rate < 0.30 THEN 'Moderate Difficulty'
    ELSE 'Easy to Grade'
  END as grading_profile,
  
  CASE 
    WHEN avg_sales_volume > 800 THEN 'Superstar'
    WHEN avg_sales_volume > 400 THEN 'Star'
    WHEN avg_sales_volume > 200 THEN 'Starter'
    ELSE 'Bench'
  END as market_tier,
  
  -- Investment rating
  CASE 
    WHEN avg_gem_rate < 0.25 AND avg_psa10_price / NULLIF(avg_loose_price, 0) > 8 
         AND avg_sales_volume > 300 THEN 'Premium Investment'
    WHEN avg_gem_rate < 0.30 AND avg_psa10_price / NULLIF(avg_loose_price, 0) > 6 THEN 'Good Investment'
    WHEN avg_sales_volume > 500 THEN 'Liquid Asset'
    ELSE 'Speculative'
  END as investment_rating
  
FROM player_stats
ORDER BY total_cards_graded DESC;

COMMENT ON VIEW vw_player_grading_profiles IS 'Player-level grading statistics across all parallels';

-- ============================================================================
-- 5. OPPORTUNITY ALERTS (Real-time signals)
-- ============================================================================

DROP VIEW IF EXISTS vw_opportunity_alerts CASCADE;

CREATE VIEW vw_opportunity_alerts AS
WITH alert_candidates AS (
  SELECT 
    player_name,
    parallel,
    card_number,
    console_name,
    loose_price,
    bgs_10_price,
    sales_volume,
    
    CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100 as gem_rate,
    CAST(REPLACE(gem_rate_past_month, '%', '') AS NUMERIC) / 100 as gem_rate_recent,
    CAST(REPLACE(momentum_30d, '%', '') AS NUMERIC) / 100 as momentum,
    CAST(REPLACE(total_graded, ',', '') AS INTEGER) as total_graded,
    CAST(graded_past_month AS INTEGER) as graded_past_month,
    CAST(graded_prior_month AS INTEGER) as graded_prior_month,
    
    last_gem_date,
    last_graded_date,
    gemrate_url,
    cardladder_all_graded_url
    
  FROM matched_cards_final
  WHERE gem_rate_all_time IS NOT NULL
)
SELECT 
  player_name,
  parallel,
  card_number,
  console_name,
  
  -- Alert type and priority
  CASE 
    WHEN momentum > 0.30 AND graded_past_month > graded_prior_month THEN 'HOT: Surging Momentum'
    WHEN gem_rate < 0.15 AND bgs_10_price / NULLIF(loose_price, 0) > 12 THEN 'ARBITRAGE: High Premium + Low Gem Rate'
    WHEN gem_rate_recent > gem_rate + 0.10 THEN 'QUALITY: Improving Gem Rate'
    WHEN graded_past_month > 100 AND total_graded < 500 THEN 'POPULATION: High Activity + Low Pop'
    WHEN momentum < -0.30 THEN 'WARNING: Cooling Market'
    WHEN sales_volume > 800 AND loose_price < 15 THEN 'VALUE: High Volume + Low Price'
    WHEN last_gem_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'FRESH: Recent PSA 10'
    ELSE NULL
  END as alert_type,
  
  CASE 
    WHEN momentum > 0.40 OR (gem_rate < 0.12 AND bgs_10_price / NULLIF(loose_price, 0) > 15) THEN 'Critical'
    WHEN momentum > 0.25 OR gem_rate < 0.18 THEN 'High'
    WHEN momentum > 0.10 OR graded_past_month > 80 THEN 'Medium'
    ELSE 'Low'
  END as priority,
  
  -- Key metrics
  loose_price,
  bgs_10_price,
  ROUND(bgs_10_price / NULLIF(loose_price, 0), 2) as grade_premium,
  ROUND(gem_rate * 100, 1) as gem_rate_pct,
  ROUND(momentum * 100, 1) as momentum_pct,
  sales_volume,
  total_graded,
  graded_past_month,
  
  -- Timing
  last_gem_date,
  last_graded_date,
  CURRENT_DATE - last_gem_date as days_since_last_gem,
  
  -- Links
  gemrate_url,
  cardladder_all_graded_url
  
FROM alert_candidates
WHERE CASE 
    WHEN momentum > 0.30 AND graded_past_month > graded_prior_month THEN TRUE
    WHEN gem_rate < 0.15 AND bgs_10_price / NULLIF(loose_price, 0) > 12 THEN TRUE
    WHEN gem_rate_recent > gem_rate + 0.10 THEN TRUE
    WHEN graded_past_month > 100 AND total_graded < 500 THEN TRUE
    WHEN momentum < -0.30 THEN TRUE
    WHEN sales_volume > 800 AND loose_price < 15 THEN TRUE
    WHEN last_gem_date >= CURRENT_DATE - INTERVAL '7 days' THEN TRUE
    ELSE FALSE
  END
ORDER BY 
  CASE 
    WHEN momentum > 0.40 OR (gem_rate < 0.12 AND bgs_10_price / NULLIF(loose_price, 0) > 15) THEN 1
    WHEN momentum > 0.25 OR gem_rate < 0.18 THEN 2
    WHEN momentum > 0.10 OR graded_past_month > 80 THEN 3
    ELSE 4
  END,
  momentum DESC;

COMMENT ON VIEW vw_opportunity_alerts IS 'Real-time opportunity alerts based on momentum, pricing, and grading activity';

-- ============================================================================
-- 6. PARALLEL PERFORMANCE COMPARISON
-- ============================================================================

DROP VIEW IF EXISTS vw_parallel_performance CASCADE;

CREATE VIEW vw_parallel_performance AS
WITH parallel_stats AS (
  SELECT 
    parallel,
    console_name,
    COUNT(*) as card_count,
    AVG(CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100) as avg_gem_rate,
    AVG(loose_price) as avg_loose_price,
    AVG(bgs_10_price) as avg_psa10_price,
    AVG(sales_volume) as avg_sales_volume,
    SUM(CAST(REPLACE(total_graded, ',', '') AS INTEGER)) as total_graded,
    AVG(CAST(REPLACE(momentum_30d, '%', '') AS NUMERIC) / 100) as avg_momentum
    
  FROM matched_cards_final
  WHERE gem_rate_all_time IS NOT NULL
    AND loose_price > 0
  GROUP BY parallel, console_name
  HAVING COUNT(*) >= 5
)
SELECT 
  parallel,
  console_name,
  card_count,
  total_graded,
  
  -- Performance metrics
  ROUND(avg_gem_rate * 100, 1) as avg_gem_rate_pct,
  ROUND(avg_loose_price, 2) as avg_loose_price,
  ROUND(avg_psa10_price, 2) as avg_psa10_price,
  ROUND(avg_psa10_price / NULLIF(avg_loose_price, 0), 2) as avg_grade_premium,
  ROUND(avg_sales_volume, 0) as avg_sales_volume,
  ROUND(avg_momentum * 100, 1) as avg_momentum_pct,
  
  -- ROI calculation (assuming $25 grading cost)
  ROUND((avg_psa10_price - avg_loose_price - 25) * avg_gem_rate, 2) as expected_roi,
  
  -- Parallel tier
  CASE 
    WHEN avg_loose_price > 50 THEN 'Premium'
    WHEN avg_loose_price > 20 THEN 'Mid-Tier'
    ELSE 'Base'
  END as price_tier,
  
  -- Grading recommendation
  CASE 
    WHEN (avg_psa10_price - avg_loose_price - 25) * avg_gem_rate > 30 THEN 'Excellent for Grading'
    WHEN (avg_psa10_price - avg_loose_price - 25) * avg_gem_rate > 15 THEN 'Good for Grading'
    WHEN (avg_psa10_price - avg_loose_price - 25) * avg_gem_rate > 5 THEN 'Marginal'
    ELSE 'Not Recommended'
  END as grading_value
  
FROM parallel_stats
ORDER BY expected_roi DESC;

COMMENT ON VIEW vw_parallel_performance IS 'Parallel-level performance metrics and grading ROI analysis';
