ALTER TABLE card_computed_metrics ADD COLUMN IF NOT EXISTS loose_avg_7d NUMERIC(12,2);
ALTER TABLE card_computed_metrics ADD COLUMN IF NOT EXISTS psa10_avg_7d NUMERIC(12,2);
ALTER TABLE card_computed_metrics ADD COLUMN IF NOT EXISTS graded_avg_7d NUMERIC(12,2);
-- ============================================================================

-- ============================================================================
-- CARD COMPUTED METRICS (with multi-field support)
-- ============================================================================
DROP TABLE IF EXISTS card_computed_metrics CASCADE;
CREATE TABLE card_computed_metrics (
    id SERIAL PRIMARY KEY, card_id BIGINT NOT NULL REFERENCES cards(id), date DATE NOT NULL,
    
    -- Legacy/primary metrics (loose-based)
    last_sale_price NUMERIC(12,2), last_sale_date DATE, currency TEXT DEFAULT 'USD',
    price_change_1d NUMERIC(5,2), price_change_7d NUMERIC(5,2), price_change_30d NUMERIC(5,2), price_change_90d NUMERIC(5,2),
    high_price_30d NUMERIC(12,2), low_price_30d NUMERIC(12,2),
    volatility_score NUMERIC(4,2), price_stability_index NUMERIC(4,2),
    momentum NUMERIC(6,3), price_stddev_30d NUMERIC(12,2), trend_state TEXT,
    liquidity_score NUMERIC(4,2), sales_velocity NUMERIC(8,2), liquidity_tier TEXT,
    execution_eligible BOOLEAN DEFAULT FALSE, trend_direction TEXT, trend_strength NUMERIC(4,2),
    estimated_market_cap NUMERIC(15,2), computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, days_of_data INTEGER,
    
    -- Multi-field metrics: Loose
    loose_momentum NUMERIC(6,3), loose_trend_state TEXT, loose_volatility_score NUMERIC(4,2), loose_liquidity_score NUMERIC(4,2),
    loose_avg_7d NUMERIC(12,2), loose_avg_30d NUMERIC(12,2), loose_avg_90d NUMERIC(12,2), loose_price_change_7d NUMERIC(5,2), loose_price_change_30d NUMERIC(5,2),
    loose_execution_eligible BOOLEAN DEFAULT FALSE, loose_days_of_data INTEGER,
    
    -- Multi-field metrics: PSA10
    psa10_momentum NUMERIC(6,3), psa10_trend_state TEXT, psa10_volatility_score NUMERIC(4,2), psa10_liquidity_score NUMERIC(4,2),
    psa10_avg_7d NUMERIC(12,2), psa10_avg_30d NUMERIC(12,2), psa10_avg_90d NUMERIC(12,2), psa10_price_change_7d NUMERIC(5,2), psa10_price_change_30d NUMERIC(5,2),
    psa10_execution_eligible BOOLEAN DEFAULT FALSE, psa10_days_of_data INTEGER,
    
    -- Multi-field metrics: Graded
    graded_momentum NUMERIC(6,3), graded_trend_state TEXT, graded_volatility_score NUMERIC(4,2), graded_liquidity_score NUMERIC(4,2),
    graded_avg_7d NUMERIC(12,2), graded_avg_30d NUMERIC(12,2), graded_avg_90d NUMERIC(12,2), graded_price_change_7d NUMERIC(5,2), graded_price_change_30d NUMERIC(5,2),
    graded_execution_eligible BOOLEAN DEFAULT FALSE, graded_days_of_data INTEGER,
    
    -- Cross-field analytics
    psa10_loose_spread NUMERIC(6,2), graded_loose_spread NUMERIC(6,2), psa10_graded_spread NUMERIC(6,2),
    grading_upside_potential NUMERIC(6,2), best_value_price_type TEXT,
    
    UNIQUE(card_id, date)
);

-- ============================================================================
-- PRICE WINDOWS (multi-window % changes)
-- ============================================================================
DROP TABLE IF EXISTS card_price_windows CASCADE;
CREATE TABLE card_price_windows (
    id SERIAL PRIMARY KEY, card_id BIGINT NOT NULL REFERENCES cards(id), date DATE NOT NULL,
    change_1d_pct NUMERIC(6,2), change_3d_pct NUMERIC(6,2), change_7d_pct NUMERIC(6,2), change_14d_pct NUMERIC(6,2),
    change_30d_pct NUMERIC(6,2), change_60d_pct NUMERIC(6,2), change_90d_pct NUMERIC(6,2),
    price_1d_ago NUMERIC(12,2), price_3d_ago NUMERIC(12,2), price_7d_ago NUMERIC(12,2), price_14d_ago NUMERIC(12,2),
    price_30d_ago NUMERIC(12,2), price_60d_ago NUMERIC(12,2), price_90d_ago NUMERIC(12,2),
    avg_3d NUMERIC(12,2), avg_7d NUMERIC(12,2), avg_14d NUMERIC(12,2), avg_30d NUMERIC(12,2), avg_60d NUMERIC(12,2), avg_90d NUMERIC(12,2),
    trend_3d TEXT, trend_7d TEXT, trend_14d TEXT, trend_30d TEXT, trend_60d TEXT, trend_90d TEXT,
    has_1d_data BOOLEAN DEFAULT FALSE, has_3d_data BOOLEAN DEFAULT FALSE, has_7d_data BOOLEAN DEFAULT FALSE, has_14d_data BOOLEAN DEFAULT FALSE,
    has_30d_data BOOLEAN DEFAULT FALSE, has_60d_data BOOLEAN DEFAULT FALSE, has_90d_data BOOLEAN DEFAULT FALSE,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(card_id, date)
);

-- ============================================================================
-- ANALYTICS DAILY (pre-aggregated for dashboards)
-- ============================================================================
DROP TABLE IF EXISTS card_analytics_daily CASCADE;
CREATE TABLE card_analytics_daily (
    id SERIAL PRIMARY KEY, card_id BIGINT NOT NULL REFERENCES cards(id), date DATE NOT NULL,
    current_price NUMERIC(12,2), previous_price NUMERIC(12,2),
    pct_change_1d NUMERIC(6,2), pct_change_3d NUMERIC(6,2), pct_change_7d NUMERIC(6,2), pct_change_14d NUMERIC(6,2),
    pct_change_30d NUMERIC(6,2), pct_change_60d NUMERIC(6,2), pct_change_90d NUMERIC(6,2),
    performance_7d_tier TEXT, performance_30d_tier TEXT, performance_90d_tier TEXT,
    trend_consistency_score NUMERIC(3,2), trend_direction TEXT,
    volume_vs_avg_30d NUMERIC(6,2), is_trending BOOLEAN DEFAULT FALSE, is_breakout BOOLEAN DEFAULT FALSE,
    is_consolidating BOOLEAN DEFAULT FALSE, rank_by_7d_change INTEGER, rank_by_30d_change INTEGER, rank_by_volume INTEGER,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(card_id, date)
);

-- ============================================================================
-- INVESTMENT METRICS BY TYPE (per price type)
-- ============================================================================
DROP TABLE IF EXISTS card_investment_metrics_by_type CASCADE;
CREATE TABLE card_investment_metrics_by_type (
    id SERIAL PRIMARY KEY, card_id BIGINT NOT NULL REFERENCES cards(id), date DATE NOT NULL, price_type TEXT NOT NULL,
    price_7d NUMERIC(12,2), price_current NUMERIC(12,2), change_7d_abs NUMERIC(12,2), change_7d_pct NUMERIC(6,2), momentum_7d NUMERIC(6,3),
    trend_state TEXT, trend_strength NUMERIC(4,2), volatility_7d NUMERIC(4,2), volatility_30d NUMERIC(4,2),
    avg_7d NUMERIC(12,2), avg_30d NUMERIC(12,2), days_of_data INTEGER, execution_eligible BOOLEAN DEFAULT FALSE,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(card_id, date, price_type)
);

-- ============================================================================
-- PRICE SPREADS (cross-field arbitrage)
-- ============================================================================
DROP TABLE IF EXISTS card_price_spreads CASCADE;
CREATE TABLE card_price_spreads (
    id SERIAL PRIMARY KEY, card_id BIGINT NOT NULL REFERENCES cards(id), date DATE NOT NULL,
    loose_price NUMERIC(12,2), psa10_price NUMERIC(12,2), graded_price NUMERIC(12,2),
    psa10_loose_spread NUMERIC(6,2), graded_loose_spread NUMERIC(6,2), psa10_graded_spread NUMERIC(6,2),
    grading_upside_potential NUMERIC(6,2), best_value_price_type TEXT, grade_premium_tier TEXT,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(card_id, date)
);
