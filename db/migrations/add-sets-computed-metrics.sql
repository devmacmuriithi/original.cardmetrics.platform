-- ============================================================================
-- SETS_COMPUTED_METRICS: High-value set-level aggregated metrics
-- Computed AFTER card metrics are complete
-- ============================================================================

SET statement_timeout = '300s';

-- Drop existing table if rebuilding
DROP TABLE IF EXISTS sets_computed_metrics CASCADE;

-- Create sets_computed_metrics table
CREATE TABLE sets_computed_metrics (
    id SERIAL PRIMARY KEY,
    
    -- Set identification
    set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    console_uid TEXT,  -- Nullable initially, populated from cards or sets table
    console_name TEXT, -- Populated from sets table (matches sets.console_name)
    date DATE NOT NULL,
    
    -- Card counts
    cards_count INTEGER NOT NULL DEFAULT 0,
    cards_with_prices_count INTEGER NOT NULL DEFAULT 0,
    cards_with_windows_count INTEGER NOT NULL DEFAULT 0,
    coverage_pct DECIMAL(5,2) DEFAULT 0, -- % of cards with price data
    
    -- Price aggregations (loose price as primary metric)
    avg_loose_price DECIMAL(15,2),
    median_loose_price DECIMAL(15,2),
    min_loose_price DECIMAL(15,2),
    max_loose_price DECIMAL(15,2),
    price_range_pct DECIMAL(8,4), -- (max-min)/min * 100
    std_dev_price DECIMAL(15,4), -- Price dispersion
    
    -- Market activity
    total_sales_volume BIGINT DEFAULT 0,
    total_market_value NUMERIC(20,2), -- Use NUMERIC for very large sums
    avg_daily_volume DECIMAL(15,2), -- Increased precision
    
    -- Performance metrics (7d window as primary)
    avg_price_change_pct_7d DECIMAL(12,4),
    avg_price_change_pct_30d DECIMAL(12,4),
    weighted_avg_change_pct_7d DECIMAL(12,4), -- Volume-weighted
    
    -- Cards up/down counts
    cards_up_count_7d INTEGER DEFAULT 0,
    cards_down_count_7d INTEGER DEFAULT 0,
    cards_flat_count_7d INTEGER DEFAULT 0,
    pct_cards_up_7d DECIMAL(12,4),
    
    -- Volatility aggregations
    avg_volatility_30d DECIMAL(12,4),
    high_volatility_cards_count INTEGER DEFAULT 0, -- vol > 10%
    high_volatility_cards_pct DECIMAL(12,4),
    
    -- Liquidity score (0-100)
    liquidity_score DECIMAL(12,4),
    
    -- Computed timestamp
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(set_id, date)
);

-- Performance indexes
CREATE INDEX idx_sets_metrics_date ON sets_computed_metrics(date);
CREATE INDEX idx_sets_metrics_set_id ON sets_computed_metrics(set_id);
CREATE INDEX idx_sets_metrics_computed_at ON sets_computed_metrics(computed_at);

-- Composite index for common queries
CREATE INDEX idx_sets_metrics_date_coverage ON sets_computed_metrics(date, coverage_pct) WHERE coverage_pct > 50;

COMMENT ON TABLE sets_computed_metrics IS 'Aggregated daily metrics at the card set level, computed from card_computed_metrics and card_daily_snapshots';
COMMENT ON COLUMN sets_computed_metrics.coverage_pct IS 'Percentage of cards in set that have price data (0-100)';
COMMENT ON COLUMN sets_computed_metrics.liquidity_score IS 'Composite score 0-100 based on volume distribution and consistency';
COMMENT ON COLUMN sets_computed_metrics.weighted_avg_change_pct_7d IS 'Volume-weighted average price change, gives more weight to frequently traded cards';
