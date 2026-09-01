-- ============================================================================
-- Fix cards table id column to auto-increment
-- ============================================================================

SET statement_timeout = '300s';

-- Create sequence for id if not exists
CREATE SEQUENCE IF NOT EXISTS cards_id_seq;

-- Alter id column to use the sequence
ALTER TABLE cards 
ALTER COLUMN id SET DEFAULT nextval('cards_id_seq');

-- Set sequence to start after max existing id
SELECT setval('cards_id_seq', COALESCE((SELECT MAX(id) FROM cards), 0) + 1);

-- Make id nullable temporarily for existing data migration if needed
-- ALTER TABLE cards ALTER COLUMN id DROP NOT NULL;

COMMENT ON TABLE cards IS 'Cards table with auto-incrementing id and external card_id (TCGPLAYER ID)';
