-- ============================================================================
-- ADD: All price volatility and liquidity fields
-- ============================================================================

SET statement_timeout = '300s';

-- Add columns for loose, graded, and psa10 (all nullable since not all cards have all price types)
ALTER TABLE card_computed_metrics 
ADD COLUMN IF NOT EXISTS loose_price_volatility NUMERIC(6,4),
ADD COLUMN IF NOT EXISTS loose_price_liquidity NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS graded_price_volatility NUMERIC(6,4),
ADD COLUMN IF NOT EXISTS graded_price_liquidity NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS psa10_price_volatility NUMERIC(6,4),
ADD COLUMN IF NOT EXISTS psa10_price_liquidity NUMERIC(10,2);

-- Drop old index if exists and create new ones
DROP INDEX IF EXISTS idx_cm_volatility;
DROP INDEX IF EXISTS idx_cm_volatility_loose;
DROP INDEX IF EXISTS idx_cm_volatility_graded;
DROP INDEX IF EXISTS idx_cm_volatility_psa10;

CREATE INDEX idx_cm_volatility_loose ON card_computed_metrics(loose_price_volatility DESC NULLS LAST) WHERE loose_price_volatility IS NOT NULL;
CREATE INDEX idx_cm_volatility_graded ON card_computed_metrics(graded_price_volatility DESC NULLS LAST) WHERE graded_price_volatility IS NOT NULL;
CREATE INDEX idx_cm_volatility_psa10 ON card_computed_metrics(psa10_price_volatility DESC NULLS LAST) WHERE psa10_price_volatility IS NOT NULL;

COMMENT ON COLUMN card_computed_metrics.loose_price_volatility IS 'Coefficient of variation (stddev/mean) of loose_price over 7 days';
COMMENT ON COLUMN card_computed_metrics.loose_price_liquidity IS 'Sales volume per day for loose cards over 7 days';
COMMENT ON COLUMN card_computed_metrics.graded_price_volatility IS 'Coefficient of variation (stddev/mean) of graded_price over 7 days';
COMMENT ON COLUMN card_computed_metrics.graded_price_liquidity IS 'Sales volume per day for graded cards over 7 days';
COMMENT ON COLUMN card_computed_metrics.psa10_price_volatility IS 'Coefficient of variation (stddev/mean) of psa10_price over 7 days';
COMMENT ON COLUMN card_computed_metrics.psa10_price_liquidity IS 'Sales volume per day for PSA10 cards over 7 days';
