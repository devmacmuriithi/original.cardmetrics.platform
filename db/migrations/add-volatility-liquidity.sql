-- ============================================================================
-- ADD: loose_price volatility and liquidity to card_computed_metrics
-- ============================================================================

SET statement_timeout = '300s';

-- Add new columns (nullable since not all cards have sales data)
ALTER TABLE card_computed_metrics 
ADD COLUMN IF NOT EXISTS loose_price_volatility_7d NUMERIC(6,4),
ADD COLUMN IF NOT EXISTS loose_price_liquidity NUMERIC(10,2);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_cm_volatility ON card_computed_metrics(loose_price_volatility_7d DESC NULLS LAST) WHERE loose_price_volatility_7d IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cm_liquidity ON card_computed_metrics(loose_price_liquidity DESC NULLS LAST) WHERE loose_price_liquidity IS NOT NULL;

COMMENT ON COLUMN card_computed_metrics.loose_price_volatility_7d IS 'Coefficient of variation (stddev/mean) of loose_price over 7 days. Higher = more volatile.';
COMMENT ON COLUMN card_computed_metrics.loose_price_liquidity IS 'Sales volume normalized score. Higher = more liquid (more sales).';
