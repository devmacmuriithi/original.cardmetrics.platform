-- ============================================================================
-- REPORTING VIEWS FOR METABASE (Updated for card_daily_snapshots)
-- ============================================================================

-- 1. Daily Market Summary Report
DROP VIEW IF EXISTS reports_daily_market_summary;

CREATE VIEW reports_daily_market_summary AS
SELECT 
    date,
    COUNT(*) as total_cards,
    COUNT(CASE WHEN pct_change_7d > 10 THEN 1 END) as breakouts,
    COUNT(CASE WHEN ABS(pct_change_7d) > 5 THEN 1 END) as trending_cards,
    COUNT(CASE WHEN ABS(pct_change_7d) < 2 AND ABS(pct_change_30d) < 5 THEN 1 END) as consolidating_cards,
    COUNT(CASE WHEN pct_change_7d > 0 THEN 1 END) as bullish_count,
    COUNT(CASE WHEN pct_change_7d < 0 THEN 1 END) as bearish_count,
    ROUND(AVG(pct_change_7d), 2) as avg_7d_return,
    ROUND(AVG(pct_change_30d), 2) as avg_30d_return,
    ROUND(MAX(pct_change_7d), 2) as max_7d_gain,
    ROUND(MIN(pct_change_7d), 2) as max_7d_loss
FROM card_daily_snapshots
WHERE loose_price IS NOT NULL
GROUP BY date
ORDER BY date DESC;

-- 2. Top Movers Report (7-Day)
DROP VIEW IF EXISTS reports_top_movers_7d;

CREATE VIEW reports_top_movers_7d AS
SELECT 
    s.date,
    c.id as card_id,
    c.card_number,
    p.full_name as player_name,
    st.name as set_name,
    st.year as set_year,
    sp.name as sport,
    s.loose_price as current_price,
    s.pct_change_7d,
    s.pct_change_30d,
    CASE 
        WHEN s.pct_change_7d > 10 THEN 'breakout'
        WHEN s.pct_change_7d > 5 THEN 'strong'
        WHEN s.pct_change_7d > 2 THEN 'moderate'
        WHEN s.pct_change_7d > -2 THEN 'weak'
        ELSE 'declining'
    END as performance_7d_tier,
    CASE 
        WHEN s.pct_change_7d > 5 THEN 'bullish'
        WHEN s.pct_change_7d < -5 THEN 'bearish'
        ELSE 'neutral'
    END as trend_direction,
    CASE 
        WHEN s.pct_change_7d > 0 THEN 'gainer'
        WHEN s.pct_change_7d < 0 THEN 'loser'
        ELSE 'unchanged'
    END as mover_type
FROM card_daily_snapshots s
JOIN cards c ON c.id = s.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets st ON st.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
WHERE s.pct_change_7d IS NOT NULL AND s.loose_price IS NOT NULL
ORDER BY s.date DESC, ABS(s.pct_change_7d) DESC;

-- 3. Breakout Alert Report
DROP VIEW IF EXISTS reports_breakout_alerts;

CREATE VIEW reports_breakout_alerts AS
SELECT 
    s.date,
    c.id as card_id,
    c.card_number,
    c.variation,
    p.full_name as player_name,
    st.name as set_name,
    st.year as set_year,
    sp.name as sport,
    s.loose_price as current_price,
    s.pct_change_7d,
    s.pct_change_30d,
    CASE 
        WHEN s.pct_change_7d > 20 THEN 'extreme'
        WHEN s.pct_change_7d > 10 THEN 'strong'
        ELSE 'moderate'
    END as breakout_strength
FROM card_daily_snapshots s
JOIN cards c ON c.id = s.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets st ON st.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
WHERE s.pct_change_7d > 10 AND s.loose_price IS NOT NULL
ORDER BY s.date DESC, s.pct_change_7d DESC;

-- 4. Trending Cards Report
DROP VIEW IF EXISTS reports_trending_cards;

CREATE VIEW reports_trending_cards AS
SELECT 
    s.date,
    c.id as card_id,
    c.card_number,
    p.full_name as player_name,
    st.name as set_name,
    sp.name as sport,
    s.loose_price as current_price,
    s.pct_change_3d as pct_change_1d,
    s.pct_change_7d,
    s.pct_change_30d,
    CASE 
        WHEN s.pct_change_7d > 5 THEN 'bullish'
        WHEN s.pct_change_7d < -5 THEN 'bearish'
        ELSE 'neutral'
    END as trend_direction,
    CASE 
        WHEN s.pct_change_7d > 5 THEN 'surging'
        WHEN s.pct_change_7d < -5 THEN 'declining'
        ELSE 'mixed'
    END as trend_strength
FROM card_daily_snapshots s
JOIN cards c ON c.id = s.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets st ON st.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
WHERE (ABS(s.pct_change_7d) > 5 OR ABS(s.pct_change_30d) > 10) AND s.loose_price IS NOT NULL
ORDER BY s.date DESC, ABS(s.pct_change_7d) DESC;

-- 5. Data Quality Report
DROP VIEW IF EXISTS reports_data_quality;

CREATE VIEW reports_data_quality AS
SELECT 
    date,
    COUNT(*) as total_cards,
    COUNT(CASE WHEN avg_3d IS NOT NULL THEN 1 END) as has_1d_data,
    COUNT(CASE WHEN avg_7d IS NOT NULL THEN 1 END) as has_7d_data,
    COUNT(CASE WHEN avg_30d IS NOT NULL THEN 1 END) as has_30d_data,
    COUNT(CASE WHEN avg_90d IS NOT NULL THEN 1 END) has_90d_data,
    ROUND(100.0 * COUNT(CASE WHEN pct_change_3d IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_1d_coverage,
    ROUND(100.0 * COUNT(CASE WHEN pct_change_7d IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_7d_coverage,
    ROUND(100.0 * COUNT(CASE WHEN pct_change_30d IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_30d_coverage,
    ROUND(100.0 * COUNT(CASE WHEN pct_change_90d IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_90d_coverage
FROM card_daily_snapshots
WHERE loose_price IS NOT NULL
GROUP BY date
ORDER BY date DESC;

-- 6. Consolidating Assets Report
DROP VIEW IF EXISTS reports_consolidating_assets;

CREATE VIEW reports_consolidating_assets AS
SELECT 
    s.date,
    c.id as card_id,
    c.card_number,
    p.full_name as player_name,
    st.name as set_name,
    st.year as set_year,
    sp.name as sport,
    s.loose_price as current_price,
    s.pct_change_7d,
    s.pct_change_30d,
    s.pct_change_90d,
    CASE 
        WHEN s.pct_change_7d > 10 THEN 'breakout'
        WHEN s.pct_change_7d > 5 THEN 'strong'
        WHEN s.pct_change_7d > 2 THEN 'moderate'
        WHEN s.pct_change_7d > -2 THEN 'weak'
        ELSE 'declining'
    END as performance_7d_tier
FROM card_daily_snapshots s
JOIN cards c ON c.id = s.card_id
LEFT JOIN players p ON p.id = c.player_id
JOIN sets st ON st.id = c.set_id
LEFT JOIN sports sp ON sp.id = c.sport_id
WHERE ABS(s.pct_change_7d) < 2 AND ABS(s.pct_change_30d) < 5 AND s.loose_price IS NOT NULL
ORDER BY s.date DESC, s.loose_price DESC;

-- ============================================================================
-- INDEXES FOR REPORT VIEWS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_snapshots_breakout ON card_daily_snapshots(date, pct_change_7d) WHERE pct_change_7d > 10;
CREATE INDEX IF NOT EXISTS idx_snapshots_trending ON card_daily_snapshots(date, ABS(pct_change_7d)) WHERE ABS(pct_change_7d) > 5;
CREATE INDEX IF NOT EXISTS idx_snapshots_7d_change ON card_daily_snapshots(date, pct_change_7d DESC NULLS LAST);
