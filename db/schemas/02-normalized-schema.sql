-- ============================================================================
-- NORMALIZED DIMENSION TABLES FOR CARDS ANALYTICS PLATFORM
-- Proper relational structure with foreign keys
-- ============================================================================

-- ============================================================================
-- 1. SPORTS (Top-level category)
-- ============================================================================
DROP TABLE IF EXISTS sports CASCADE;

CREATE TABLE sports (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,      -- Basketball, Baseball, Football
    slug TEXT UNIQUE NOT NULL,      -- basketball, baseball, football
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sports_slug ON sports(slug);

COMMENT ON TABLE sports IS 'Sports categories (Basketball, Baseball, etc.)';

-- ============================================================================
-- 2. LEAGUES (Sport-specific leagues)
-- ============================================================================
DROP TABLE IF EXISTS leagues CASCADE;

CREATE TABLE leagues (
    id SERIAL PRIMARY KEY,
    sport_id INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    name TEXT NOT NULL,             -- NBA, MLB, NFL, NHL
    slug TEXT NOT NULL,             -- nba, mlb, nfl
    abbreviation TEXT,              -- NBA, MLB
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(sport_id, slug)
);

CREATE INDEX idx_leagues_sport ON leagues(sport_id);
CREATE INDEX idx_leagues_slug ON leagues(slug);

COMMENT ON TABLE leagues IS 'Professional leagues (NBA, MLB, NFL, etc.)';

-- ============================================================================
-- 3. MANUFACTURERS (Card manufacturers)
-- ============================================================================
DROP TABLE IF EXISTS manufacturers CASCADE;

CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,      -- Panini, Topps, Upper Deck
    slug TEXT UNIQUE NOT NULL,      -- panini, topps, upper-deck
    country TEXT,                   -- USA, etc.
    website_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_manufacturers_slug ON manufacturers(slug);

COMMENT ON TABLE manufacturers IS 'Card manufacturers (Panini, Topps, etc.)';

-- ============================================================================
-- 4. TEAMS (League-specific teams)
-- ============================================================================
DROP TABLE IF EXISTS teams CASCADE;

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,             -- Los Angeles Lakers
    slug TEXT NOT NULL,             -- los-angeles-lakers
    city TEXT,                      -- Los Angeles
    abbreviation TEXT,              -- LAL
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(league_id, slug)
);

CREATE INDEX idx_teams_league ON teams(league_id);
CREATE INDEX idx_teams_slug ON teams(slug);

COMMENT ON TABLE teams IS 'Sports teams (Lakers, Yankees, etc.)';

-- ============================================================================
-- 5. PLAYERS (Athletes across all sports)
-- ============================================================================
DROP TABLE IF EXISTS players CASCADE;

CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,        -- LeBron James
    slug TEXT UNIQUE NOT NULL,      -- lebron-james
    first_name TEXT,
    last_name TEXT,
    birth_date DATE,
    position TEXT,                  -- Guard, Forward, etc.
    hall_of_fame BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_slug ON players(slug);
CREATE INDEX idx_players_name ON players(full_name);
CREATE INDEX idx_players_last_name ON players(last_name);

COMMENT ON TABLE players IS 'Athletes and players across all sports';

-- ============================================================================
-- 6. SETS (Card sets - renamed from sets_master with proper FKs)
-- ============================================================================
DROP TABLE IF EXISTS sets CASCADE;
DROP TABLE IF EXISTS sets_master CASCADE;  -- Clean up old table

CREATE TABLE sets (
    id SERIAL PRIMARY KEY,
    console_uid TEXT UNIQUE NOT NULL,   -- G78842, G1096
    slug TEXT NOT NULL,                 -- basketball-cards-2024-panini-prizm
    
    -- Foreign keys
    sport_id INTEGER REFERENCES sports(id),
    league_id INTEGER REFERENCES leagues(id),
    manufacturer_id INTEGER REFERENCES manufacturers(id),
    
    -- Set attributes
    name TEXT NOT NULL,                 -- 2024 Panini Prizm Basketball
    year INTEGER,                       -- 2024
    release_date DATE,
    total_cards INTEGER,                -- Known set size
    
    -- Source tracking
    page_name TEXT,
    url TEXT,
    csv_path TEXT,                      -- Pattern: {slug}_{console_uid}.csv
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sets_sport ON sets(sport_id);
CREATE INDEX idx_sets_league ON sets(league_id);
CREATE INDEX idx_sets_manufacturer ON sets(manufacturer_id);
CREATE INDEX idx_sets_year ON sets(year);
CREATE INDEX idx_sets_slug ON sets(slug);

COMMENT ON TABLE sets IS 'Card sets with normalized foreign keys (replaces sets_master)';

-- ============================================================================
-- 7. CARDS (Individual cards with full dimension FKs)
-- ============================================================================
DROP TABLE IF EXISTS cards CASCADE;

CREATE TABLE cards (
    id BIGINT PRIMARY KEY,              -- Same as card_id from source data
    
    -- Core relationships
    set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id),
    team_id INTEGER REFERENCES teams(id),
    
    -- Denormalized for convenience (can also be derived from relationships)
    sport_id INTEGER REFERENCES sports(id),
    league_id INTEGER REFERENCES leagues(id),
    manufacturer_id INTEGER REFERENCES manufacturers(id),
    
    -- Card attributes
    card_number TEXT,                   -- 1, 251, RC1
    variation TEXT,                     -- Silver Prizm, Base, Refractor
    rookie_card BOOLEAN DEFAULT FALSE,
    
    -- Grading info (optional)
    psa_pop_report INTEGER,             -- PSA population
    bgs_pop_report INTEGER,             -- BGS population
    
    -- Source tracking
    raw_product_name TEXT,              -- Original CSV product-name
    raw_console_name TEXT,              -- Original CSV console-name
    
    -- Metadata
    first_seen_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cards_set ON cards(set_id);
CREATE INDEX idx_cards_player ON cards(player_id);
CREATE INDEX idx_cards_team ON cards(team_id);
CREATE INDEX idx_cards_sport ON cards(sport_id);
CREATE INDEX idx_cards_league ON cards(league_id);
CREATE INDEX idx_cards_rookie ON cards(rookie_card) WHERE rookie_card = true;
CREATE INDEX idx_cards_variation ON cards(variation);
CREATE INDEX idx_cards_number ON cards(card_number);

COMMENT ON TABLE cards IS 'Individual trading cards with normalized dimension keys';

-- ============================================================================
-- SEED DATA: Common lookup values
-- ============================================================================

-- Sports
INSERT INTO sports (name, slug, display_order) VALUES
    ('Basketball', 'basketball', 1),
    ('Baseball', 'baseball', 2),
    ('Football', 'football', 3),
    ('Hockey', 'hockey', 4),
    ('Soccer', 'soccer', 5),
    ('Racing', 'racing', 6),
    ('Golf', 'golf', 7),
    ('Wrestling', 'wrestling', 8),
    ('Other', 'other', 99);

-- Leagues (with sport_id references)
INSERT INTO leagues (sport_id, name, slug, abbreviation, display_order) VALUES
    ((SELECT id FROM sports WHERE slug = 'basketball'), 'National Basketball Association', 'nba', 'NBA', 1),
    ((SELECT id FROM sports WHERE slug = 'baseball'), 'Major League Baseball', 'mlb', 'MLB', 1),
    ((SELECT id FROM sports WHERE slug = 'football'), 'National Football League', 'nfl', 'NFL', 1),
    ((SELECT id FROM sports WHERE slug = 'hockey'), 'National Hockey League', 'nhl', 'NHL', 1),
    ((SELECT id FROM sports WHERE slug = 'soccer'), 'Major League Soccer', 'mls', 'MLS', 1);

-- Manufacturers
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
-- VIEWS: Enriched data for analytics
-- ============================================================================

-- Full card details with all dimension names
DROP VIEW IF EXISTS vw_cards_enriched;

CREATE VIEW vw_cards_enriched AS
SELECT 
    c.id as card_id,
    c.card_number,
    c.variation,
    c.rookie_card,
    
    -- Player
    p.id as player_id,
    p.full_name as player_name,
    p.first_name,
    p.last_name,
    p.position,
    
    -- Team
    t.id as team_id,
    t.name as team_name,
    t.city as team_city,
    t.abbreviation as team_abbr,
    
    -- Set
    s.id as set_id,
    s.name as set_name,
    s.year,
    s.console_uid,
    
    -- Manufacturer
    m.id as manufacturer_id,
    m.name as manufacturer,
    
    -- League
    l.id as league_id,
    l.name as league_name,
    l.abbreviation as league_abbr,
    
    -- Sport
    sp.id as sport_id,
    sp.name as sport
    
FROM cards c
LEFT JOIN players p ON c.player_id = p.id
LEFT JOIN teams t ON c.team_id = t.id
LEFT JOIN sets s ON c.set_id = s.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN leagues l ON c.league_id = l.id
LEFT JOIN sports sp ON c.sport_id = sp.id;

COMMENT ON VIEW vw_cards_enriched IS 'Cards with all dimension names resolved for analytics';

-- ============================================================================
-- 8. GRADING COMPANIES (PSA, BGS, SGC, etc.)
-- ============================================================================

DROP TABLE IF EXISTS grading_companies CASCADE;

CREATE TABLE grading_companies (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,          -- Professional Sports Authenticator
    slug TEXT UNIQUE NOT NULL,            -- psa, bgs, sgc
    abbreviation TEXT UNIQUE NOT NULL,    -- PSA, BGS, SGC
    website_url TEXT,
    grading_scale TEXT,                 -- 1-10, 1-100, etc.
    premium_service BOOLEAN DEFAULT FALSE, -- Express, walk-through options
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_grading_companies_slug ON grading_companies(slug);
CREATE INDEX idx_grading_companies_abbr ON grading_companies(abbreviation);

COMMENT ON TABLE grading_companies IS 'Third-party grading companies (PSA, BGS, SGC, HGA, CSG)';

-- Seed grading companies
INSERT INTO grading_companies (name, slug, abbreviation, grading_scale, premium_service) VALUES
    ('Professional Sports Authenticator', 'psa', 'PSA', '1-10', true),
    ('Beckett Grading Services', 'bgs', 'BGS', '1-10', true),
    ('Sportscard Guaranty Corporation', 'sgc', 'SGC', '1-10', false),
    ('Hybrid Grading Approach', 'hga', 'HGA', '1-10', false),
    ('Certified Sports Guaranty', 'csg', 'CSG', '1-10', false),
    ('GMA Grading', 'gma', 'GMA', '1-10', false);

-- ============================================================================
-- 9. CARD GRADES (Specific grades assigned to cards)
-- ============================================================================

DROP TABLE IF EXISTS card_grades CASCADE;

CREATE TABLE card_grades (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    grading_company_id INTEGER NOT NULL REFERENCES grading_companies(id),
    
    -- Grade details
    grade NUMERIC(3,1) NOT NULL,          -- 10, 9.5, 9, 8.5, 8, etc.
    grade_label TEXT,                   -- Gem Mint, Mint, NM-MT, etc.
    subgrades JSONB,                    -- Centering, Corners, Edges, Surface for BGS
    
    -- Grading details
    cert_number TEXT,                   -- Certification number
    graded_date DATE,
    population INTEGER,                 -- How many exist at this grade
    population_higher INTEGER,          -- How many exist at higher grades
    
    -- Pop report reference
    pop_report_url TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(card_id, grading_company_id, grade, cert_number)
);

CREATE INDEX idx_card_grades_card ON card_grades(card_id);
CREATE INDEX idx_card_grades_company ON card_grades(grading_company_id);
CREATE INDEX idx_card_grades_grade ON card_grades(grade);
CREATE INDEX idx_card_grades_cert ON card_grades(cert_number);

COMMENT ON TABLE card_grades IS 'Individual card grades from third-party grading companies';

-- ============================================================================
-- 10. CARD TYPES (Base, Parallel, Insert, Auto, Relic, etc.)
-- ============================================================================

DROP TABLE IF EXISTS card_types CASCADE;

CREATE TABLE card_types (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,          -- Base, Parallel, Insert, Autograph
    slug TEXT UNIQUE NOT NULL,          -- base, parallel, insert, auto
    category TEXT NOT NULL,             -- standard, premium, hit, short_print
    description TEXT,
    
    -- Scarcity indicators
    is_serial_numbered BOOLEAN DEFAULT FALSE,
    is_limited BOOLEAN DEFAULT FALSE,
    typical_print_run INTEGER,          -- /25, /99, /999, etc.
    
    -- Rarity multiplier (for pricing models)
    rarity_multiplier NUMERIC(4,2) DEFAULT 1.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_card_types_slug ON card_types(slug);
CREATE INDEX idx_card_types_category ON card_types(category);

COMMENT ON TABLE card_types IS 'Card classification types (Base, Parallel, Insert, Auto, Relic, etc.)';

-- Seed card types
INSERT INTO card_types (name, slug, category, description, is_serial_numbered, is_limited, typical_print_run, rarity_multiplier) VALUES
    ('Base', 'base', 'standard', 'Standard base card', false, false, NULL, 1.00),
    ('Parallel', 'parallel', 'standard', 'Alternate version of base (colored refractor)', false, false, NULL, 1.50),
    ('Insert', 'insert', 'premium', 'Themed subset card', false, false, NULL, 2.00),
    ('Autograph', 'auto', 'hit', 'Signed card', true, true, NULL, 10.00),
    ('Relic', 'relic', 'hit', 'Contains game-worn material', true, true, NULL, 8.00),
    ('Autograph Relic', 'auto-relic', 'hit', 'Signed + game-worn material', true, true, NULL, 15.00),
    ('Short Print', 'sp', 'short_print', 'Limited print run', true, true, NULL, 3.00),
    ('Super Short Print', 'ssp', 'short_print', 'Very limited print run', true, true, NULL, 5.00),
    ('Patch', 'patch', 'hit', 'Game-worn patch (larger than jersey)', true, true, NULL, 12.00),
    ('Printing Plate', 'plate', 'short_print', '1/1 printing plate', true, true, 1, 50.00),
    ('Rookie Card', 'rookie', 'standard', 'First year card designation', false, false, NULL, 2.00),
    ('Numbered', 'numbered', 'standard', 'Serial numbered card', true, true, NULL, 2.50);

-- ============================================================================
-- 11. VARIATIONS (Specific parallels: Silver Prizm, Gold Refractor, etc.)
-- ============================================================================

DROP TABLE IF EXISTS variations CASCADE;

CREATE TABLE variations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,          -- Silver Prizm
    slug TEXT UNIQUE NOT NULL,            -- silver-prizm
    description TEXT,                   -- Silver holographic finish
    
    -- Visual characteristics
    color TEXT,                         -- Silver, Gold, Blue, Red, etc.
    finish TEXT,                        -- Refractor, Prizm, Chrome, Holo
    
    -- Scarcity
    is_serial_numbered BOOLEAN DEFAULT FALSE,
    serial_number INTEGER,              -- If numbered (e.g., /25 = 25)
    
    -- Value multiplier
    value_multiplier NUMERIC(4,2) DEFAULT 1.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_variations_slug ON variations(slug);
CREATE INDEX idx_variations_color ON variations(color);
CREATE INDEX idx_variations_finish ON variations(finish);

COMMENT ON TABLE variations IS 'Specific card variations and parallels (Silver Prizm, Gold Refractor, etc.)';

-- Seed common variations
INSERT INTO variations (name, slug, description, color, finish, is_serial_numbered, serial_number, value_multiplier) VALUES
    ('Base', 'base', 'Standard base card', NULL, 'Standard', false, NULL, 1.00),
    ('Silver Prizm', 'silver-prizm', 'Silver holographic prismatic finish', 'Silver', 'Prizm', false, NULL, 1.50),
    ('Gold Prizm', 'gold-prizm', 'Gold holographic prismatic finish', 'Gold', 'Prizm', true, 10, 5.00),
    ('Blue Prizm', 'blue-prizm', 'Blue holographic prismatic finish', 'Blue', 'Prizm', true, 199, 2.00),
    ('Red Prizm', 'red-prizm', 'Red holographic prismatic finish', 'Red', 'Prizm', true, 299, 1.80),
    ('Black Gold', 'black-gold', 'Black and gold premium finish', 'Black', 'Prizm', true, 5, 8.00),
    ('Refractor', 'refractor', 'Chrome refractor finish', 'Silver', 'Refractor', false, NULL, 1.75),
    ('X-Fractor', 'x-fractor', 'Grid-pattern refractor', 'Silver', 'Refractor', true, 99, 3.00),
    ('Gold Refractor', 'gold-refractor', 'Gold chrome refractor', 'Gold', 'Refractor', true, 50, 4.00),
    ('SuperFractor', 'superfractor', '1/1 gold etched refractor', 'Gold', 'Refractor', true, 1, 50.00),
    ('Black Refractor', 'black-refractor', 'Black border refractor', 'Black', 'Refractor', true, 10, 6.00),
    ('Blue Wave', 'blue-wave', 'Blue wave pattern refractor', 'Blue', 'Refractor', true, 50, 4.00),
    ('Green Cracked Ice', 'green-cracked-ice', 'Green cracked ice pattern', 'Green', 'Cracked Ice', true, 99, 2.50),
    ('Mojo', 'mojo', 'Multi-color sparkle finish', 'Multi', 'Prizm', true, 25, 6.00),
    ('Snakeskin', 'snakeskin', 'Snakeskin pattern prizm', 'Gold', 'Prizm', true, 10, 5.00);

-- ============================================================================
-- 12. CARD ATTRIBUTES JUNCTION (Cards can have multiple attributes)
-- ============================================================================

DROP TABLE IF EXISTS card_attributes CASCADE;

CREATE TABLE card_attributes (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    card_type_id INTEGER NOT NULL REFERENCES card_types(id),
    variation_id INTEGER REFERENCES variations(id),
    
    -- Additional metadata
    serial_number TEXT,                 -- If stamped (e.g., "12/25")
    is_rookie_card BOOLEAN DEFAULT FALSE,
    is_autographed BOOLEAN DEFAULT FALSE,
    has_relic BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(card_id, card_type_id, variation_id)
);

CREATE INDEX idx_card_attributes_card ON card_attributes(card_id);
CREATE INDEX idx_card_attributes_type ON card_attributes(card_type_id);
CREATE INDEX idx_card_attributes_variation ON card_attributes(variation_id);
CREATE INDEX idx_card_attributes_rookie ON card_attributes(is_rookie_card) WHERE is_rookie_card = true;
CREATE INDEX idx_card_attributes_auto ON card_attributes(is_autographed) WHERE is_autographed = true;

COMMENT ON TABLE card_attributes IS 'Junction table linking cards to their types and variations';

-- ============================================================================
-- UPDATED ENRICHED VIEW with Grades
-- ============================================================================

DROP VIEW IF EXISTS vw_cards_full CASCADE;

CREATE VIEW vw_cards_full AS
SELECT 
    c.id as card_id,
    c.card_number,
    
    -- Player
    p.full_name as player_name,
    p.first_name,
    p.last_name,
    
    -- Team
    t.name as team_name,
    t.city as team_city,
    
    -- Set
    s.name as set_name,
    s.year,
    s.console_uid,
    
    -- Manufacturer & Sport
    m.name as manufacturer,
    sp.name as sport,
    l.abbreviation as league,
    
    -- Card attributes (aggregated)
    (SELECT STRING_AGG(DISTINCT ct.name, ', ') 
     FROM card_attributes ca 
     JOIN card_types ct ON ca.card_type_id = ct.id 
     WHERE ca.card_id = c.id) as card_types,
    
    -- Variations
    (SELECT STRING_AGG(DISTINCT v.name, ', ') 
     FROM card_attributes ca 
     JOIN variations v ON ca.variation_id = v.id 
     WHERE ca.card_id = c.id) as variations,
    
    -- Best grade
    (SELECT MAX(cg.grade) 
     FROM card_grades cg 
     WHERE cg.card_id = c.id) as best_grade,
    
    -- Is rookie
    c.rookie_card
    
FROM cards c
LEFT JOIN players p ON c.player_id = p.id
LEFT JOIN teams t ON c.team_id = t.id
LEFT JOIN sets s ON c.set_id = s.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN sports sp ON c.sport_id = sp.id
LEFT JOIN leagues l ON c.league_id = l.id;

COMMENT ON VIEW vw_cards_full IS 'Complete card view with attributes, grades, and dimensions';
