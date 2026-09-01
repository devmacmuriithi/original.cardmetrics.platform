-- ============================================================================
-- Migration: Remove card_investment_metrics_by_type and related tables
-- ============================================================================

-- Drop views that depend on these tables
DROP VIEW IF EXISTS vw_card_investment_primary CASCADE;
DROP VIEW IF EXISTS vw_card_investment_comparison CASCADE;

-- Drop indexes on investment metrics table
DROP INDEX IF EXISTS idx_inv_metrics_card;
DROP INDEX IF EXISTS idx_inv_metrics_date;
DROP INDEX IF EXISTS idx_inv_metrics_type;
DROP INDEX IF EXISTS idx_inv_metrics_composite;
DROP INDEX IF EXISTS idx_inv_metrics_7d_change;
DROP INDEX IF EXISTS idx_inv_metrics_trend;
DROP INDEX IF EXISTS idx_inv_metrics_eligible;

-- Drop indexes on price spreads table
DROP INDEX IF EXISTS idx_price_spreads_card;
DROP INDEX IF EXISTS idx_price_spreads_date;
DROP INDEX IF EXISTS idx_price_spreads_loose_spread;
DROP INDEX IF EXISTS idx_price_spreads_upside;
DROP INDEX IF EXISTS idx_price_spreads_best_value;

-- Drop the tables
DROP TABLE IF EXISTS card_investment_metrics_by_type CASCADE;
DROP TABLE IF EXISTS card_price_spreads CASCADE;

COMMIT;
