-- ============================================================================
-- CARDS MASTER: Card-Level Dimension Table for Price Discovery Analytics
-- ============================================================================

DROP TABLE IF EXISTS cards_master CASCADE;

CREATE TABLE cards_master (
    card_id BIGINT PRIMARY KEY,
    console_uid TEXT NOT NULL,
    
    -- Structured card metadata (parsed from product_name/console_name)
    sport TEXT,                    -- basketball, baseball, football
    league TEXT,                   -- NBA, MLB, NFL, NHL
    player_name TEXT,              -- LeBron James
    player_id TEXT,                -- External player identifier
    team TEXT,                     -- Lakers, Yankees, etc.
    
    -- Card attributes
    year INTEGER,                  -- 2019
    set_name TEXT,                 -- Prizm, Bowman, Topps Chrome
    manufacturer TEXT,             -- Panini, Topps, Upper Deck
    card_number TEXT,              -- 1, 251, RC1
    variation TEXT,                -- Silver Prizm, Base, Refractor
    rookie_card BOOLEAN DEFAULT FALSE,
    
    -- Raw source data (for reference/debugging)
    raw_product_name TEXT,         -- Original CSV product-name
    raw_console_name TEXT,         -- Original CSV console-name
    
    -- Metadata
    first_seen_date DATE,          -- First date this card appeared
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_cards_master_console 
        FOREIGN KEY (console_uid) 
        REFERENCES sets_master(console_uid)
);

-- Indexes for analytics queries
CREATE INDEX idx_cards_sport ON cards_master(sport);
CREATE INDEX idx_cards_league ON cards_master(league);
CREATE INDEX idx_cards_player ON cards_master(player_name);
CREATE INDEX idx_cards_team ON cards_master(team);
CREATE INDEX idx_cards_year ON cards_master(year);
CREATE INDEX idx_cards_set ON cards_master(set_name);
CREATE INDEX idx_cards_manufacturer ON cards_master(manufacturer);
CREATE INDEX idx_cards_rookie ON cards_master(rookie_card) WHERE rookie_card = true;
CREATE INDEX idx_cards_console ON cards_master(console_uid);
CREATE INDEX idx_cards_variation ON cards_master(variation);

COMMENT ON TABLE cards_master IS 'Card dimension table for price discovery analytics platform';

-- ============================================================================
-- View: Card Market + Master Data Joined (for Metabase queries)
-- ============================================================================

DROP VIEW IF EXISTS vw_card_market_enriched;

CREATE VIEW vw_card_market_enriched AS
SELECT 
    -- Market data
    m.date,
    m.card_id,
    m.loose_price,
    m.graded_price,
    m.psa10_price,
    m.bgs10_price,
    m.sales_volume,
    
    -- Card dimension
    c.sport,
    c.league,
    c.player_name,
    c.team,
    c.year,
    c.set_name,
    c.manufacturer,
    c.card_number,
    c.variation,
    c.rookie_card,
    
    -- Set dimension
    s.category,
    s.slug,
    s.page_name
FROM card_market_daily m
LEFT JOIN cards_master c ON m.card_id = c.card_id
LEFT JOIN sets_master s ON m.console_uid = s.console_uid;

COMMENT ON VIEW vw_card_market_enriched IS 
'Enriched market data with full card and set dimensions for analytics';
