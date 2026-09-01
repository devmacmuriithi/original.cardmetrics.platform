-- ============================================================================
-- ALTER: Add denormalized columns to cards table (while keeping FKs)
-- ============================================================================
-- Purpose: Add denormalized name columns for quick queries without joins
--          while keeping foreign keys for data integrity
-- ============================================================================

-- Add denormalized columns to cards table
ALTER TABLE cards
    -- Player info
    ADD COLUMN IF NOT EXISTS player_name TEXT,
    ADD COLUMN IF NOT EXISTS player_first_name TEXT,
    ADD COLUMN IF NOT EXISTS player_last_name TEXT,
    ADD COLUMN IF NOT EXISTS player_position TEXT,
    
    -- Team info
    ADD COLUMN IF NOT EXISTS team_name TEXT,
    ADD COLUMN IF NOT EXISTS team_city TEXT,
    ADD COLUMN IF NOT EXISTS team_abbr TEXT,
    
    -- Set info
    ADD COLUMN IF NOT EXISTS set_name TEXT,
    ADD COLUMN IF NOT EXISTS set_year INTEGER,
    ADD COLUMN IF NOT EXISTS set_console_uid TEXT,
    
    -- Manufacturer info
    ADD COLUMN IF NOT EXISTS manufacturer_name TEXT,
    
    -- League info
    ADD COLUMN IF NOT EXISTS league_name TEXT,
    ADD COLUMN IF NOT EXISTS league_abbr TEXT,
    
    -- Sport info
    ADD COLUMN IF NOT EXISTS sport_name TEXT,
    
    -- Metadata
    ADD COLUMN IF NOT EXISTS last_denormalized_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for the denormalized columns
CREATE INDEX IF NOT EXISTS idx_cards_player_name ON cards(player_name) WHERE player_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_team_name ON cards(team_name) WHERE team_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_set_name ON cards(set_name) WHERE set_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_manufacturer_name ON cards(manufacturer_name) WHERE manufacturer_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_sport_name ON cards(sport_name) WHERE sport_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_league_abbr ON cards(league_abbr) WHERE league_abbr IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_cards_denorm_composite ON cards(player_name, set_name, sport_name) 
    WHERE player_name IS NOT NULL AND set_name IS NOT NULL;

COMMENT ON TABLE cards IS 'Cards with denormalized dimension names (FKs retained for integrity). Use these columns for quick queries without joins.';

-- ============================================================================
-- Function to denormalize a single card
-- ============================================================================

CREATE OR REPLACE FUNCTION denormalize_card(p_card_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE cards c
    SET 
        player_name = p.full_name,
        player_first_name = p.first_name,
        player_last_name = p.last_name,
        player_position = p.position,
        team_name = t.name,
        team_city = t.city,
        team_abbr = t.abbreviation,
        set_name = s.name,
        set_year = s.year,
        set_console_uid = s.console_uid,
        manufacturer_name = m.name,
        league_name = l.name,
        league_abbr = l.abbreviation,
        sport_name = sp.name,
        last_denormalized_at = NOW()
    FROM players p, teams t, sets s, manufacturers m, leagues l, sports sp
    WHERE c.id = p_card_id
      AND c.player_id = p.id
      AND c.team_id = t.id
      AND c.set_id = s.id
      AND c.manufacturer_id = m.id
      AND c.league_id = l.id
      AND c.sport_id = sp.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION denormalize_card IS 'Update denormalized columns for a single card';

-- ============================================================================
-- Function to denormalize all cards (batch)
-- ============================================================================

CREATE OR REPLACE FUNCTION denormalize_all_cards()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE cards c
    SET 
        player_name = p.full_name,
        player_first_name = p.first_name,
        player_last_name = p.last_name,
        player_position = p.position,
        team_name = t.name,
        team_city = t.city,
        team_abbr = t.abbreviation,
        set_name = s.name,
        set_year = s.year,
        set_console_uid = s.console_uid,
        manufacturer_name = m.name,
        league_name = l.name,
        league_abbr = l.abbreviation,
        sport_name = sp.name,
        last_denormalized_at = NOW()
    FROM players p, teams t, sets s, manufacturers m, leagues l, sports sp
    WHERE c.player_id = p.id
      AND c.team_id = t.id
      AND c.set_id = s.id
      AND c.manufacturer_id = m.id
      AND c.league_id = l.id
      AND c.sport_id = sp.id;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION denormalize_all_cards IS 'Update denormalized columns for all cards. Returns count of updated rows.';

-- ============================================================================
-- Run initial denormalization
-- ============================================================================

SELECT 'Running initial denormalization...' as status;

SELECT denormalize_all_cards() as cards_denormalized;
