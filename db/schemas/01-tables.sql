-- ============================================================================
-- 01-TABLES: All base tables (dimensions, cards, daily data, staging)
-- ============================================================================

-- ============================================================================
-- DIMENSION TABLES
-- ============================================================================

-- Sports
DROP TABLE IF EXISTS sports CASCADE;
CREATE TABLE sports (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO sports (name, slug, display_order) VALUES
    ('Basketball', 'basketball', 1), ('Baseball', 'baseball', 2),
    ('Football', 'football', 3), ('Hockey', 'hockey', 4),
    ('Soccer', 'soccer', 5), ('Other', 'other', 99);

-- Leagues
DROP TABLE IF EXISTS leagues CASCADE;
CREATE TABLE leagues (
    id SERIAL PRIMARY KEY,
    sport_id INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    name TEXT NOT NULL, slug TEXT NOT NULL, abbreviation TEXT,
    display_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport_id, slug)
);
INSERT INTO leagues (sport_id, name, slug, abbreviation, display_order) VALUES
    ((SELECT id FROM sports WHERE slug = 'basketball'), 'National Basketball Association', 'nba', 'NBA', 1),
    ((SELECT id FROM sports WHERE slug = 'baseball'), 'Major League Baseball', 'mlb', 'MLB', 1),
    ((SELECT id FROM sports WHERE slug = 'football'), 'National Football League', 'nfl', 'NFL', 1),
    ((SELECT id FROM sports WHERE slug = 'hockey'), 'National Hockey League', 'nhl', 'NHL', 1),
    ((SELECT id FROM sports WHERE slug = 'soccer'), 'Major League Soccer', 'mls', 'MLS', 1);

-- Manufacturers
DROP TABLE IF EXISTS manufacturers CASCADE;
CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, slug TEXT UNIQUE NOT NULL,
    country TEXT, website_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO manufacturers (name, slug, country) VALUES
    ('Panini', 'panini', 'Italy'), ('Topps', 'topps', 'USA'), ('Upper Deck', 'upper-deck', 'USA'),
    ('Leaf', 'leaf', 'USA'), ('Donruss', 'donruss', 'USA'), ('Bowman', 'bowman', 'USA'),
    ('Fleer', 'fleer', 'USA'), ('Score', 'score', 'USA'), ('Stadium Club', 'stadium-club', 'USA'),
    ('Chrome', 'chrome', 'USA'), ('Prizm', 'prizm', 'USA');

-- Teams
DROP TABLE IF EXISTS teams CASCADE;
CREATE TABLE teams (
    id SERIAL PRIMARY KEY, league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name TEXT NOT NULL, slug TEXT NOT NULL, city TEXT, abbreviation TEXT, logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(league_id, slug)
);

-- Players
DROP TABLE IF EXISTS players CASCADE;
CREATE TABLE players (
    id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    first_name TEXT, last_name TEXT, birth_date DATE, position TEXT,
    hall_of_fame BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sets
DROP TABLE IF EXISTS sets CASCADE;
DROP TABLE IF EXISTS sets_master CASCADE;
CREATE TABLE sets (
    id SERIAL PRIMARY KEY, console_uid TEXT UNIQUE NOT NULL, slug TEXT NOT NULL,
    sport_id INTEGER REFERENCES sports(id), league_id INTEGER REFERENCES leagues(id),
    manufacturer_id INTEGER REFERENCES manufacturers(id), name TEXT NOT NULL,
    year INTEGER, release_date DATE, total_cards INTEGER, page_name TEXT, url TEXT, csv_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CARDS TABLE (with denormalized fields)
-- ============================================================================
DROP TABLE IF EXISTS cards CASCADE;
CREATE TABLE cards (
    id BIGINT PRIMARY KEY, set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id), team_id INTEGER REFERENCES teams(id),
    sport_id INTEGER REFERENCES sports(id), league_id INTEGER REFERENCES leagues(id),
    manufacturer_id INTEGER REFERENCES manufacturers(id),
    card_number TEXT, variation TEXT, rookie_card BOOLEAN DEFAULT FALSE,
    psa_pop_report INTEGER, bgs_pop_report INTEGER,
    raw_product_name TEXT, raw_console_name TEXT, first_seen_date DATE,
    -- Denormalized fields
    player_name TEXT, player_first_name TEXT, player_last_name TEXT, player_position TEXT,
    team_name TEXT, team_city TEXT, team_abbr TEXT, set_name TEXT, set_year INTEGER, set_console_uid TEXT,
    manufacturer_name TEXT, league_name TEXT, league_abbr TEXT, sport_name TEXT,
    last_denormalized_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STAGING TABLE
-- ============================================================================
DROP TABLE IF EXISTS cards_raw_ingests CASCADE;
CREATE UNLOGGED TABLE cards_raw_ingests (
    id BIGSERIAL PRIMARY KEY, ingest_date DATE NOT NULL, console_uid TEXT NOT NULL,
    card_id BIGINT NOT NULL, payload JSONB NOT NULL, filename TEXT, processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP, error_message TEXT, snapshot_date DATE
);

-- ============================================================================
-- DAILY SNAPSHOTS (raw data from CSV)
-- ============================================================================
DROP TABLE IF EXISTS card_daily_snapshots CASCADE;
DROP TABLE IF EXISTS card_market_daily CASCADE;
CREATE TABLE card_daily_snapshots (
    card_id BIGINT NOT NULL, console_uid TEXT NOT NULL, date DATE NOT NULL,
    console_name TEXT, product_name TEXT,
    loose_price NUMERIC(12,2), graded_price NUMERIC(12,2), psa10_price NUMERIC(12,2), bgs10_price NUMERIC(12,2),
    cib_price NUMERIC(12,2), new_price NUMERIC(12,2), box_only_price NUMERIC(12,2), manual_only_price NUMERIC(12,2),
    condition_17_price NUMERIC(12,2), condition_18_price NUMERIC(12,2),
    gamestop_price NUMERIC(12,2), gamestop_trade_price NUMERIC(12,2),
    retail_loose_buy NUMERIC(12,2), retail_loose_sell NUMERIC(12,2),
    retail_cib_buy NUMERIC(12,2), retail_cib_sell NUMERIC(12,2),
    retail_new_buy NUMERIC(12,2), retail_new_sell NUMERIC(12,2),
    sales_volume NUMERIC, upc TEXT, tcg_id TEXT, asin TEXT, epid TEXT, genre TEXT, release_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, source_file TEXT,
    PRIMARY KEY (card_id, date)
);

-- ============================================================================
-- DAILY DELTAS (yesterday/today/diff for all price fields)
-- ============================================================================
DROP TABLE IF EXISTS card_daily_deltas CASCADE;
CREATE TABLE card_daily_deltas (
    id SERIAL PRIMARY KEY, card_id BIGINT NOT NULL REFERENCES cards(id), console_uid TEXT NOT NULL, date DATE NOT NULL,
    console_name TEXT, product_name TEXT,
    loose_price_yesterday NUMERIC(12,2), loose_price_today NUMERIC(12,2), loose_price_diff NUMERIC(12,2), loose_price_diff_pct NUMERIC(6,2),
    graded_price_yesterday NUMERIC(12,2), graded_price_today NUMERIC(12,2), graded_price_diff NUMERIC(12,2), graded_price_diff_pct NUMERIC(6,2),
    psa10_price_yesterday NUMERIC(12,2), psa10_price_today NUMERIC(12,2), psa10_price_diff NUMERIC(12,2), psa10_price_diff_pct NUMERIC(6,2),
    bgs10_price_yesterday NUMERIC(12,2), bgs10_price_today NUMERIC(12,2), bgs10_price_diff NUMERIC(12,2), bgs10_price_diff_pct NUMERIC(6,2),
    cib_price_yesterday NUMERIC(12,2), cib_price_today NUMERIC(12,2), cib_price_diff NUMERIC(12,2), cib_price_diff_pct NUMERIC(6,2),
    new_price_yesterday NUMERIC(12,2), new_price_today NUMERIC(12,2), new_price_diff NUMERIC(12,2), new_price_diff_pct NUMERIC(6,2),
    box_only_price_yesterday NUMERIC(12,2), box_only_price_today NUMERIC(12,2), box_only_price_diff NUMERIC(12,2), box_only_price_diff_pct NUMERIC(6,2),
    manual_only_price_yesterday NUMERIC(12,2), manual_only_price_today NUMERIC(12,2), manual_only_price_diff NUMERIC(12,2), manual_only_price_diff_pct NUMERIC(6,2),
    condition_17_price_yesterday NUMERIC(12,2), condition_17_price_today NUMERIC(12,2), condition_17_price_diff NUMERIC(12,2), condition_17_price_diff_pct NUMERIC(6,2),
    condition_18_price_yesterday NUMERIC(12,2), condition_18_price_today NUMERIC(12,2), condition_18_price_diff NUMERIC(12,2), condition_18_price_diff_pct NUMERIC(6,2),
    gamestop_price_yesterday NUMERIC(12,2), gamestop_price_today NUMERIC(12,2), gamestop_price_diff NUMERIC(12,2), gamestop_price_diff_pct NUMERIC(6,2),
    gamestop_trade_price_yesterday NUMERIC(12,2), gamestop_trade_price_today NUMERIC(12,2), gamestop_trade_price_diff NUMERIC(12,2), gamestop_trade_price_diff_pct NUMERIC(6,2),
    retail_loose_buy_yesterday NUMERIC(12,2), retail_loose_buy_today NUMERIC(12,2), retail_loose_buy_diff NUMERIC(12,2), retail_loose_buy_diff_pct NUMERIC(6,2),
    retail_loose_sell_yesterday NUMERIC(12,2), retail_loose_sell_today NUMERIC(12,2), retail_loose_sell_diff NUMERIC(12,2), retail_loose_sell_diff_pct NUMERIC(6,2),
    retail_cib_buy_yesterday NUMERIC(12,2), retail_cib_buy_today NUMERIC(12,2), retail_cib_buy_diff NUMERIC(12,2), retail_cib_buy_diff_pct NUMERIC(6,2),
    retail_cib_sell_yesterday NUMERIC(12,2), retail_cib_sell_today NUMERIC(12,2), retail_cib_sell_diff NUMERIC(12,2), retail_cib_sell_diff_pct NUMERIC(6,2),
    retail_new_buy_yesterday NUMERIC(12,2), retail_new_buy_today NUMERIC(12,2), retail_new_buy_diff NUMERIC(12,2), retail_new_buy_diff_pct NUMERIC(6,2),
    retail_new_sell_yesterday NUMERIC(12,2), retail_new_sell_today NUMERIC(12,2), retail_new_sell_diff NUMERIC(12,2), retail_new_sell_diff_pct NUMERIC(6,2),
    sales_volume_yesterday NUMERIC, sales_volume_today NUMERIC, sales_volume_diff NUMERIC, sales_volume_diff_pct NUMERIC(6,2),
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, has_prior_day_data BOOLEAN DEFAULT FALSE,
    UNIQUE(card_id, date)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION denormalize_card(p_card_id BIGINT) RETURNS VOID AS $$
BEGIN
    UPDATE cards c SET 
        player_name = p.full_name, player_first_name = p.first_name, player_last_name = p.last_name, player_position = p.position,
        team_name = t.name, team_city = t.city, team_abbr = t.abbreviation,
        set_name = s.name, set_year = s.year, set_console_uid = s.console_uid,
        manufacturer_name = m.name, league_name = l.name, league_abbr = l.abbreviation, sport_name = sp.name,
        last_denormalized_at = NOW()
    FROM players p, teams t, sets s, manufacturers m, leagues l, sports sp
    WHERE c.id = p_card_id AND c.player_id = p.id AND c.team_id = t.id AND c.set_id = s.id
      AND c.manufacturer_id = m.id AND c.league_id = l.id AND c.sport_id = sp.id;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION denormalize_all_cards() RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE cards c SET 
        player_name = p.full_name, player_first_name = p.first_name, player_last_name = p.last_name, player_position = p.position,
        team_name = t.name, team_city = t.city, team_abbr = t.abbreviation,
        set_name = s.name, set_year = s.year, set_console_uid = s.console_uid,
        manufacturer_name = m.name, league_name = l.name, league_abbr = l.abbreviation, sport_name = sp.name,
        last_denormalized_at = NOW()
    FROM players p, teams t, sets s, manufacturers m, leagues l, sports sp
    WHERE c.player_id = p.id AND c.team_id = t.id AND c.set_id = s.id
      AND c.manufacturer_id = m.id AND c.league_id = l.id AND c.sport_id = sp.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END; $$ LANGUAGE plpgsql;
