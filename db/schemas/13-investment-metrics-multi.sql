-- ============================================================================
-- Multi-Field Investment Metrics Schema
-- ============================================================================
-- Purpose: Investment metrics computed across multiple price types (loose, psa10, graded)
-- with 7-day focus for short-term signals and cross-price spread analysis
--
-- Tables:
--   - card_investment_metrics_by_type: Per-price-type metrics (loose, psa10, graded)
--   - card_price_spreads: Cross-price spreads and arbitrage signals
--
-- Views:
--   - vw_card_investment_primary: Best available price type per card
-- ============================================================================

-- ============================================================================
-- Investment metrics for key price types (loose, psa10, graded)
-- ============================================================================

DROP TABLE IF EXISTS card_investment_metrics_by_type CASCADE;

CREATE TABLE card_investment_metrics_by_type (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    date DATE NOT NULL,
    price_type TEXT NOT NULL,  -- 'loose', 'psa10', 'graded'
    
    -- 7-day metrics (key for short-term signals)
    price_7d NUMERIC(12,2),           -- Price 7 days ago
    price_current NUMERIC(12,2),      -- Today's price
    change_7d_abs NUMERIC(12,2),      -- Current - 7d_ago
    change_7d_pct NUMERIC(6,2),       -- % change over 7 days
    momentum_7d NUMERIC(6,3),         -- Rate of change
    
    -- Standard investment metrics
    trend_state TEXT,                 -- 'Rising', 'Stable', 'Declining'
    trend_strength NUMERIC(4,2),      -- 0-1 scale
    volatility_7d NUMERIC(4,2),       -- 7-day volatility
    volatility_30d NUMERIC(4,2),      -- 30-day volatility
    avg_7d NUMERIC(12,2),             -- 7-day moving average
    avg_30d NUMERIC(12,2),            -- 30-day moving average
    
    -- Data quality
    days_of_data INTEGER,
    execution_eligible BOOLEAN DEFAULT FALSE,       -- Can trade based on this price type
    
    -- Metadata
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(card_id, date, price_type)
);

CREATE INDEX idx_inv_metrics_card ON card_investment_metrics_by_type(card_id);
CREATE INDEX idx_inv_metrics_date ON card_investment_metrics_by_type(date);
CREATE INDEX idx_inv_metrics_type ON card_investment_metrics_by_type(price_type);
CREATE INDEX idx_inv_metrics_composite ON card_investment_metrics_by_type(card_id, date, price_type);
CREATE INDEX idx_inv_metrics_7d_change ON card_investment_metrics_by_type(change_7d_pct) WHERE change_7d_pct IS NOT NULL;
CREATE INDEX idx_inv_metrics_trend ON card_investment_metrics_by_type(trend_state) WHERE trend_state IS NOT NULL;
CREATE INDEX idx_inv_metrics_eligible ON card_investment_metrics_by_type(execution_eligible) WHERE execution_eligible = TRUE;

COMMENT ON TABLE card_investment_metrics_by_type IS 'Investment metrics computed per price type (loose, psa10, graded) with 7-day focus';

-- ============================================================================
-- Cross-price spreads and arbitrage signals
-- ============================================================================

DROP TABLE IF EXISTS card_price_spreads CASCADE;

CREATE TABLE card_price_spreads (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    date DATE NOT NULL,
    
    -- Raw prices for comparison (denormalized for quick access)
    loose_price NUMERIC(12,2),
    psa10_price NUMERIC(12,2),
    graded_price NUMERIC(12,2),
    
    -- Spreads (% premium of higher grade over lower)
    psa10_loose_spread NUMERIC(6,2),    -- (psa10 - loose) / loose * 100
    graded_loose_spread NUMERIC(6,2),    -- (graded - loose) / loose * 100
    psa10_graded_spread NUMERIC(6,2),    -- (psa10 - graded) / graded * 100
    
    -- Arbitrage signals
    grading_upside_potential NUMERIC(6,2),  -- Expected return if you grade this card
    best_value_price_type TEXT,              -- 'loose', 'psa10', or 'graded' - best deal
    grade_premium_tier TEXT,                 -- 'high', 'normal', 'low' premium vs typical
    
    -- Metadata
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(card_id, date)
);

CREATE INDEX idx_price_spreads_card ON card_price_spreads(card_id);
CREATE INDEX idx_price_spreads_date ON card_price_spreads(date);
CREATE INDEX idx_price_spreads_loose_spread ON card_price_spreads(psa10_loose_spread) WHERE psa10_loose_spread IS NOT NULL;
CREATE INDEX idx_price_spreads_upside ON card_price_spreads(grading_upside_potential) WHERE grading_upside_potential IS NOT NULL;
CREATE INDEX idx_price_spreads_best_value ON card_price_spreads(best_value_price_type) WHERE best_value_price_type IS NOT NULL;

COMMENT ON TABLE card_price_spreads IS 'Cross-price spreads and arbitrage signals between loose, graded, and PSA10 prices';

-- ============================================================================
-- Primary view: Best available price type per card
-- ============================================================================

DROP VIEW IF EXISTS vw_card_investment_primary CASCADE;

CREATE VIEW vw_card_investment_primary AS
SELECT DISTINCT ON (card_id, date)
    card_id,
    date,
    price_type as primary_price_type,
    price_current,
    change_7d_pct,
    trend_state,
    volatility_30d,
    execution_eligible
FROM card_investment_metrics_by_type
WHERE price_current IS NOT NULL
ORDER BY card_id, date, 
    CASE price_type 
        WHEN 'psa10' THEN 1 
        WHEN 'graded' THEN 2 
        WHEN 'loose' THEN 3 
    END;

COMMENT ON VIEW vw_card_investment_primary IS 'Best available price type per card (PSA10 preferred, then graded, then loose)';

-- ============================================================================
-- Additional views for common queries
-- ============================================================================

-- View: All metrics joined for comparison
DROP VIEW IF EXISTS vw_card_investment_comparison CASCADE;

CREATE VIEW vw_card_investment_comparison AS
SELECT 
    l.card_id,
    l.date,
    l.price_current as loose_price,
    l.change_7d_pct as loose_7d_change,
    l.trend_state as loose_trend,
    g.price_current as graded_price,
    g.change_7d_pct as graded_7d_change,
    g.trend_state as graded_trend,
    p.price_current as psa10_price,
    p.change_7d_pct as psa10_7d_change,
    p.trend_state as psa10_trend,
    s.psa10_loose_spread,
    s.graded_loose_spread,
    s.grading_upside_potential,
    s.best_value_price_type
FROM card_investment_metrics_by_type l
LEFT JOIN card_investment_metrics_by_type g 
    ON l.card_id = g.card_id AND l.date = g.date AND g.price_type = 'graded'
LEFT JOIN card_investment_metrics_by_type p 
    ON l.card_id = p.card_id AND l.date = p.date AND p.price_type = 'psa10'
LEFT JOIN card_price_spreads s 
    ON l.card_id = s.card_id AND l.date = s.date
WHERE l.price_type = 'loose';

COMMENT ON VIEW vw_card_investment_comparison IS 'Side-by-side comparison of loose, graded, and PSA10 metrics';
