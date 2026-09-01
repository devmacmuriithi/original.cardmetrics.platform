-- ============================================================================
-- DROP ALL: Drop all tables and views in the database
-- ============================================================================
-- WARNING: This will delete all data!
-- ============================================================================

-- Drop all views first (they depend on tables)
DROP VIEW IF EXISTS vw_card_metrics_current CASCADE;
DROP VIEW IF EXISTS vw_card_metrics_multi_field CASCADE;
DROP VIEW IF EXISTS vw_card_grading_opportunities CASCADE;
DROP VIEW IF EXISTS vw_card_investment_primary CASCADE;
DROP VIEW IF EXISTS vw_card_daily_deltas_summary CASCADE;
DROP VIEW IF EXISTS vw_cards_complete CASCADE;
DROP VIEW IF EXISTS reports_daily_market_summary CASCADE;
DROP VIEW IF EXISTS reports_top_movers CASCADE;
DROP VIEW IF EXISTS reports_breakout_alerts CASCADE;
DROP VIEW IF EXISTS vw_card_sales_daily CASCADE;
DROP VIEW IF EXISTS vw_index_comparison CASCADE;
DROP VIEW IF EXISTS vw_index_performance CASCADE;
DROP VIEW IF EXISTS vw_cards_enriched CASCADE;
DROP VIEW IF EXISTS vw_cards_full CASCADE;
DROP VIEW IF EXISTS card_market_diff CASCADE;

-- Drop all tables
DROP TABLE IF EXISTS card_investment_metrics_by_type CASCADE;
DROP TABLE IF EXISTS card_price_spreads CASCADE;
DROP TABLE IF EXISTS card_price_windows CASCADE;
DROP TABLE IF EXISTS card_analytics_daily CASCADE;
DROP TABLE IF EXISTS analytics_export_queue CASCADE;
DROP TABLE IF EXISTS card_computed_metrics CASCADE;
DROP TABLE IF EXISTS card_daily_deltas CASCADE;
DROP TABLE IF EXISTS card_daily_snapshots CASCADE;
DROP TABLE IF EXISTS daily_price_comparisons_stored CASCADE;
DROP TABLE IF EXISTS card_sales CASCADE;
DROP TABLE IF EXISTS card_grades CASCADE;
DROP TABLE IF EXISTS card_attributes CASCADE;
DROP TABLE IF EXISTS card_types CASCADE;
DROP TABLE IF EXISTS variations CASCADE;
DROP TABLE IF EXISTS grading_companies CASCADE;
DROP TABLE IF EXISTS cards_raw_ingests CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS sets CASCADE;
DROP TABLE IF EXISTS sets_master CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS manufacturers CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;
DROP TABLE IF EXISTS sports CASCADE;
DROP TABLE IF EXISTS card_market_daily CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS denormalize_card(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS denormalize_all_cards() CASCADE;

-- Drop market indices tables
DROP TABLE IF EXISTS market_index_constituents CASCADE;
DROP TABLE IF EXISTS market_index_values CASCADE;
DROP TABLE IF EXISTS market_indices CASCADE;
DROP TABLE IF EXISTS alx_market_signals_daily CASCADE;
DROP TABLE IF EXISTS alx_signal_config CASCADE;

SELECT 'All tables and views dropped successfully' as status;
