-- ============================================================================
-- RENAMED: card_daily_snapshots (was card_market_daily)
-- Raw daily snapshots from CSV source data
-- ============================================================================

DROP TABLE IF EXISTS card_daily_snapshots CASCADE;
DROP TABLE IF EXISTS card_market_daily CASCADE; -- Clean up old table

CREATE TABLE card_daily_snapshots (
    card_id BIGINT NOT NULL,
    console_uid TEXT NOT NULL,
    date DATE NOT NULL,
    
    -- Card metadata (denormalized for performance)
    console_name TEXT,           -- From CSV 'console-name' (set name)
    product_name TEXT,           -- From CSV 'product-name' (player/card name)
    
    -- Raw prices from CSV
    loose_price NUMERIC(12,2),   -- Ungraded price
    graded_price NUMERIC(12,2),  -- Generic graded price
    psa10_price NUMERIC(12,2),   -- From manual-only-price (PSA 10 proxy)
    bgs10_price NUMERIC(12,2),   -- BGS 10 price
    
    -- Additional CSV price fields (for record purposes)
    cib_price NUMERIC(12,2),      -- Complete in box price
    new_price NUMERIC(12,2),      -- New/sealed price
    box_only_price NUMERIC(12,2), -- Box only price
    manual_only_price NUMERIC(12,2), -- Manual only price
    condition_17_price NUMERIC(12,2), -- Condition 17 specific
    condition_18_price NUMERIC(12,2), -- Condition 18 specific
    gamestop_price NUMERIC(12,2),      -- GameStop retail price
    gamestop_trade_price NUMERIC(12,2), -- GameStop trade-in value
    
    -- Retail prices (extended)
    retail_loose_buy NUMERIC(12,2),
    retail_loose_sell NUMERIC(12,2),
    retail_cib_buy NUMERIC(12,2),
    retail_cib_sell NUMERIC(12,2),
    retail_new_buy NUMERIC(12,2),
    retail_new_sell NUMERIC(12,2),
    
    -- Volume (from CSV sales-volume)
    sales_volume NUMERIC,        -- 365-day rolling total (from source)
    
    -- Product identifiers (from CSV)
    upc TEXT,                    -- UPC barcode
    tcg_id TEXT,                 -- TCGplayer ID
    asin TEXT,                   -- Amazon ASIN
    epid TEXT,                   -- eBay Product ID
    genre TEXT,                  -- Genre/category
    
    -- Release metadata
    release_date DATE,           -- Product release date
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_file TEXT,            -- Which CSV file this came from
    
    PRIMARY KEY (card_id, date)
);

CREATE INDEX idx_snapshots_date ON card_daily_snapshots(date);
CREATE INDEX idx_snapshots_console ON card_daily_snapshots(console_uid);
CREATE INDEX idx_snapshots_card ON card_daily_snapshots(card_id);
CREATE INDEX idx_snapshots_recent ON card_daily_snapshots(date, card_id);

COMMENT ON TABLE card_daily_snapshots IS 'Raw daily snapshots from CSV source data (renamed from card_market_daily)';

-- ============================================================================
-- NEW: card_computed_metrics
-- Derived analytics and calculated metrics (computed from snapshots)
-- ============================================================================

DROP TABLE IF EXISTS card_computed_metrics CASCADE;

CREATE TABLE card_computed_metrics (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id),
    date DATE NOT NULL,
    
    -- Price metrics
    last_sale_price NUMERIC(12,2),           -- Last known sale price
    last_sale_date DATE,                     -- Date of last sale
    currency TEXT DEFAULT 'USD',
    
    -- Moving averages
    avg_price_7d NUMERIC(12,2),              -- 7-day average price
    avg_price_30d NUMERIC(12,2),             -- 30-day average price
    avg_price_90d NUMERIC(12,2),             -- 90-day average price
    
    -- Price change percentages
    price_change_1d NUMERIC(5,2),            -- 1-day % change
    price_change_7d NUMERIC(5,2),            -- 7-day % change
    price_change_30d NUMERIC(5,2),           -- 30-day % change
    price_change_90d NUMERIC(5,2),           -- 90-day % change
    
    -- Price range
    high_price_30d NUMERIC(12,2),            -- 30-day high
    low_price_30d NUMERIC(12,2),             -- 30-day low
    
    -- Volatility & Risk metrics
    volatility_score NUMERIC(4,2),           -- 0-1 scale (price variance)
    price_stability_index NUMERIC(4,2),      -- 0-1 scale (higher = more stable)
    
    -- Investment-grade signals
    momentum NUMERIC(6,3),                   -- (30d_avg - 90d_avg) / 90d_avg
    price_stddev_30d NUMERIC(12,2),          -- stddev(price, 30d)
    trend_state TEXT,                        -- Rising, Stable, Declining
    
    -- Liquidity metrics (from ALX signals)
    liquidity_score NUMERIC(4,2),            -- 0-1 scale (liquidity baseline normalized)
    sales_velocity NUMERIC(8,2),             -- Units per day estimate
    liquidity_tier TEXT,                     -- High, Medium, Low
    execution_eligible BOOLEAN DEFAULT FALSE,
    
    -- Trend indicators
    trend_direction TEXT,                    -- up, down, sideways
    trend_strength NUMERIC(4,2),             -- 0-1 scale
    
    -- Market cap estimate (price * implied supply)
    estimated_market_cap NUMERIC(15,2),      -- loose_price * sales_velocity * 365
    
    -- Metadata
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    days_of_data INTEGER,                    -- How many snapshot days used
    
    UNIQUE(card_id, date)
);

CREATE INDEX idx_metrics_card ON card_computed_metrics(card_id);
CREATE INDEX idx_metrics_date ON card_computed_metrics(date);
CREATE INDEX idx_metrics_liquidity ON card_computed_metrics(liquidity_score);
CREATE INDEX idx_metrics_volatility ON card_computed_metrics(volatility_score);
CREATE INDEX idx_metrics_trend ON card_computed_metrics(trend_direction) WHERE trend_direction IS NOT NULL;
CREATE INDEX idx_metrics_execution ON card_computed_metrics(execution_eligible) WHERE execution_eligible = true;
CREATE INDEX idx_metrics_change_7d ON card_computed_metrics(price_change_7d);
CREATE INDEX idx_metrics_composite ON card_computed_metrics(card_id, date, liquidity_score, volatility_score);

COMMENT ON TABLE card_computed_metrics IS 'Derived analytics and computed metrics from card_daily_snapshots';

-- ============================================================================
-- View: Latest computed metrics (for reporting)
-- ============================================================================

DROP VIEW IF EXISTS reports_latest_card_computed_metrics;

CREATE VIEW reports_latest_card_computed_metrics AS
SELECT DISTINCT ON (card_id)
    card_id,
    date as metric_date,
    last_sale_price,
    last_sale_date,
    avg_price_7d,
    avg_price_30d,
    avg_price_90d,
    price_change_1d,
    price_change_7d,
    price_change_30d,
    price_change_90d,
    high_price_30d,
    low_price_30d,
    volatility_score,
    liquidity_score,
    sales_velocity,
    liquidity_tier,
    execution_eligible,
    trend_direction,
    trend_strength,
    momentum,
    price_stddev_30d,
    trend_state,
    estimated_market_cap,
    computed_at,
    days_of_data
FROM card_computed_metrics
ORDER BY card_id, date DESC;

COMMENT ON VIEW reports_latest_card_computed_metrics IS 'Latest computed metrics for each card (reporting view)';

-- Keep old name as alias for backward compatibility
DROP VIEW IF EXISTS vw_card_metrics_current;

CREATE VIEW vw_card_metrics_current AS
SELECT * FROM reports_latest_card_computed_metrics;

COMMENT ON VIEW vw_card_metrics_current IS 'Alias for reports_latest_card_computed_metrics - kept for backward compatibility';

-- ============================================================================
-- View: Card with all current data joined
-- ============================================================================

DROP VIEW IF EXISTS vw_card_complete;

CREATE VIEW vw_card_complete AS
SELECT 
    c.id as card_id,
    c.card_number,
    c.rookie_card,
    
    -- Player
    p.full_name as player_name,
    p.first_name,
    p.last_name,
    
    -- Team
    t.name as team_name,
    t.city as team_city,
    t.abbreviation as team_abbr,
    
    -- Set & Manufacturer
    s.name as set_name,
    s.year,
    s.console_uid,
    m.name as manufacturer,
    
    -- League & Sport
    l.name as league_name,
    l.abbreviation as league_abbr,
    sp.name as sport,
    
    -- Current metrics (from view)
    cm.last_sale_price,
    cm.last_sale_date,
    cm.avg_price_7d,
    cm.avg_price_30d,
    cm.avg_price_90d,
    cm.price_change_1d,
    cm.price_change_7d,
    cm.price_change_30d,
    cm.price_change_90d,
    cm.high_price_30d,
    cm.low_price_30d,
    cm.volatility_score,
    cm.liquidity_score,
    cm.sales_velocity,
    cm.liquidity_tier,
    cm.execution_eligible,
    cm.trend_direction,
    cm.trend_strength,
    cm.momentum,
    cm.price_stddev_30d,
    cm.trend_state,
    cm.estimated_market_cap,
    cm.computed_at as metrics_updated
    
FROM cards c
LEFT JOIN players p ON c.player_id = p.id
LEFT JOIN teams t ON c.team_id = t.id
LEFT JOIN sets s ON c.set_id = s.id
LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
LEFT JOIN leagues l ON c.league_id = l.id
LEFT JOIN sports sp ON c.sport_id = sp.id
LEFT JOIN vw_card_metrics_current cm ON c.id = cm.card_id;

COMMENT ON VIEW vw_card_complete IS 'Complete card profile with dimensions and current metrics';
