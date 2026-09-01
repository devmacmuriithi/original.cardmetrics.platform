-- ============================================================================
-- REPORTING VIEWS FOR METABASE
-- Pre-built reports from card_analytics_daily and card_price_windows
-- ============================================================================

-- 1. Daily Market Summary Report
-- Shows market-wide statistics per date
DROP VIEW IF EXISTS reports_daily_market_summary;

CREATE VIEW reports_daily_market_summary AS
SELECT 
    date,
    COUNT(*) as total_cards,
    COUNT(CASE WHEN is_breakout THEN 1 END) as breakouts,
    COUNT(CASE WHEN is_trending THEN 1 END) as trending_cards,
    COUNT(CASE WHEN is_consolidating THEN 1 END) as consolidating_cards,
    COUNT(CASE WHEN trend_direction = 'bullish' THEN 1 END) as bullish_count,
    COUNT(CASE WHEN trend_direction = 'bearish' THEN 1 END) as bearish_count,
    COUNT(CASE WHEN trend_direction = 'neutral' THEN 1 END) as neutral_count,
    COUNT(CASE WHEN trend_direction = 'mixed' THEN 1 END) as mixed_count,
    COUNT(CASE WHEN performance_7d_tier = 'breakout' THEN 1 END) as tier_breakout,
    COUNT(CASE WHEN performance_7d_tier = 'strong' THEN 1 END) as tier_strong,
    COUNT(CASE WHEN performance_7d_tier = 'moderate' THEN 1 END) as tier_moderate,
    COUNT(CASE WHEN performance_7d_tier = 'weak' THEN 1 END) as tier_weak,
    COUNT(CASE WHEN performance_7d_tier = 'declining' THEN 1 END) as tier_declining,
    ROUND(AVG(pct_change_7d), 2) as avg_7d_return,
    ROUND(AVG(pct_change_30d), 2) as avg_30d_return,
    ROUND(MAX(pct_change_7d), 2) as max_7d_gain,
    ROUND(MIN(pct_change_7d), 2) as max_7d_loss,
    ROUND(AVG(trend_consistency_score), 2) as avg_consistency
FROM card_analytics_daily
GROUP BY date
ORDER BY date DESC;

COMMENT ON VIEW reports_daily_market_summary IS 'Daily market-wide statistics and trend distribution';

-- 2. Top Movers Report (7-Day)
-- Best and worst performing cards
DROP VIEW IF EXISTS reports_top_movers_7d;

CREATE VIEW reports_top_movers_7d AS
SELECT 
    a.date,
    c.id as card_id,
    c.card_number,
    p.full_name as player_name,
    s.name as set_name,
    s.year as set_year,
    sp.name as sport,
    a.current_price,
    a.pct_change_7d,
    a.pct_change_30d,
    a.performance_7d_tier,
    a.trend_direction,
    a.is_breakout,
    a.is_trending,
    a.rank_by_7d_change,
    CASE 
        WHEN a.pct_change_7d > 0 THEN 'gainer'
        WHEN a.pct_change_7d < 0 THEN 'loser'
        ELSE 'unchanged'
    END as mover_type
FROM card_analytics_daily a
JOIN cards c ON c.id = a.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets s ON s.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
WHERE a.pct_change_7d IS NOT NULL
ORDER BY a.date DESC, ABS(a.pct_change_7d) DESC;

COMMENT ON VIEW reports_top_movers_7d IS 'Cards ranked by 7-day price movement (both gainers and losers)';

-- 3. Breakout Alert Report
-- Cards with significant upward movement
DROP VIEW IF EXISTS reports_breakout_alerts;

CREATE VIEW reports_breakout_alerts AS
SELECT 
    a.date,
    c.id as card_id,
    c.card_number,
    c.variation,
    p.full_name as player_name,
    s.name as set_name,
    s.year as set_year,
    sp.name as sport,
    a.current_price,
    a.previous_price,
    a.pct_change_7d,
    a.pct_change_30d,
    a.performance_7d_tier,
    a.trend_direction,
    a.trend_consistency_score,
    CASE 
        WHEN a.pct_change_7d > 20 THEN 'extreme'
        WHEN a.pct_change_7d > 10 THEN 'strong'
        ELSE 'moderate'
    END as breakout_strength
FROM card_analytics_daily a
JOIN cards c ON c.id = a.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets s ON s.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
WHERE a.is_breakout = TRUE
ORDER BY a.date DESC, a.pct_change_7d DESC;

COMMENT ON VIEW reports_breakout_alerts IS 'Cards with >10% weekly gains (breakout candidates)';

-- 4. Trending Cards Report
-- Cards showing significant movement in any direction
DROP VIEW IF EXISTS reports_trending_cards;

CREATE VIEW reports_trending_cards AS
SELECT 
    a.date,
    c.id as card_id,
    c.card_number,
    p.full_name as player_name,
    s.name as set_name,
    sp.name as sport,
    a.current_price,
    a.pct_change_1d,
    a.pct_change_7d,
    a.pct_change_30d,
    a.trend_direction,
    a.trend_consistency_score,
    CASE 
        WHEN a.pct_change_7d > 5 THEN 'surging'
        WHEN a.pct_change_7d < -5 THEN 'declining'
        ELSE 'mixed'
    END as trend_strength
FROM card_analytics_daily a
JOIN cards c ON c.id = a.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets s ON s.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
WHERE a.is_trending = TRUE
ORDER BY a.date DESC, ABS(a.pct_change_7d) DESC;

COMMENT ON VIEW reports_trending_cards IS 'Cards with significant price movement (>5% in 7d or >10% in 30d)';

-- 5. Multi-Window Performance Report
-- Long-term trajectory analysis
DROP VIEW IF EXISTS reports_multi_window_performance;

CREATE VIEW reports_multi_window_performance AS
SELECT 
    w.date,
    c.id as card_id,
    c.card_number,
    p.full_name as player_name,
    s.name as set_name,
    sp.name as sport,
    w.change_1d_pct,
    w.change_3d_pct,
    w.change_7d_pct,
    w.change_14d_pct,
    w.change_30d_pct,
    w.change_60d_pct,
    w.change_90d_pct,
    w.has_1d_data,
    w.has_7d_data,
    w.has_30d_data,
    w.has_90d_data,
    CASE 
        WHEN w.change_7d_pct > 0 AND w.change_30d_pct > 0 AND w.change_90d_pct > 0 THEN 'strong_uptrend'
        WHEN w.change_7d_pct < 0 AND w.change_30d_pct < 0 AND w.change_90d_pct < 0 THEN 'strong_downtrend'
        WHEN w.change_7d_pct > 0 AND w.change_30d_pct > 0 THEN 'recovering'
        WHEN w.change_7d_pct > 0 THEN 'short_term_rally'
        WHEN w.change_7d_pct < 0 THEN 'short_term_decline'
        ELSE 'mixed'
    END as trajectory
FROM card_price_windows w
JOIN cards c ON c.id = w.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets s ON s.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
ORDER BY w.date DESC, w.card_id;

COMMENT ON VIEW reports_multi_window_performance IS 'All % change windows for trajectory analysis';

-- 6. Data Quality Report
-- Coverage and quality metrics
DROP VIEW IF EXISTS reports_data_quality;

CREATE VIEW reports_data_quality AS
SELECT 
    date,
    COUNT(*) as total_cards,
    COUNT(CASE WHEN pct_change_1d IS NOT NULL THEN 1 END) as has_1d_data,
    COUNT(CASE WHEN pct_change_7d IS NOT NULL THEN 1 END) as has_7d_data,
    COUNT(CASE WHEN pct_change_30d IS NOT NULL THEN 1 END) as has_30d_data,
    COUNT(CASE WHEN pct_change_90d IS NOT NULL THEN 1 END) as has_90d_data,
    ROUND(100.0 * COUNT(CASE WHEN pct_change_1d IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_1d_coverage,
    ROUND(100.0 * COUNT(CASE WHEN pct_change_7d IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_7d_coverage,
    ROUND(100.0 * COUNT(CASE WHEN pct_change_30d IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_30d_coverage,
    ROUND(100.0 * COUNT(CASE WHEN pct_change_90d IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_90d_coverage
FROM card_analytics_daily
GROUP BY date
ORDER BY date DESC;

COMMENT ON VIEW reports_data_quality IS 'Data coverage quality metrics per date';

-- 7. Consolidating Assets Report
-- Flat/stable cards (potential buying opportunities)
DROP VIEW IF EXISTS reports_consolidating_assets;

CREATE VIEW reports_consolidating_assets AS
SELECT 
    a.date,
    c.id as card_id,
    c.card_number,
    p.full_name as player_name,
    s.name as set_name,
    s.year as set_year,
    sp.name as sport,
    a.current_price,
    a.pct_change_7d,
    a.pct_change_30d,
    a.pct_change_90d,
    a.trend_consistency_score,
    a.performance_7d_tier
FROM card_analytics_daily a
JOIN cards c ON c.id = a.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets s ON s.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
WHERE a.is_consolidating = TRUE
ORDER BY a.date DESC, a.current_price DESC;

COMMENT ON VIEW reports_consolidating_assets IS 'Stable/flat cards (potential buying opportunities)';

-- ============================================================================
-- INDEXES FOR REPORT VIEWS (optimize Metabase queries)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_analytics_daily_breakout ON card_analytics_daily(date, is_breakout) WHERE is_breakout = TRUE;
CREATE INDEX IF NOT EXISTS idx_analytics_daily_trending ON card_analytics_daily(date, is_trending) WHERE is_trending = TRUE;
CREATE INDEX IF NOT EXISTS idx_analytics_daily_consolidating ON card_analytics_daily(date, is_consolidating) WHERE is_consolidating = TRUE;
CREATE INDEX IF NOT EXISTS idx_analytics_daily_7d_change ON card_analytics_daily(date, pct_change_7d DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_price_windows_trajectory ON card_price_windows(date, card_id, change_7d_pct, change_30d_pct, change_90d_pct);
