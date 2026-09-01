-- ============================================================================
-- REBUILD: card_computed_metrics
-- Only high-value trader metrics that will NOT be blank.
-- Rolling averages live on card_daily_snapshots — not duplicated here.
-- ============================================================================

SET statement_timeout = '300s';

-- Drop dependent views first
DROP VIEW IF EXISTS vw_card_metrics_multi_field CASCADE;
DROP VIEW IF EXISTS vw_card_grading_opportunities CASCADE;
DROP VIEW IF EXISTS reports_latest_card_computed_metrics CASCADE;
DROP VIEW IF EXISTS vw_card_metrics_current CASCADE;
DROP VIEW IF EXISTS vw_card_complete CASCADE;

-- Drop and recreate
DROP TABLE IF EXISTS card_computed_metrics CASCADE;

CREATE TABLE card_computed_metrics (
    card_id BIGINT NOT NULL,
    date DATE NOT NULL,

    -- Card identity (denormalized for fast reads)
    console_name TEXT NOT NULL,          -- Set name
    product_name TEXT NOT NULL,          -- Card/player description

    -- Current day price
    loose_price NUMERIC(12,2) NOT NULL,

    -- 7-day price range (always populated — we have 7+ days)
    high_7d NUMERIC(12,2) NOT NULL,
    low_7d NUMERIC(12,2) NOT NULL,
    range_pct_7d NUMERIC(6,2) NOT NULL,  -- (high-low)/low * 100 — how much price swung

    -- 15-day price range
    high_15d NUMERIC(12,2) NOT NULL,
    low_15d NUMERIC(12,2) NOT NULL,
    range_pct_15d NUMERIC(6,2) NOT NULL,

    -- 30-day price range (uses whatever days exist up to 30)
    high_30d NUMERIC(12,2) NOT NULL,
    low_30d NUMERIC(12,2) NOT NULL,
    range_pct_30d NUMERIC(6,2) NOT NULL,

    -- Price vs recent range (where does today's price sit in the 7d range?)
    -- 0 = at the low, 100 = at the high
    price_position_7d NUMERIC(5,1) NOT NULL,

    -- Price change: today vs earliest price in window (always computable)
    price_change_pct NUMERIC(8,2) NOT NULL,  -- % change from earliest available price

    -- Trend direction: based on price_change_pct
    trend_state TEXT NOT NULL,               -- Rising / Stable / Declining

    -- Days of price data available
    days_of_data INTEGER NOT NULL,

    -- Metadata
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (card_id, date)
);

CREATE INDEX idx_cm_date ON card_computed_metrics(date);
CREATE INDEX idx_cm_trend ON card_computed_metrics(trend_state, date);
CREATE INDEX idx_cm_range ON card_computed_metrics(range_pct_7d DESC, date);
CREATE INDEX idx_cm_change ON card_computed_metrics(price_change_pct DESC, date);

COMMENT ON TABLE card_computed_metrics IS 'High-value trader metrics. Every field is guaranteed non-null. Rolling averages live on card_daily_snapshots.';

-- ============================================================================
-- View: Latest computed metrics per card
-- ============================================================================

CREATE VIEW reports_latest_card_computed_metrics AS
SELECT DISTINCT ON (card_id)
    card_id,
    date as metric_date,
    console_name,
    product_name,
    loose_price,
    high_7d, low_7d, range_pct_7d,
    high_15d, low_15d, range_pct_15d,
    high_30d, low_30d, range_pct_30d,
    price_position_7d,
    price_change_pct,
    trend_state,
    days_of_data,
    computed_at
FROM card_computed_metrics
ORDER BY card_id, date DESC;

COMMENT ON VIEW reports_latest_card_computed_metrics IS 'Latest computed metrics for each card';

CREATE VIEW vw_card_metrics_current AS
SELECT * FROM reports_latest_card_computed_metrics;
