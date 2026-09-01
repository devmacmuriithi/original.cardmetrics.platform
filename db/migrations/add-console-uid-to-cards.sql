-- ============================================================================
-- ADD: console_uid column to cards table for matching with CSV data
-- ============================================================================

SET statement_timeout = '300s';

-- Add console_uid column (nullable initially, will populate from CSVs)
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS console_uid TEXT;

-- Create index for fast joins
CREATE INDEX IF NOT EXISTS idx_cards_console_uid ON cards(console_uid) WHERE console_uid IS NOT NULL;

-- Add comment
COMMENT ON COLUMN cards.console_uid IS 'Console UID from CSV filename (e.g., G1096) - matches console_uid in cards_raw_ingests';
