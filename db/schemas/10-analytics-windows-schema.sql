-- ============================================================================
-- EXTENDED: card_computed_metrics - Add missing % change windows
-- ============================================================================

-- Add missing columns to existing table
ALTER TABLE card_computed_metrics 
    ADD COLUMN IF NOT EXISTS price_change_3d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS price_change_14d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS price_change_60d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS avg_price_3d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS avg_price_14d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS avg_price_60d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS high_price_7d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS low_price_7d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS high_price_14d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS low_price_14d NUMERIC(12,2);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_metrics_change_3d ON card_computed_metrics(price_change_3d);
CREATE INDEX IF NOT EXISTS idx_metrics_change_14d ON card_computed_metrics(price_change_14d);
CREATE INDEX IF NOT EXISTS idx_metrics_change_60d ON card_computed_metrics(price_change_60d);

COMMENT ON TABLE card_computed_metrics IS 'Derived analytics with extended % change windows (1D/3D/7D/14D/30D/60D/90D)';

-- ============================================================================
-- NEW: card_price_windows - Dedicated table for all % change windows
-- ============================================================================

DROP TABLE IF EXISTS card_price_windows CASCADE;

CREATE TABLE card_price_windows (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    date DATE NOT NULL,
    
    -- All % change windows (vs previous period)
    change_1d_pct NUMERIC(6,2),     -- 1 day
    change_3d_pct NUMERIC(6,2),     -- 3 day
    change_7d_pct NUMERIC(6,2),     -- 7 day
    change_14d_pct NUMERIC(6,2),    -- 14 day
    change_30d_pct NUMERIC(6,2),    -- 30 day
    change_60d_pct NUMERIC(6,2),    -- 60 day
    change_90d_pct NUMERIC(6,2),    -- 90 day
    
    -- Absolute price values at each window start
    price_1d_ago NUMERIC(12,2),
    price_3d_ago NUMERIC(12,2),
    price_7d_ago NUMERIC(12,2),
    price_14d_ago NUMERIC(12,2),
    price_30d_ago NUMERIC(12,2),
    price_60d_ago NUMERIC(12,2),
    price_90d_ago NUMERIC(12,2),
    
    -- Moving averages for each window
    avg_3d NUMERIC(12,2),
    avg_7d NUMERIC(12,2),
    avg_14d NUMERIC(12,2),
    avg_30d NUMERIC(12,2),
    avg_60d NUMERIC(12,2),
    avg_90d NUMERIC(12,2),
    
    -- Trend classification per window
    trend_3d TEXT,   -- up, down, flat
    trend_7d TEXT,
    trend_14d TEXT,
    trend_30d TEXT,
    trend_60d TEXT,
    trend_90d TEXT,
    
    -- Data quality flags
    has_1d_data BOOLEAN DEFAULT FALSE,
    has_3d_data BOOLEAN DEFAULT FALSE,
    has_7d_data BOOLEAN DEFAULT FALSE,
    has_14d_data BOOLEAN DEFAULT FALSE,
    has_30d_data BOOLEAN DEFAULT FALSE,
    has_60d_data BOOLEAN DEFAULT FALSE,
    has_90d_data BOOLEAN DEFAULT FALSE,
    
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(card_id, date)
);

CREATE INDEX idx_price_windows_card ON card_price_windows(card_id);
CREATE INDEX idx_price_windows_date ON card_price_windows(date);
CREATE INDEX idx_price_windows_7d ON card_price_windows(change_7d_pct) WHERE has_7d_data;
CREATE INDEX idx_price_windows_30d ON card_price_windows(change_30d_pct) WHERE has_30d_data;
CREATE INDEX idx_price_windows_composite ON card_price_windows(card_id, date, change_7d_pct, change_30d_pct);

COMMENT ON TABLE card_price_windows IS 'Dedicated table for all % change windows (1D/3D/7D/14D/30D/60D/90D) for trending analysis';

-- ============================================================================
-- NEW: card_analytics_daily - Pre-aggregated analytics for trending/export
-- ============================================================================

DROP TABLE IF EXISTS card_analytics_daily CASCADE;

CREATE TABLE card_analytics_daily (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    date DATE NOT NULL,
    
    -- Core price (loose price as base)
    current_price NUMERIC(12,2),
    previous_price NUMERIC(12,2),
    
    -- All % changes in one row
    pct_change_1d NUMERIC(6,2),
    pct_change_3d NUMERIC(6,2),
    pct_change_7d NUMERIC(6,2),
    pct_change_14d NUMERIC(6,2),
    pct_change_30d NUMERIC(6,2),
    pct_change_60d NUMERIC(6,2),
    pct_change_90d NUMERIC(6,2),
    
    -- Performance tier classification
    performance_7d_tier TEXT,   -- breakout, strong, moderate, weak, declining
    performance_30d_tier TEXT,
    performance_90d_tier TEXT,
    
    -- Trend consistency (are all windows aligned?)
    trend_consistency_score NUMERIC(3,2),  -- 0-1 (1 = all windows agree)
    trend_direction TEXT,                   -- bullish, bearish, mixed, neutral
    
    -- Volume indicators
    volume_vs_avg_30d NUMERIC(6,2),  -- % vs 30d average
    
    -- Export-ready flags
    is_trending BOOLEAN DEFAULT FALSE,     -- Significant movement in any window
    is_breakout BOOLEAN DEFAULT FALSE,       -- >10% in 7d
    is_consolidating BOOLEAN DEFAULT FALSE,  -- All windows flat
    
    -- Ranking fields for export sorting
    rank_by_7d_change INTEGER,
    rank_by_30d_change INTEGER,
    rank_by_volume INTEGER,
    
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(card_id, date)
);

CREATE INDEX idx_analytics_daily_card ON card_analytics_daily(card_id);
CREATE INDEX idx_analytics_daily_date ON card_analytics_daily(date);
CREATE INDEX idx_analytics_trending ON card_analytics_daily(is_trending, date) WHERE is_trending;
CREATE INDEX idx_analytics_breakout ON card_analytics_daily(is_breakout, date) WHERE is_breakout;
CREATE INDEX idx_analytics_7d_rank ON card_analytics_daily(date, rank_by_7d_change);
CREATE INDEX idx_analytics_30d_rank ON card_analytics_daily(date, rank_by_30d_change);

COMMENT ON TABLE card_analytics_daily IS 'Pre-aggregated analytics with all % change windows for trending and export';

-- ============================================================================
-- NEW: analytics_export_queue - For scheduled exports
-- ============================================================================

DROP TABLE IF EXISTS analytics_export_queue CASCADE;

CREATE TABLE analytics_export_queue (
    id SERIAL PRIMARY KEY,
    export_date DATE NOT NULL,
    export_type TEXT NOT NULL,      -- 'trending', 'breakouts', 'full', 'top_movers'
    format TEXT DEFAULT 'csv',      -- csv, json, parquet
    
    -- Filter criteria
    min_liquidity_score NUMERIC(3,2) DEFAULT 0.3,
    min_change_pct NUMERIC(5,2),    -- minimum % change to include
    max_cards INTEGER DEFAULT 1000,   -- limit export size
    
    -- Status
    status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    file_path TEXT,
    row_count INTEGER,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_export_queue_status ON analytics_export_queue(status) WHERE status = 'pending';
CREATE INDEX idx_export_queue_date ON analytics_export_queue(export_date);

COMMENT ON TABLE analytics_export_queue IS 'Queue for scheduled analytics exports';
