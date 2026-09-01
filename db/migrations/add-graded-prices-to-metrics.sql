-- ============================================================================
-- Add graded price fields and volume to card_computed_metrics
-- These are sourced from card_daily_snapshots for the computation date
-- ============================================================================

SET statement_timeout = '300s';

-- Add graded price and volume fields
ALTER TABLE card_computed_metrics
  ADD COLUMN IF NOT EXISTS graded_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS psa10_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS bgs10_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sales_volume NUMERIC;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metrics_graded_price ON card_computed_metrics(graded_price) WHERE graded_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_psa10_price ON card_computed_metrics(psa10_price) WHERE psa10_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_sales_volume ON card_computed_metrics(sales_volume) WHERE sales_volume > 0;

-- Add comments
COMMENT ON COLUMN card_computed_metrics.graded_price IS 'Generic graded price from card_daily_snapshots for this date';
COMMENT ON COLUMN card_computed_metrics.psa10_price IS 'PSA 10 graded price from card_daily_snapshots for this date';
COMMENT ON COLUMN card_computed_metrics.bgs10_price IS 'BGS 10 graded price from card_daily_snapshots for this date';
COMMENT ON COLUMN card_computed_metrics.sales_volume IS '365-day rolling sales volume from card_daily_snapshots for this date';
