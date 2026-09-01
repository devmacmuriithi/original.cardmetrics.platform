-- ============================================================================
-- Drop enriched views (replaced by denormalized columns in cards table)
-- ============================================================================

DROP VIEW IF EXISTS vw_cards_enriched CASCADE;
DROP VIEW IF EXISTS vw_cards_full CASCADE;

-- Note: vw_card_complete in 03-core-schema.sql uses card_computed_metrics
-- and may reference these columns. If needed, that view can query cards directly.

SELECT 'Enriched views dropped. Use denormalized columns in cards table instead.' as status;
