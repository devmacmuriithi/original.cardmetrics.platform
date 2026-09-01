-- Milestone 2: COPY-Based Bulk Ingestion Schema
-- Matches Collection-Sets-Documentation.md specification exactly

-- ============================================================================
-- SETS MASTER: Dimension Table for Metabase Filtering
-- ============================================================================

DROP TABLE IF EXISTS sets_master CASCADE;

CREATE TABLE sets_master (
    console_uid TEXT PRIMARY KEY,
    slug TEXT,
    category TEXT,           -- Basketball, Baseball, etc.
    page_name TEXT,
    url TEXT,
    csv_path TEXT            -- Pattern: {slug}_{console_uid}.csv
);

CREATE INDEX IF NOT EXISTS idx_sets_category ON sets_master(category);
CREATE INDEX IF NOT EXISTS idx_sets_slug ON sets_master(slug);

-- ============================================================================
-- BRONZE: Raw Landing (Staging Only) - UNLOGGED for speed
-- ============================================================================

DROP TABLE IF EXISTS cards_raw_ingests CASCADE;

CREATE UNLOGGED TABLE cards_raw_ingests (
    id BIGSERIAL PRIMARY KEY,
    ingest_date DATE NOT NULL,
    console_uid TEXT NOT NULL,
    card_id BIGINT NOT NULL,
    payload JSONB NOT NULL,
    filename TEXT
);

CREATE INDEX idx_raw_ingest_date ON cards_raw_ingests(ingest_date);
CREATE INDEX idx_raw_ingest_console ON cards_raw_ingests(console_uid);
CREATE INDEX idx_raw_ingest_card ON cards_raw_ingests(card_id, ingest_date);

-- ============================================================================
-- SILVER: Normalized Daily Market Facts
-- ============================================================================

DROP TABLE IF EXISTS card_market_daily CASCADE;

CREATE TABLE card_market_daily (
    card_id BIGINT NOT NULL,
    console_uid TEXT NOT NULL,
    date DATE NOT NULL,
    
    -- Card metadata for easy Metabase visualization
    console_name TEXT,           -- From CSV 'console-name'
    product_name TEXT,           -- From CSV 'product-name'
    
    -- Core prices (as specified in documentation)
    loose_price NUMERIC(12,2),
    graded_price NUMERIC(12,2),
    psa10_price NUMERIC(12,2),      -- From manual-only-price
    bgs10_price NUMERIC(12,2),
    
    -- Retail prices
    retail_loose_buy NUMERIC(12,2),
    retail_loose_sell NUMERIC(12,2),
    
    -- Volume
    sales_volume NUMERIC,
    
    PRIMARY KEY (card_id, date)
);

CREATE INDEX idx_market_daily_date ON card_market_daily(date);
CREATE INDEX idx_market_daily_console ON card_market_daily(console_uid);
CREATE INDEX idx_market_daily_card ON card_market_daily(card_id);

-- ============================================================================
-- GOLD: Delta + Liquidity View (Window Functions)
-- ============================================================================

DROP VIEW IF EXISTS card_market_diff;

CREATE VIEW card_market_diff AS
SELECT
    t.card_id,
    t.console_uid,
    t.console_name,
    t.product_name,
    t.date,
    
    -- Current values
    t.loose_price,
    t.sales_volume,
    
    -- Price diff (today - yesterday)
    t.loose_price - LAG(t.loose_price) 
        OVER (PARTITION BY t.card_id ORDER BY t.date) 
        AS loose_price_diff,
    
    -- Volume diff (today - yesterday)
    t.sales_volume - LAG(t.sales_volume) 
        OVER (PARTITION BY t.card_id ORDER BY t.date) 
        AS sales_volume_diff,
    
    -- Liquidity estimate: max(0, sales_volume_today - sales_volume_yesterday)
    GREATEST(
        0,
        t.sales_volume - LAG(t.sales_volume) 
            OVER (PARTITION BY t.card_id ORDER BY t.date)
    ) AS daily_sales_est

FROM card_market_daily t;
