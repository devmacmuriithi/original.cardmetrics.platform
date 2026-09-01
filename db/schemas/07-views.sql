-- ALX v1 Metabase Command Center Views
-- These views provide ready-to-query cards for the Metabase dashboard

-- ============================================================================
-- Card 1: Roll-off Alerts (Don't Panic Panel)
-- Shows cards experiencing ghost volatility (window artifact detection)
-- ============================================================================

DROP VIEW IF EXISTS vw_rolloff_alerts;

CREATE VIEW vw_rolloff_alerts AS
SELECT 
  date,
  card_id,
  console_uid,
  sales_volume_365,
  liquidity_baseline AS units_per_day,
  rolloff_flag,
  computed_at
FROM alx_market_signals_daily
WHERE rolloff_flag = TRUE
  AND date = CURRENT_DATE
ORDER BY sales_volume_365 DESC;

COMMENT ON VIEW vw_rolloff_alerts IS 'Roll-off alerts for today - cards with ghost volatility detected';

-- ============================================================================
-- Card 2: Execution Eligible Leaderboard (Safe to Trade)
-- Shows cards cleared for market/instant execution
-- ============================================================================

DROP VIEW IF EXISTS vw_execution_eligible;

CREATE VIEW vw_execution_eligible AS
SELECT 
  date,
  card_id,
  console_uid,
  liquidity_tier,
  liquidity_baseline AS units_per_day,
  sales_volume_365 AS yearly_total,
  execution_eligible,
  computed_at
FROM alx_market_signals_daily
WHERE execution_eligible = TRUE
  AND date = CURRENT_DATE
ORDER BY liquidity_baseline DESC;

COMMENT ON VIEW vw_execution_eligible IS 'Execution eligible cards for today - safe to trade';

-- ============================================================================
-- Card 3: Liquidity Distribution (Exchange Breadth)
-- Shows tier distribution over the last 30 days
-- NOTE: If you only have ~10 days of data, filter to '10 days' instead
-- ============================================================================

DROP VIEW IF EXISTS vw_liquidity_distribution;

CREATE VIEW vw_liquidity_distribution AS
SELECT 
  date,
  liquidity_tier,
  COUNT(*) AS asset_count,
  SUM(sales_volume_365) AS total_yearly_volume,
  AVG(liquidity_baseline) AS avg_units_per_day
FROM alx_market_signals_daily
WHERE date > CURRENT_DATE - INTERVAL '30 days'
GROUP BY date, liquidity_tier
ORDER BY date DESC, liquidity_tier;

COMMENT ON VIEW vw_liquidity_distribution IS 'Liquidity tier distribution over last 30 days';

-- ============================================================================
-- Alternative: 10-day version for early data phases
-- Uncomment and use this if you only have ~10 days of data
-- ============================================================================

/*
DROP VIEW IF EXISTS vw_liquidity_distribution_10d;

CREATE VIEW vw_liquidity_distribution_10d AS
SELECT 
  date,
  liquidity_tier,
  COUNT(*) AS asset_count,
  SUM(sales_volume_365) AS total_yearly_volume,
  AVG(liquidity_baseline) AS avg_units_per_day
FROM alx_market_signals_daily
WHERE date > CURRENT_DATE - INTERVAL '10 days'
GROUP BY date, liquidity_tier
ORDER BY date DESC, liquidity_tier;
*/

-- ============================================================================
-- Summary view: Daily signal counts (for quick health checks)
-- ============================================================================

DROP VIEW IF EXISTS vw_signals_summary;

CREATE VIEW vw_signals_summary AS
SELECT 
  date,
  COUNT(*) AS total_cards,
  COUNT(*) FILTER (WHERE execution_eligible = TRUE) AS eligible_count,
  COUNT(*) FILTER (WHERE rolloff_flag = TRUE) AS rolloff_count,
  COUNT(*) FILTER (WHERE liquidity_tier = 'High') AS high_tier,
  COUNT(*) FILTER (WHERE liquidity_tier = 'Medium') AS medium_tier,
  COUNT(*) FILTER (WHERE liquidity_tier = 'Low') AS low_tier,
  AVG(liquidity_baseline) AS avg_liquidity,
  MAX(computed_at) AS last_computed
FROM alx_market_signals_daily
GROUP BY date
ORDER BY date DESC;

COMMENT ON VIEW vw_signals_summary IS 'Daily summary of signal computation results';

-- ============================================================================
-- Market Data Enriched View (depends on card_daily_snapshots from 03-core-schema)
-- ============================================================================

DROP VIEW IF EXISTS vw_market_enriched;

CREATE VIEW vw_market_enriched AS
SELECT 
    -- Market data
    m.date,
    m.card_id,
    m.loose_price,
    m.graded_price,
    m.psa10_price,
    m.bgs10_price,
    m.retail_loose_buy,
    m.retail_loose_sell,
    m.sales_volume,
    
    -- Card details
    c.card_number,
    c.variation,
    c.rookie_card,
    
    -- Player
    p.full_name as player_name,
    
    -- Team
    t.name as team_name,
    
    -- Set
    s.name as set_name,
    s.year,
    s.console_uid,
    
    -- Manufacturer
    mfg.name as manufacturer,
    
    -- League
    l.name as league_name,
    l.abbreviation as league_abbr,
    
    -- Sport
    sp.name as sport
    
FROM card_daily_snapshots m
LEFT JOIN cards c ON m.card_id = c.id
LEFT JOIN players p ON c.player_id = p.id
LEFT JOIN teams t ON c.team_id = t.id
LEFT JOIN sets s ON c.set_id = s.id
LEFT JOIN manufacturers mfg ON c.manufacturer_id = mfg.id
LEFT JOIN leagues l ON c.league_id = l.id
LEFT JOIN sports sp ON c.sport_id = sp.id;

COMMENT ON VIEW vw_market_enriched IS 'Market data with full card dimension enrichment';
