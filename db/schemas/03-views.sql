-- ============================================================================
-- 03-VIEWS: All database views
-- ============================================================================

-- ============================================================================
-- CORE VIEWS
-- ============================================================================

-- Latest computed metrics per card
DROP VIEW IF EXISTS vw_card_metrics_current CASCADE;
CREATE VIEW vw_card_metrics_current AS
SELECT DISTINCT ON (card_id)
    card_id, date as metric_date, last_sale_price, avg_price_30d, avg_price_90d,
    momentum, trend_state, volatility_score, liquidity_score, sales_velocity,
    execution_eligible, price_change_7d, price_change_30d, days_of_data, computed_at
FROM card_computed_metrics
ORDER BY card_id, date DESC;

-- Multi-field comparison view
DROP VIEW IF EXISTS vw_card_metrics_multi_field CASCADE;
CREATE VIEW vw_card_metrics_multi_field AS
SELECT
    card_id, date, loose_momentum, loose_trend_state, loose_price_change_7d, loose_execution_eligible,
    psa10_momentum, psa10_trend_state, psa10_price_change_7d, psa10_execution_eligible,
    graded_momentum, graded_trend_state, graded_price_change_7d, graded_execution_eligible,
    psa10_loose_spread, graded_loose_spread, grading_upside_potential, best_value_price_type
FROM card_computed_metrics
WHERE loose_momentum IS NOT NULL OR psa10_momentum IS NOT NULL OR graded_momentum IS NOT NULL;

-- Grading opportunities (high upside)
DROP VIEW IF EXISTS vw_card_grading_opportunities CASCADE;
CREATE VIEW vw_card_grading_opportunities AS
SELECT
    card_id, date, loose_avg_30d as loose_price, psa10_avg_30d as psa10_price,
    grading_upside_potential,
    CASE WHEN grading_upside_potential > 200 THEN 'high' WHEN grading_upside_potential > 100 THEN 'medium' ELSE 'low' END as opportunity_tier
FROM card_computed_metrics
WHERE grading_upside_potential IS NOT NULL AND grading_upside_potential > 50 AND loose_execution_eligible = TRUE
ORDER BY grading_upside_potential DESC;

-- Investment metrics primary (best price type per card)
DROP VIEW IF EXISTS vw_card_investment_primary CASCADE;
CREATE VIEW vw_card_investment_primary AS
SELECT DISTINCT ON (card_id, date)
    card_id, date, price_type as primary_price_type, price_current, change_7d_pct,
    trend_state, volatility_30d, execution_eligible
FROM card_investment_metrics_by_type
WHERE price_current IS NOT NULL
ORDER BY card_id, date, CASE price_type WHEN 'psa10' THEN 1 WHEN 'graded' THEN 2 WHEN 'loose' THEN 3 END;

-- ============================================================================
-- DAILY DELTAS VIEW
-- ============================================================================
DROP VIEW IF EXISTS vw_card_daily_deltas_summary CASCADE;
CREATE VIEW vw_card_daily_deltas_summary AS
SELECT
    card_id, console_uid, date, console_name, product_name,
    loose_price_yesterday, loose_price_today, loose_price_diff, loose_price_diff_pct,
    psa10_price_diff_pct, sales_volume_diff, has_prior_day_data, computed_at
FROM card_daily_deltas
ORDER BY date DESC, card_id;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Cards with all dimensions (using denormalized columns from cards table - no joins needed)
DROP VIEW IF EXISTS vw_cards_complete CASCADE;
CREATE VIEW vw_cards_complete AS
SELECT
    id as card_id, card_number, player_name, player_first_name, player_last_name,
    team_name, team_city, team_abbr, set_name, set_year, manufacturer_name,
    sport_name, league_abbr, rookie_card
FROM cards
WHERE player_name IS NOT NULL;

-- ============================================================================
-- REPORTING VIEWS (Metabase-friendly)
-- ============================================================================

-- Daily market summary
DROP VIEW IF EXISTS reports_daily_market_summary CASCADE;
CREATE VIEW reports_daily_market_summary AS
SELECT
    date,
    COUNT(*) as total_cards,
    COUNT(*) FILTER (WHERE trend_state = 'Rising') as rising_count,
    COUNT(*) FILTER (WHERE trend_state = 'Declining') as declining_count,
    AVG(momentum) FILTER (WHERE momentum IS NOT NULL) as avg_momentum,
    AVG(liquidity_score) FILTER (WHERE liquidity_score IS NOT NULL) as avg_liquidity
FROM card_computed_metrics
GROUP BY date
ORDER BY date DESC;

-- Top movers
DROP VIEW IF EXISTS reports_top_movers CASCADE;
CREATE VIEW reports_top_movers AS
SELECT
    cm.card_id, c.player_name, c.set_name, cm.date,
    cm.price_change_7d as pct_change_7d, cm.momentum,
    CASE WHEN cm.price_change_7d > 0 THEN 'gainer' ELSE 'loser' END as mover_type,
    ROW_NUMBER() OVER (PARTITION BY cm.date ORDER BY cm.price_change_7d DESC) as rank_gain,
    ROW_NUMBER() OVER (PARTITION BY cm.date ORDER BY cm.price_change_7d ASC) as rank_loss
FROM card_computed_metrics cm
JOIN cards c ON cm.card_id = c.id
WHERE cm.price_change_7d IS NOT NULL;

-- Breakout alerts (>10% weekly gains)
DROP VIEW IF EXISTS reports_breakout_alerts CASCADE;
CREATE VIEW reports_breakout_alerts AS
SELECT
    card_id, date, price_change_7d as breakout_pct,
    CASE WHEN price_change_7d > 50 THEN 'extreme' WHEN price_change_7d > 25 THEN 'strong' ELSE 'moderate' END as breakout_strength
FROM card_computed_metrics
WHERE price_change_7d > 10 AND execution_eligible = TRUE;
