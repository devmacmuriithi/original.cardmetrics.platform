-- ============================================================================
-- MATCHED CARDS FINAL REPORT
-- Combined SportsCard Pro + GemRate data for complete card analysis
-- ============================================================================
-- This table holds the merged output from match_spc_to_gemrate.js
-- Combines pricing data (SPC) with grading statistics (GemRate)
-- ============================================================================

DROP TABLE IF EXISTS matched_cards_final CASCADE;

CREATE TABLE matched_cards_final (
    id SERIAL PRIMARY KEY,
    
    -- ========================================================================
    -- IDENTIFIERS
    -- ========================================================================
    spc_id BIGINT,                                       -- SportsCard Pro ID
    gemrate_id TEXT NOT NULL,                            -- GemRate unique hash ID
    console_name TEXT NOT NULL,                          -- Set identifier (e.g., "Basketball Cards 2024 Panini Prizm")
    
    -- ========================================================================
    -- CARD IDENTITY
    -- ========================================================================
    player_name TEXT NOT NULL,                           -- Player name
    parallel TEXT NOT NULL,                              -- Parallel/variant name
    card_number TEXT NOT NULL,                           -- Card number within set
    card_description TEXT,                               -- Full card description
    
    -- ========================================================================
    -- PRICING DATA (from SportsCard Pro)
    -- ========================================================================
    loose_price NUMERIC(12,2),                           -- Raw/ungraded card price
    graded_price NUMERIC(12,2),                          -- Average across all grades
    manual_only_price NUMERIC(12,2),                     -- PSA 9 price
    bgs_10_price NUMERIC(12,2),                          -- PSA 10 price
    
    -- ========================================================================
    -- SALES ACTIVITY (from SportsCard Pro)
    -- ========================================================================
    sales_volume INTEGER,                                -- Total sales count
    spc_date DATE,                                       -- SPC snapshot date
    
    -- ========================================================================
    -- GRADING SUMMARY (from GemRate)
    -- ========================================================================
    gem_rate_all_time TEXT,                              -- % PSA 10 all-time (e.g., "25%")
    gem_rate_past_month TEXT,                            -- % PSA 10 past month
    total_graded TEXT,                                   -- Total cards graded (formatted with commas)
    total_gems TEXT,                                     -- Total PSA 10s
    graded_past_month TEXT,                              -- Cards graded in past 30 days
    graded_prior_month TEXT,                             -- Cards graded in prior 30 days
    momentum_30d TEXT,                                   -- Month-over-month momentum (e.g., "-19%")
    last_gem_date DATE,                                  -- Most recent PSA 10 date
    last_graded_date DATE,                               -- Most recent grading date
    
    -- ========================================================================
    -- PSA GRADE DISTRIBUTION (from GemRate)
    -- Percentage breakdown by grade
    -- ========================================================================
    pct_psa_10 TEXT,                                     -- % PSA 10
    pct_psa_9 TEXT,                                      -- % PSA 9
    pct_psa_8 TEXT,                                      -- % PSA 8
    pct_psa_7 TEXT,                                      -- % PSA 7
    pct_psa_6 TEXT,                                      -- % PSA 6
    pct_psa_5 TEXT,                                      -- % PSA 5
    pct_psa_4 TEXT,                                      -- % PSA 4
    pct_psa_3 TEXT,                                      -- % PSA 3
    
    -- ========================================================================
    -- REFERENCE LINKS
    -- ========================================================================
    cardladder_all_graded_url TEXT,                      -- CardLadder sales history
    gemrate_url TEXT,                                    -- GemRate universal pop
    psa_cert_url TEXT,                                   -- Recent PSA certification
    
    -- ========================================================================
    -- METADATA
    -- ========================================================================
    import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- When record was imported
    source_file TEXT,                                    -- Source CSV filename
    
    -- Unique constraint: one row per card
    UNIQUE(gemrate_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_matched_cards_player ON matched_cards_final(player_name);
CREATE INDEX idx_matched_cards_console ON matched_cards_final(console_name);
CREATE INDEX idx_matched_cards_parallel ON matched_cards_final(parallel);
CREATE INDEX idx_matched_cards_card_number ON matched_cards_final(card_number);
CREATE INDEX idx_matched_cards_spc_id ON matched_cards_final(spc_id);
CREATE INDEX idx_matched_cards_gemrate_id ON matched_cards_final(gemrate_id);
CREATE INDEX idx_matched_cards_spc_date ON matched_cards_final(spc_date);

-- Composite indexes for common queries
CREATE INDEX idx_matched_cards_player_parallel ON matched_cards_final(player_name, parallel);
CREATE INDEX idx_matched_cards_console_player ON matched_cards_final(console_name, player_name);

-- Price range queries
CREATE INDEX idx_matched_cards_loose_price ON matched_cards_final(loose_price) WHERE loose_price IS NOT NULL;
CREATE INDEX idx_matched_cards_bgs_10_price ON matched_cards_final(bgs_10_price) WHERE bgs_10_price IS NOT NULL;

COMMENT ON TABLE matched_cards_final IS 'Final matched report combining SportsCard Pro pricing with GemRate grading statistics';

-- ============================================================================
-- REPORTING VIEW: Cleaned numeric values for analysis
-- ============================================================================

DROP VIEW IF EXISTS vw_matched_cards_analytics;

CREATE VIEW vw_matched_cards_analytics AS
SELECT 
    id,
    spc_id,
    gemrate_id,
    console_name,
    player_name,
    parallel,
    card_number,
    
    -- Pricing
    loose_price,
    graded_price,
    manual_only_price,
    bgs_10_price,
    sales_volume,
    spc_date,
    
    -- Convert percentage strings to numeric
    CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) / 100 as gem_rate_all_time_pct,
    CAST(REPLACE(gem_rate_past_month, '%', '') AS NUMERIC) / 100 as gem_rate_past_month_pct,
    
    -- Convert comma-formatted numbers to integers
    CAST(REPLACE(total_graded, ',', '') AS INTEGER) as total_graded_count,
    CAST(total_gems AS INTEGER) as total_gems_count,
    CAST(graded_past_month AS INTEGER) as graded_past_month_count,
    CAST(graded_prior_month AS INTEGER) as graded_prior_month_count,
    
    -- Momentum
    CAST(REPLACE(momentum_30d, '%', '') AS NUMERIC) / 100 as momentum_30d_pct,
    
    -- Dates
    last_gem_date,
    last_graded_date,
    
    -- Grade distribution as decimals
    CAST(REPLACE(pct_psa_10, '%', '') AS NUMERIC) / 100 as psa_10_pct,
    CAST(REPLACE(pct_psa_9, '%', '') AS NUMERIC) / 100 as psa_9_pct,
    CAST(REPLACE(pct_psa_8, '%', '') AS NUMERIC) / 100 as psa_8_pct,
    CAST(REPLACE(pct_psa_7, '%', '') AS NUMERIC) / 100 as psa_7_pct,
    CAST(REPLACE(pct_psa_6, '%', '') AS NUMERIC) / 100 as psa_6_pct,
    CAST(REPLACE(pct_psa_5, '%', '') AS NUMERIC) / 100 as psa_5_pct,
    CAST(REPLACE(pct_psa_4, '%', '') AS NUMERIC) / 100 as psa_4_pct,
    CAST(REPLACE(pct_psa_3, '%', '') AS NUMERIC) / 100 as psa_3_pct,
    
    -- Links
    cardladder_all_graded_url,
    gemrate_url,
    psa_cert_url
    
FROM matched_cards_final;

COMMENT ON VIEW vw_matched_cards_analytics IS 'Analytics-ready view with numeric conversions for percentage and comma-formatted fields';

-- ============================================================================
-- REPORTING VIEW: Top investment opportunities
-- ============================================================================

DROP VIEW IF EXISTS vw_matched_cards_investment_signals;

CREATE VIEW vw_matched_cards_investment_signals AS
SELECT 
    player_name,
    parallel,
    card_number,
    console_name,
    
    -- Pricing metrics
    loose_price,
    bgs_10_price,
    bgs_10_price / NULLIF(loose_price, 0) as grade_premium_multiplier,
    
    -- Grading difficulty (lower gem rate = harder to grade = more valuable)
    gem_rate_all_time_pct,
    gem_rate_past_month_pct,
    
    -- Volume and liquidity
    sales_volume,
    total_graded_count,
    graded_past_month_count,
    
    -- Momentum signals
    momentum_30d_pct,
    CASE 
        WHEN momentum_30d_pct > 0.20 THEN 'Hot'
        WHEN momentum_30d_pct > 0 THEN 'Rising'
        WHEN momentum_30d_pct > -0.20 THEN 'Cooling'
        ELSE 'Cold'
    END as grading_momentum,
    
    -- Investment score (lower gem rate + high price premium + positive momentum)
    (
        (1 - COALESCE(gem_rate_all_time_pct, 0.5)) * 0.4 +                    -- 40% weight: grading difficulty
        LEAST(COALESCE(bgs_10_price / NULLIF(loose_price, 0), 1), 20) * 0.03 + -- 30% weight: grade premium (capped at 20x)
        (COALESCE(momentum_30d_pct, 0) + 1) * 0.3                              -- 30% weight: momentum
    ) as investment_score,
    
    -- Links
    gemrate_url,
    cardladder_all_graded_url
    
FROM vw_matched_cards_analytics
WHERE loose_price > 0 
  AND total_graded_count > 50  -- Minimum population for statistical relevance
ORDER BY investment_score DESC;

COMMENT ON VIEW vw_matched_cards_investment_signals IS 'Investment opportunity ranking based on gem rate, price premium, and momentum';
