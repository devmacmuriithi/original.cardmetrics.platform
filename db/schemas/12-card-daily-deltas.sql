-- ============================================================================
-- NEW: card_daily_deltas - Daily price changes for all price fields
-- ============================================================================
-- Purpose: Store yesterday/today/diff for all price fields to enable quick
--          comparison views without joining to card_daily_snapshots
-- 
-- Data flow: card_daily_snapshots (raw) → card_daily_deltas (computed deltas)
-- 
-- Note: This is separate from:
--   - card_daily_snapshots: Raw source data (no computed fields)
--   - card_computed_metrics: Investment analytics (momentum, volatility, trend state)
-- ============================================================================

DROP TABLE IF EXISTS card_daily_deltas CASCADE;

CREATE TABLE card_daily_deltas (
    id SERIAL PRIMARY KEY,
    
    -- Reference fields (denormalized from card_daily_snapshots for quick views)
    card_id BIGINT NOT NULL REFERENCES cards(id),
    console_uid TEXT NOT NULL,
    date DATE NOT NULL,
    console_name TEXT,              -- From card_daily_snapshots.console_name
    product_name TEXT,              -- From card_daily_snapshots.product_name
    
    -- Loose Price deltas
    loose_price_yesterday NUMERIC(12,2),
    loose_price_today NUMERIC(12,2),
    loose_price_diff NUMERIC(12,2),         -- today - yesterday
    loose_price_diff_pct NUMERIC(6,2),      -- ((today - yesterday) / yesterday) * 100
    
    -- Graded Price deltas
    graded_price_yesterday NUMERIC(12,2),
    graded_price_today NUMERIC(12,2),
    graded_price_diff NUMERIC(12,2),
    graded_price_diff_pct NUMERIC(6,2),
    
    -- PSA 10 Price deltas
    psa10_price_yesterday NUMERIC(12,2),
    psa10_price_today NUMERIC(12,2),
    psa10_price_diff NUMERIC(12,2),
    psa10_price_diff_pct NUMERIC(6,2),
    
    -- BGS 10 Price deltas
    bgs10_price_yesterday NUMERIC(12,2),
    bgs10_price_today NUMERIC(12,2),
    bgs10_price_diff NUMERIC(12,2),
    bgs10_price_diff_pct NUMERIC(6,2),
    
    -- CIB (Complete In Box) Price deltas
    cib_price_yesterday NUMERIC(12,2),
    cib_price_today NUMERIC(12,2),
    cib_price_diff NUMERIC(12,2),
    cib_price_diff_pct NUMERIC(6,2),
    
    -- New Price deltas
    new_price_yesterday NUMERIC(12,2),
    new_price_today NUMERIC(12,2),
    new_price_diff NUMERIC(12,2),
    new_price_diff_pct NUMERIC(6,2),
    
    -- Box Only Price deltas
    box_only_price_yesterday NUMERIC(12,2),
    box_only_price_today NUMERIC(12,2),
    box_only_price_diff NUMERIC(12,2),
    box_only_price_diff_pct NUMERIC(6,2),
    
    -- Manual Only Price deltas
    manual_only_price_yesterday NUMERIC(12,2),
    manual_only_price_today NUMERIC(12,2),
    manual_only_price_diff NUMERIC(12,2),
    manual_only_price_diff_pct NUMERIC(6,2),
    
    -- Condition 17 Price deltas
    condition_17_price_yesterday NUMERIC(12,2),
    condition_17_price_today NUMERIC(12,2),
    condition_17_price_diff NUMERIC(12,2),
    condition_17_price_diff_pct NUMERIC(6,2),
    
    -- Condition 18 Price deltas
    condition_18_price_yesterday NUMERIC(12,2),
    condition_18_price_today NUMERIC(12,2),
    condition_18_price_diff NUMERIC(12,2),
    condition_18_price_diff_pct NUMERIC(6,2),
    
    -- GameStop Price deltas
    gamestop_price_yesterday NUMERIC(12,2),
    gamestop_price_today NUMERIC(12,2),
    gamestop_price_diff NUMERIC(12,2),
    gamestop_price_diff_pct NUMERIC(6,2),
    
    -- GameStop Trade Price deltas
    gamestop_trade_price_yesterday NUMERIC(12,2),
    gamestop_trade_price_today NUMERIC(12,2),
    gamestop_trade_price_diff NUMERIC(12,2),
    gamestop_trade_price_diff_pct NUMERIC(6,2),
    
    -- Retail Loose Buy deltas
    retail_loose_buy_yesterday NUMERIC(12,2),
    retail_loose_buy_today NUMERIC(12,2),
    retail_loose_buy_diff NUMERIC(12,2),
    retail_loose_buy_diff_pct NUMERIC(6,2),
    
    -- Retail Loose Sell deltas
    retail_loose_sell_yesterday NUMERIC(12,2),
    retail_loose_sell_today NUMERIC(12,2),
    retail_loose_sell_diff NUMERIC(12,2),
    retail_loose_sell_diff_pct NUMERIC(6,2),
    
    -- Retail CIB Buy deltas
    retail_cib_buy_yesterday NUMERIC(12,2),
    retail_cib_buy_today NUMERIC(12,2),
    retail_cib_buy_diff NUMERIC(12,2),
    retail_cib_buy_diff_pct NUMERIC(6,2),
    
    -- Retail CIB Sell deltas
    retail_cib_sell_yesterday NUMERIC(12,2),
    retail_cib_sell_today NUMERIC(12,2),
    retail_cib_sell_diff NUMERIC(12,2),
    retail_cib_sell_diff_pct NUMERIC(6,2),
    
    -- Retail New Buy deltas
    retail_new_buy_yesterday NUMERIC(12,2),
    retail_new_buy_today NUMERIC(12,2),
    retail_new_buy_diff NUMERIC(12,2),
    retail_new_buy_diff_pct NUMERIC(6,2),
    
    -- Retail New Sell deltas
    retail_new_sell_yesterday NUMERIC(12,2),
    retail_new_sell_today NUMERIC(12,2),
    retail_new_sell_diff NUMERIC(12,2),
    retail_new_sell_diff_pct NUMERIC(6,2),
    
    -- Sales Volume deltas
    sales_volume_yesterday NUMERIC,
    sales_volume_today NUMERIC,
    sales_volume_diff NUMERIC,
    sales_volume_diff_pct NUMERIC(6,2),
    
    -- Metadata
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    has_prior_day_data BOOLEAN DEFAULT FALSE,  -- TRUE if yesterday data exists
    
    UNIQUE(card_id, date)
);

-- Indexes for quick lookups
CREATE INDEX idx_daily_deltas_card ON card_daily_deltas(card_id);
CREATE INDEX idx_daily_deltas_date ON card_daily_deltas(date);
CREATE INDEX idx_daily_deltas_console ON card_daily_deltas(console_uid);
CREATE INDEX idx_daily_deltas_composite ON card_daily_deltas(card_id, date);
CREATE INDEX idx_daily_deltas_loose_diff ON card_daily_deltas(loose_price_diff_pct) WHERE loose_price_diff_pct IS NOT NULL;
CREATE INDEX idx_daily_deltas_has_prior ON card_daily_deltas(has_prior_day_data, date);

COMMENT ON TABLE card_daily_deltas IS 'Daily price deltas (yesterday/today/diff) for all price fields from card_daily_snapshots. Denormalized reference fields included for quick views without joins.';

-- ============================================================================
-- View: Quick delta summary for dashboard/reporting
-- ============================================================================

DROP VIEW IF EXISTS vw_card_daily_deltas_summary;

CREATE VIEW vw_card_daily_deltas_summary AS
SELECT 
    card_id,
    console_uid,
    date,
    console_name,
    product_name,
    -- Key price deltas
    loose_price_yesterday,
    loose_price_today,
    loose_price_diff,
    loose_price_diff_pct,
    graded_price_diff_pct,
    psa10_price_diff_pct,
    -- Sales volume
    sales_volume_yesterday,
    sales_volume_today,
    sales_volume_diff,
    -- Flags
    has_prior_day_data,
    computed_at
FROM card_daily_deltas
ORDER BY date DESC, card_id;

COMMENT ON VIEW vw_card_daily_deltas_summary IS 'Simplified view of card_daily_deltas showing key price changes';
