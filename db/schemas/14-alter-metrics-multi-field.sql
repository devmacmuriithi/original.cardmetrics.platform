-- ============================================================================
-- ALTER: Extend card_computed_metrics with multi-field investment metrics
-- ============================================================================
-- This adds per-price-type columns (loose, psa10, graded) to card_computed_metrics
-- keeping the original loose_price-based metrics as the primary/default view
-- ============================================================================

-- Add multi-field investment metrics columns
ALTER TABLE card_computed_metrics
    -- Loose price metrics (explicitly named for clarity)
    ADD COLUMN IF NOT EXISTS loose_momentum NUMERIC(6,3),
    ADD COLUMN IF NOT EXISTS loose_trend_state TEXT,
    ADD COLUMN IF NOT EXISTS loose_volatility_score NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS loose_liquidity_score NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS loose_avg_30d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS loose_avg_90d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS loose_price_change_7d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS loose_price_change_30d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS loose_execution_eligible BOOLEAN DEFAULT FALSE,
    
    -- PSA 10 metrics
    ADD COLUMN IF NOT EXISTS psa10_momentum NUMERIC(6,3),
    ADD COLUMN IF NOT EXISTS psa10_trend_state TEXT,
    ADD COLUMN IF NOT EXISTS psa10_volatility_score NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS psa10_liquidity_score NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS psa10_avg_30d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS psa10_avg_90d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS psa10_price_change_7d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS psa10_price_change_30d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS psa10_execution_eligible BOOLEAN DEFAULT FALSE,
    
    -- Graded metrics
    ADD COLUMN IF NOT EXISTS graded_momentum NUMERIC(6,3),
    ADD COLUMN IF NOT EXISTS graded_trend_state TEXT,
    ADD COLUMN IF NOT EXISTS graded_volatility_score NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS graded_liquidity_score NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS graded_avg_30d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS graded_avg_90d NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS graded_price_change_7d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS graded_price_change_30d NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS graded_execution_eligible BOOLEAN DEFAULT FALSE,
    
    -- Cross-field analytics
    ADD COLUMN IF NOT EXISTS psa10_loose_spread NUMERIC(6,2),  -- % premium of PSA10 over loose
    ADD COLUMN IF NOT EXISTS graded_loose_spread NUMERIC(6,2),  -- % premium of graded over loose
    ADD COLUMN IF NOT EXISTS psa10_graded_spread NUMERIC(6,2),  -- % premium of PSA10 over graded
    ADD COLUMN IF NOT EXISTS grading_upside_potential NUMERIC(6,2),  -- Expected return if you grade loose
    ADD COLUMN IF NOT EXISTS best_value_price_type TEXT,  -- 'loose', 'psa10', or 'graded'
    
    -- Additional data quality
    ADD COLUMN IF NOT EXISTS loose_days_of_data INTEGER,
    ADD COLUMN IF NOT EXISTS psa10_days_of_data INTEGER,
    ADD COLUMN IF NOT EXISTS graded_days_of_data INTEGER;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_cm_loose_momentum ON card_computed_metrics(loose_momentum) WHERE loose_momentum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cm_psa10_momentum ON card_computed_metrics(psa10_momentum) WHERE psa10_momentum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cm_graded_momentum ON card_computed_metrics(graded_momentum) WHERE graded_momentum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cm_psa10_spread ON card_computed_metrics(psa10_loose_spread) WHERE psa10_loose_spread IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cm_best_value ON card_computed_metrics(best_value_price_type) WHERE best_value_price_type IS NOT NULL;

-- Update comment
COMMENT ON TABLE card_computed_metrics IS 'Derived analytics with multi-field investment metrics (loose, psa10, graded) and cross-price spreads';

-- ============================================================================
-- View: Multi-field comparison (side-by-side all price types)
-- ============================================================================

DROP VIEW IF EXISTS vw_card_metrics_multi_field;

CREATE VIEW vw_card_metrics_multi_field AS
SELECT 
    card_id,
    date,
    
    -- Loose metrics
    loose_momentum,
    loose_trend_state,
    loose_volatility_score,
    loose_price_change_7d,
    loose_execution_eligible,
    
    -- PSA10 metrics
    psa10_momentum,
    psa10_trend_state,
    psa10_volatility_score,
    psa10_price_change_7d,
    psa10_execution_eligible,
    
    -- Graded metrics
    graded_momentum,
    graded_trend_state,
    graded_volatility_score,
    graded_price_change_7d,
    graded_execution_eligible,
    
    -- Spreads
    psa10_loose_spread,
    graded_loose_spread,
    grading_upside_potential,
    best_value_price_type
    
FROM card_computed_metrics
WHERE loose_momentum IS NOT NULL 
   OR psa10_momentum IS NOT NULL 
   OR graded_momentum IS NOT NULL;

COMMENT ON VIEW vw_card_metrics_multi_field IS 'Side-by-side comparison of loose, PSA10, and graded metrics';

-- ============================================================================
-- View: Best value opportunities (grading arbitrage)
-- ============================================================================

DROP VIEW IF EXISTS vw_card_grading_opportunities;

CREATE VIEW vw_card_grading_opportunities AS
SELECT 
    card_id,
    date,
    loose_avg_30d as loose_price,
    psa10_avg_30d as psa10_price,
    psa10_loose_spread,
    grading_upside_potential,
    CASE 
        WHEN grading_upside_potential > 200 THEN 'high'
        WHEN grading_upside_potential > 100 THEN 'medium'
        ELSE 'low'
    END as opportunity_tier
FROM card_computed_metrics
WHERE grading_upside_potential IS NOT NULL
  AND grading_upside_potential > 50
  AND loose_execution_eligible = TRUE
ORDER BY grading_upside_potential DESC;

COMMENT ON VIEW vw_card_grading_opportunities IS 'Cards with high potential returns from grading (buy loose, sell PSA10)';
