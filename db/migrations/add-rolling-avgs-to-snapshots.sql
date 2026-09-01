-- ============================================================================
-- Migration: Add rolling average + % change columns to card_daily_snapshots
-- Run: psql $DATABASE_URL -f db/migrations/add-rolling-avgs-to-snapshots.sql
-- ============================================================================

-- Rolling averages (NULL = insufficient data for that window)
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS avg_3d NUMERIC(12,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS avg_7d NUMERIC(12,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS avg_14d NUMERIC(12,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS avg_30d NUMERIC(12,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS avg_60d NUMERIC(12,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS avg_90d NUMERIC(12,2);

-- % change vs N days ago (NULL = no prior data point found)
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS pct_change_3d NUMERIC(8,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS pct_change_7d NUMERIC(8,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS pct_change_14d NUMERIC(8,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS pct_change_30d NUMERIC(8,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS pct_change_60d NUMERIC(8,2);
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS pct_change_90d NUMERIC(8,2);

-- Data point counts per window (how many days contributed to the average)
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS data_points_3d SMALLINT;
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS data_points_7d SMALLINT;
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS data_points_14d SMALLINT;
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS data_points_30d SMALLINT;
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS data_points_60d SMALLINT;
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS data_points_90d SMALLINT;

-- When windows were last computed for this row
ALTER TABLE card_daily_snapshots ADD COLUMN IF NOT EXISTS windows_computed_at TIMESTAMP;

COMMENT ON COLUMN card_daily_snapshots.avg_3d IS '3-day rolling average of loose_price (min 2 data points)';
COMMENT ON COLUMN card_daily_snapshots.avg_7d IS '7-day rolling average of loose_price (min 3 data points)';
COMMENT ON COLUMN card_daily_snapshots.avg_14d IS '14-day rolling average of loose_price (min 5 data points)';
COMMENT ON COLUMN card_daily_snapshots.avg_30d IS '30-day rolling average of loose_price (min 10 data points)';
COMMENT ON COLUMN card_daily_snapshots.avg_60d IS '60-day rolling average of loose_price (min 15 data points)';
COMMENT ON COLUMN card_daily_snapshots.avg_90d IS '90-day rolling average of loose_price (min 20 data points)';
