-- ============================================================================
-- CARD FINGERPRINT & MARKET INDICES SYSTEM
-- Deterministic, backtestable, finance-grade architecture
-- ============================================================================

-- ============================================================================
-- 1. EXTEND CARDS TABLE: Add deterministic fingerprint
-- ============================================================================

-- Add fingerprint columns to cards table
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS card_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS card_fingerprint_hash TEXT,
ADD COLUMN IF NOT EXISTS fingerprint_version INTEGER DEFAULT 1;

-- Index for fast fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_cards_fingerprint ON cards(card_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_cards_fingerprint_lookup ON cards(card_fingerprint);

COMMENT ON COLUMN cards.card_fingerprint IS 'Human-readable canonical identity: sport|year|manufacturer|set|card_number|variation|player_name';
COMMENT ON COLUMN cards.card_fingerprint_hash IS 'SHA256 hash of fingerprint for deterministic joins';

-- ============================================================================
-- 2. FINGERPRINT GENERATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_card_fingerprint(
    p_sport TEXT,
    p_year INTEGER,
    p_manufacturer TEXT,
    p_set_name TEXT,
    p_card_number TEXT,
    p_variation TEXT,
    p_player_name TEXT
) RETURNS TEXT AS $$
DECLARE
    v_fingerprint TEXT;
BEGIN
    -- Normalize and concatenate
    v_fingerprint := LOWER(TRIM(COALESCE(p_sport, ''))) || '|' ||
                     COALESCE(p_year::TEXT, '') || '|' ||
                     LOWER(TRIM(COALESCE(p_manufacturer, ''))) || '|' ||
                     LOWER(TRIM(COALESCE(p_set_name, ''))) || '|' ||
                     LOWER(TRIM(COALESCE(p_card_number, ''))) || '|' ||
                     LOWER(TRIM(COALESCE(p_variation, 'base'))) || '|' ||
                     LOWER(TRIM(COALESCE(p_player_name, '')));
    
    RETURN v_fingerprint;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_card_fingerprint IS 'Creates deterministic canonical identity string from card attributes';

-- ============================================================================
-- 3. HASH GENERATION FUNCTION (for cross-system compatibility)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_fingerprint_hash(p_fingerprint TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Use PostgreSQL's built-in SHA256
    RETURN ENCODE(DIGEST(p_fingerprint, 'sha256'), 'hex');
EXCEPTION
    WHEN undefined_function THEN
        -- Fallback if pgcrypto not available: use MD5
        RETURN MD5(p_fingerprint);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_fingerprint_hash IS 'Generates SHA256 hash of fingerprint for deterministic ID';

-- ============================================================================
-- 4. AUTO-UPDATE TRIGGER: Keep fingerprint in sync
-- ============================================================================

CREATE OR REPLACE FUNCTION update_card_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate fingerprint from parsed data in cards table
    NEW.card_fingerprint := generate_card_fingerprint(
        (SELECT sp.slug FROM sports sp WHERE sp.id = NEW.sport_id),
        (SELECT s.year FROM sets s WHERE s.id = NEW.set_id),
        (SELECT m.slug FROM manufacturers m WHERE m.id = NEW.manufacturer_id),
        NEW.set_name,                    -- Use parsed set_name from card-parser
        NEW.card_number,                 -- Use parsed card_number from card-parser
        COALESCE(NEW.variation, 'base'), -- Use parsed variation from card-parser
        NEW.player_name                  -- Use parsed player_name from card-parser
    );
    
    NEW.card_fingerprint_hash := generate_fingerprint_hash(NEW.card_fingerprint);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_card_fingerprint ON cards;
CREATE TRIGGER trg_card_fingerprint
    BEFORE INSERT OR UPDATE ON cards
    FOR EACH ROW
    EXECUTE FUNCTION update_card_fingerprint();

-- ============================================================================
-- 5. MARKET INDICES: Index Definitions
-- ============================================================================

DROP TABLE IF EXISTS market_indices CASCADE;

CREATE TABLE market_indices (
    index_id SERIAL PRIMARY KEY,
    index_code TEXT UNIQUE NOT NULL,          -- NBA-STARS-001, PSA10-BLUE-CHIP
    index_name TEXT NOT NULL,                 -- "Modern NBA Stars Index"
    index_description TEXT,                   -- Description of what's included
    
    -- Index classification
    index_type TEXT NOT NULL,                 -- thematic, grade_based, era_based, sport_based
    sport_id INTEGER REFERENCES sports(id),   -- Optional: sport-specific index
    
    -- Rebalancing & maintenance
    rebalance_frequency TEXT DEFAULT 'monthly', -- daily, weekly, monthly, quarterly
    last_rebalanced DATE,
    next_rebalance DATE,
    
    -- Methodology
    weighting_method TEXT DEFAULT 'equal',    -- equal, market_cap, liquidity_weighted
    min_liquidity_threshold NUMERIC(4,2),     -- Minimum liquidity_score to qualify
    max_constituents INTEGER DEFAULT 50,      -- Max cards in index
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Version control
    methodology_version INTEGER DEFAULT 1
);

CREATE INDEX idx_market_indices_code ON market_indices(index_code);
CREATE INDEX idx_market_indices_type ON market_indices(index_type);
CREATE INDEX idx_market_indices_active ON market_indices(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE market_indices IS 'Market index definitions (thematic, grade-based, era-based)';

-- ============================================================================
-- 6. MARKET INDEX CONSTITUENTS: Index membership with weights
-- ============================================================================

DROP TABLE IF EXISTS market_index_constituents CASCADE;

CREATE TABLE market_index_constituents (
    id SERIAL PRIMARY KEY,
    index_id INTEGER NOT NULL REFERENCES market_indices(index_id) ON DELETE CASCADE,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    card_fingerprint_hash TEXT NOT NULL,       -- Denormalized for performance
    
    -- Weighting
    weight NUMERIC(6,4) NOT NULL DEFAULT 0.0,  -- 0.02 = 2% of index
    entry_date DATE NOT NULL,                    -- When added to index
    exit_date DATE,                              -- When removed (NULL = active)
    
    -- Entry/exit rationale
    entry_reason TEXT,                           -- "liquidity_threshold_met", "manual_selection"
    exit_reason TEXT,                            -- "liquidity_dropped", "rebalanced_out"
    
    -- Historical tracking
    constituents_version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(index_id, card_id, entry_date)
);

CREATE INDEX idx_constituents_index ON market_index_constituents(index_id);
CREATE INDEX idx_constituents_card ON market_index_constituents(card_fingerprint_hash);
CREATE INDEX idx_constituents_active ON market_index_constituents(index_id, exit_date) WHERE exit_date IS NULL;
CREATE INDEX idx_constituents_entry ON market_index_constituents(entry_date);

COMMENT ON TABLE market_index_constituents IS 'Index membership with weights and historical tracking';

-- ============================================================================
-- 7. INDEX TIME-SERIES: Daily index values (materialized for performance)
-- ============================================================================

DROP TABLE IF EXISTS market_index_values CASCADE;

CREATE TABLE market_index_values (
    id SERIAL PRIMARY KEY,
    index_id INTEGER NOT NULL REFERENCES market_indices(index_id),
    date DATE NOT NULL,
    
    -- Index value components
    index_value NUMERIC(15,4) NOT NULL,          -- Base 1000 at inception
    index_value_change NUMERIC(8,4),             -- Day-over-day change
    index_value_change_pct NUMERIC(6,2),         -- Percentage change
    
    -- Constituent stats
    constituent_count INTEGER,                   -- Number of cards in index that day
    avg_constituent_price NUMERIC(12,2),         -- Average price of constituents
    total_market_cap NUMERIC(18,2),              -- Sum of market caps
    
    -- Volatility & risk
    index_volatility_30d NUMERIC(6,4),           -- 30-day rolling volatility
    max_drawdown_30d NUMERIC(6,4),               -- Max drawdown from peak
    
    -- Metadata
    constituents_version INTEGER,                -- Which version of constituents
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(index_id, date)
);

CREATE INDEX idx_index_values_date ON market_index_values(date);
CREATE INDEX idx_index_values_lookup ON market_index_values(index_id, date);
CREATE INDEX idx_index_values_recent ON market_index_values(date DESC, index_id);

COMMENT ON TABLE market_index_values IS 'Daily computed index values for time-series analysis';

-- ============================================================================
-- 8. INDEX VIEWS: Real-time index analytics
-- ============================================================================

-- View: Current index composition
DROP VIEW IF EXISTS vw_index_composition;

CREATE VIEW vw_index_composition AS
SELECT 
    mi.index_id,
    mi.index_code,
    mi.index_name,
    mic.card_id,
    c.card_fingerprint,
    c.card_fingerprint_hash,
    mic.weight,
    mic.entry_date,
    mic.entry_reason,
    -- Current card details
    p.full_name as player_name,
    s.year,
    s.name as set_name,
    m.name as manufacturer,
    -- Current metrics
    cm.last_sale_price,
    cm.momentum,
    cm.trend_state,
    cm.liquidity_score
FROM market_indices mi
JOIN market_index_constituents mic ON mi.index_id = mic.index_id
LEFT JOIN cards c ON mic.card_id = c.id
LEFT JOIN players p ON c.player_id = p.id
LEFT JOIN sets s ON c.set_id = s.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN reports_latest_card_computed_metrics cm ON c.id = cm.card_id
WHERE mic.exit_date IS NULL  -- Active constituents only
  AND mi.is_active = TRUE;

COMMENT ON VIEW vw_index_composition IS 'Current index composition with live card metrics';

-- View: Index performance summary
DROP VIEW IF EXISTS vw_index_performance;

CREATE VIEW vw_index_performance AS
SELECT 
    mi.index_id,
    mi.index_code,
    mi.index_name,
    mi.index_type,
    
    -- Latest value
    (SELECT miv.index_value 
     FROM market_index_values miv 
     WHERE miv.index_id = mi.index_id 
     ORDER BY miv.date DESC 
     LIMIT 1) as current_value,
    
    -- Performance metrics
    (SELECT miv.index_value_change_pct 
     FROM market_index_values miv 
     WHERE miv.index_id = mi.index_id 
     ORDER BY miv.date DESC 
     LIMIT 1) as daily_change_pct,
    
    -- 30-day performance
    (SELECT (miv_current.index_value - miv_30d.index_value) / miv_30d.index_value * 100
     FROM market_index_values miv_current
     JOIN market_index_values miv_30d 
       ON miv_current.index_id = miv_30d.index_id
     WHERE miv_current.index_id = mi.index_id
       AND miv_30d.date = miv_current.date - INTERVAL '30 days'
     ORDER BY miv_current.date DESC
     LIMIT 1) as change_30d_pct,
    
    -- Current volatility
    (SELECT miv.index_volatility_30d
     FROM market_index_values miv 
     WHERE miv.index_id = mi.index_id 
     ORDER BY miv.date DESC 
     LIMIT 1) as volatility_30d,
    
    -- Constituent count
    (SELECT COUNT(*) 
     FROM market_index_constituents mic 
     WHERE mic.index_id = mi.index_id 
       AND mic.exit_date IS NULL) as constituent_count,
    
    -- Last update
    (SELECT MAX(miv.date)
     FROM market_index_values miv
     WHERE miv.index_id = mi.index_id) as last_updated,
    
    mi.is_active

FROM market_indices mi
WHERE mi.is_active = TRUE;

COMMENT ON VIEW vw_index_performance IS 'Index performance summary with current metrics';

-- View: Index vs Benchmark comparison
DROP VIEW IF EXISTS vw_index_comparison;

CREATE VIEW vw_index_comparison AS
SELECT 
    miv1.date,
    miv1.index_id,
    mi1.index_code,
    miv1.index_value,
    miv1.index_value_change_pct as index_return,
    
    -- Benchmark comparison (e.g., overall market)
    (SELECT AVG(miv2.index_value_change_pct)
     FROM market_index_values miv2
     WHERE miv2.date = miv1.date
       AND miv2.index_id != miv1.index_id) as market_avg_return,
    
    -- Alpha (excess return)
    miv1.index_value_change_pct - 
    COALESCE((SELECT AVG(miv2.index_value_change_pct)
              FROM market_index_values miv2
              WHERE miv2.date = miv1.date
                AND miv2.index_id != miv1.index_id), 0) as alpha

FROM market_index_values miv1
JOIN market_indices mi1 ON miv1.index_id = mi1.index_id
WHERE mi1.is_active = TRUE
ORDER BY miv1.date DESC, miv1.index_id;

COMMENT ON VIEW vw_index_comparison IS 'Index performance vs market benchmark';

-- ============================================================================
-- 9. SEED DATA: Sample indices
-- ============================================================================

INSERT INTO market_indices (index_code, index_name, index_description, index_type, rebalance_frequency, weighting_method, min_liquidity_threshold, max_constituents) VALUES
    ('NBA-MODERN-001', 'Modern NBA Stars', 'Top 30 NBA stars from 2019-2024 sets with high liquidity', 'thematic', 'monthly', 'liquidity_weighted', 0.60, 30),
    ('PSA10-BLUE-CHIP', 'PSA 10 Blue Chips', 'Premium PSA 10 graded cards with proven track record', 'grade_based', 'quarterly', 'market_cap', 0.80, 20),
    ('ROOKIE-PREMIUM', 'Premium Rookie Cards', 'Rookie cards with >$50 average price and high momentum', 'thematic', 'weekly', 'momentum_weighted', 0.50, 25),
    ('BASKETBALL-CORE', 'Basketball Core Market', 'Broad basketball market representation across all tiers', 'sport_based', 'monthly', 'equal', 0.30, 50),
    ('PANINI-PRIZM', 'Panini Prizm Index', 'Cards from Panini Prizm sets across all sports', 'thematic', 'monthly', 'market_cap', 0.40, 40)
ON CONFLICT (index_code) DO NOTHING;

-- ============================================================================
-- 10. HELPER FUNCTION: Populate fingerprints for existing cards
-- ============================================================================

CREATE OR REPLACE FUNCTION populate_card_fingerprints()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE cards c
    SET 
        card_fingerprint = generate_card_fingerprint(
            sp.slug,
            s.year,
            m.slug,
            s.slug,
            c.card_number,
            COALESCE(c.variation, 'base'),
            p.slug
        ),
        card_fingerprint_hash = generate_fingerprint_hash(
            generate_card_fingerprint(
                sp.slug,
                s.year,
                m.slug,
                s.slug,
                c.card_number,
                COALESCE(c.variation, 'base'),
                p.slug
            )
        ),
        fingerprint_version = 1
    FROM sports sp, manufacturers m, sets s, players p
    WHERE c.sport_id = sp.id
      AND c.manufacturer_id = m.id
      AND c.set_id = s.id
      AND c.player_id = p.id
      AND c.card_fingerprint IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION populate_card_fingerprints IS 'One-time migration to populate fingerprints for all cards';
