-- ============================================================================
-- Migration: Remove trend/breakout fields from sets_computed_metrics
-- These fields were showing all zeros and are not currently populated
-- ============================================================================

SET statement_timeout = '300s';

-- Drop columns that are showing all zeros
ALTER TABLE sets_computed_metrics 
  DROP COLUMN IF EXISTS trending_up_count,
  DROP COLUMN IF EXISTS trending_down_count,
  DROP COLUMN IF EXISTS consolidating_count,
  DROP COLUMN IF EXISTS breakout_count,
  DROP COLUMN IF EXISTS breakdown_count,
  DROP COLUMN IF EXISTS pct_trending_up,
  DROP COLUMN IF EXISTS pct_trending_down,
  DROP COLUMN IF EXISTS pct_consolidating;

-- Drop the index that references the removed columns
DROP INDEX IF EXISTS idx_sets_metrics_trend_up;

-- Update the comment to reflect the change
COMMENT ON TABLE sets_computed_metrics IS 'Aggregated daily metrics at the card set level, computed from card_computed_metrics and card_daily_snapshots. Note: Trend distribution fields (up/down/consolidating/breakout/breakdown) removed as they were not populated.';
