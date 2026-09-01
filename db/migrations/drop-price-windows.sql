-- ============================================================================
-- Migration: Remove card_price_windows and dependent view
-- ============================================================================

-- 1. Drop the view that uses card_price_windows
DROP VIEW IF EXISTS reports_multi_window_performance;

-- 2. Drop indexes on card_price_windows
DROP INDEX IF EXISTS idx_price_windows_card;
DROP INDEX IF EXISTS idx_price_windows_date;
DROP INDEX IF EXISTS idx_price_windows_7d;
DROP INDEX IF EXISTS idx_price_windows_30d;
DROP INDEX IF EXISTS idx_price_windows_composite;
DROP INDEX IF EXISTS idx_price_windows_trajectory;

-- 3. Drop the table
DROP TABLE IF EXISTS card_price_windows CASCADE;

-- 4. Clean up related analytics table (also deprecated)
DROP TABLE IF EXISTS card_analytics_daily CASCADE;

-- 5. Remove indexes on analytics table
DROP INDEX IF EXISTS idx_analytics_daily_card;
DROP INDEX IF EXISTS idx_analytics_daily_date;
DROP INDEX IF EXISTS idx_analytics_daily_breakout;
DROP INDEX IF EXISTS idx_analytics_daily_trending;
DROP INDEX IF EXISTS idx_analytics_daily_consolidating;
DROP INDEX IF EXISTS idx_analytics_daily_7d_change;

-- 6. Clean up views that reference analytics tables
DROP VIEW IF EXISTS reports_consolidating_assets;
DROP VIEW IF EXISTS reports_data_quality;

COMMIT;
