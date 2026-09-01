-- ============================================================================
-- ADD: card_id column to cards table (TCGPLAYER ID for joins)
-- ============================================================================

SET statement_timeout = '300s';

-- Add card_id column (nullable initially, will populate from cards_raw_ingests)
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS card_id BIGINT UNIQUE;

-- Create index for fast joins
CREATE INDEX IF NOT EXISTS idx_cards_card_id ON cards(card_id) WHERE card_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN cards.card_id IS 'TCGPLAYER ID from CSV - matches card_id in card_daily_snapshots and card_computed_metrics';
