-- ============================================================================
-- 01-DIMENSIONS: All dimension/lookup tables
-- ============================================================================
-- Entity: Sports, Leagues, Teams, Players, Manufacturers, Sets
-- ============================================================================

-- ============================================================================
-- SPORTS
-- ============================================================================
DROP TABLE IF EXISTS sports CASCADE;

CREATE TABLE sports (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sports_slug ON sports(slug);
COMMENT ON TABLE sports IS 'Sports categories (Basketball, Baseball, etc.)';

-- Seed sports
INSERT INTO sports (name, slug, display_order) VALUES
    ('Basketball', 'basketball', 1),
    ('Baseball', 'baseball', 2),
    ('Football', 'football', 3),
    ('Hockey', 'hockey', 4),
    ('Soccer', 'soccer', 5),
    ('Other', 'other', 99);

-- ============================================================================
-- LEAGUES
-- ============================================================================
DROP TABLE IF EXISTS leagues CASCADE;

CREATE TABLE leagues (
    id SERIAL PRIMARY KEY,
    sport_id INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    abbreviation TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sport_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_leagues_sport ON leagues(sport_id);
CREATE INDEX IF NOT EXISTS idx_leagues_slug ON leagues(slug);
COMMENT ON TABLE leagues IS 'Professional leagues (NBA, MLB, NFL, etc.)';

-- Seed leagues
INSERT INTO leagues (sport_id, name, slug, abbreviation, display_order) VALUES
    ((SELECT id FROM sports WHERE slug = 'basketball'), 'National Basketball Association', 'nba', 'NBA', 1),
    ((SELECT id FROM sports WHERE slug = 'baseball'), 'Major League Baseball', 'mlb', 'MLB', 1),
    ((SELECT id FROM sports WHERE slug = 'football'), 'National Football League', 'nfl', 'NFL', 1),
    ((SELECT id FROM sports WHERE slug = 'hockey'), 'National Hockey League', 'nhl', 'NHL', 1),
    ((SELECT id FROM sports WHERE slug = 'soccer'), 'Major League Soccer', 'mls', 'MLS', 1);

-- ============================================================================
-- MANUFACTURERS
-- ============================================================================
DROP TABLE IF EXISTS manufacturers CASCADE;

CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    country TEXT,
    website_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manufacturers_slug ON manufacturers(slug);
COMMENT ON TABLE manufacturers IS 'Card manufacturers (Panini, Topps, etc.)';

-- Seed manufacturers
INSERT INTO manufacturers (name, slug, country) VALUES
    ('Panini', 'panini', 'Italy'),
    ('Topps', 'topps', 'USA'),
    ('Upper Deck', 'upper-deck', 'USA'),
    ('Leaf', 'leaf', 'USA'),
    ('Donruss', 'donruss', 'USA'),
    ('Bowman', 'bowman', 'USA'),
    ('Fleer', 'fleer', 'USA'),
    ('Score', 'score', 'USA'),
    ('Stadium Club', 'stadium-club', 'USA'),
    ('Chrome', 'chrome', 'USA'),
    ('Prizm', 'prizm', 'USA');

-- ============================================================================
-- TEAMS
-- ============================================================================
DROP TABLE IF EXISTS teams CASCADE;

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    city TEXT,
    abbreviation TEXT,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_teams_league ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
COMMENT ON TABLE teams IS 'Sports teams (Lakers, Yankees, etc.)';

-- ============================================================================
-- PLAYERS
-- ============================================================================
DROP TABLE IF EXISTS players CASCADE;

CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    birth_date DATE,
    position TEXT,
    hall_of_fame BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_players_slug ON players(slug);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(full_name);
CREATE INDEX IF NOT EXISTS idx_players_last_name ON players(last_name);
COMMENT ON TABLE players IS 'Athletes and players across all sports';

-- ============================================================================
-- SETS
-- ============================================================================
DROP TABLE IF EXISTS sets CASCADE;
DROP TABLE IF EXISTS sets_master CASCADE;

CREATE TABLE sets (
    id SERIAL PRIMARY KEY,
    console_uid TEXT UNIQUE NOT NULL,
    slug TEXT NOT NULL,
    sport_id INTEGER REFERENCES sports(id),
    league_id INTEGER REFERENCES leagues(id),
    manufacturer_id INTEGER REFERENCES manufacturers(id),
    name TEXT NOT NULL,
    console_name TEXT,              -- Full set name from CSV (e.g., "Basketball Cards 2024 Panini Prizm")
    year INTEGER,
    release_date DATE,
    total_cards INTEGER,
    page_name TEXT,
    url TEXT,
    csv_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sets_sport ON sets(sport_id);
CREATE INDEX IF NOT EXISTS idx_sets_league ON sets(league_id);
CREATE INDEX IF NOT EXISTS idx_sets_manufacturer ON sets(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_sets_year ON sets(year);
CREATE INDEX IF NOT EXISTS idx_sets_slug ON sets(slug);
COMMENT ON TABLE sets IS 'Card sets with normalized foreign keys';
