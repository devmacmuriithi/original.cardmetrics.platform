-- ============================================================================
-- RENAME: loose_price_volatility_7d -> loose_price_volatility
-- ADD: graded and psa10 volatility/liquidity fields
-- ============================================================================

SET statement_timeout = '300s';

-- Rename existing column
ALTER TABLE card_computed_metrics 
RENAME COLUMN loose_price_volatility_7d TO loose_price_volatility;

-- Add new columns for graded and psa10
ALTER TABLE card_computed_metrics 
ADD COLUMN IF NOT EXISTS graded_price_volatility NUMERIC(6,4),
ADD COLUMN IF NOT EXISTS graded_price_liquidity NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS psa10_price_volatility NUMERIC(6,4),
ADD COLUMN IF NOT EXISTS psa10_price_liquidity NUMERIC(10,2);

-- Drop old index and create new ones
DROP INDEX IF EXISTS idx_cm_volatility;
CREATE INDEX idx_cm_volatility_loose ON card_computed_metrics(loose_price_volatility DESC NULLS LAST) WHERE loose_price_volatility IS NOT NULL;
CREATE INDEX idx_cm_volatility_graded ON card_computed_metrics(graded_price_volatility DESC NULLS LAST) WHERE graded_price_volatility IS NOT NULL;
CREATE INDEX idx_cm_volatility_psa10 ON card_computed_metrics(psa10_price_volatility DESC NULLS LAST) WHERE psa10_price_volatility IS NOT NULL;

COMMENT ON COLUMN card_computed_metrics.loose_price_volatility IS 'Coefficient of variation (stddev/mean) of loose_price over 7 days';
COMMENT ON COLUMN card_computed_metrics.graded_price_volatility IS 'Coefficient of variation (stddev/mean) of graded_price over 7 days';
COMMENT ON COLUMN card_computed_metrics.psa10_price_volatility IS 'Coefficient of variation (stddev/mean) of psa10_price over 7 days';
COMMENT ON COLUMN card_computed_metrics.graded_price_liquidity IS 'Sales volume for graded cards over 7 days';
COMMENT ON COLUMN card_computed_metrics.psa10_price_liquidity IS 'Sales volume for PSA10 cards over 7 days';
