-- Quick staging table recreate
-- Run this directly in psql

-- Force drop if exists (with statement_timeout to prevent hanging)
SET statement_timeout = '5s';
DROP TABLE IF EXISTS cards_raw_ingests CASCADE;

-- Create staging table with all fields
CREATE TABLE cards_raw_ingests (
    id SERIAL PRIMARY KEY,
    ingest_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Core CSV fields
    card_id BIGINT,
    product_name TEXT,
    console_name TEXT,
    console_uid TEXT,
    
    -- All price fields
    loose_price NUMERIC(12,2),
    graded_price NUMERIC(12,2),
    psa10_price NUMERIC(12,2),
    bgs10_price NUMERIC(12,2),
    cib_price NUMERIC(12,2),
    new_price NUMERIC(12,2),
    box_only_price NUMERIC(12,2),
    manual_only_price NUMERIC(12,2),
    condition_17_price NUMERIC(12,2),
    condition_18_price NUMERIC(12,2),
    gamestop_price NUMERIC(12,2),
    gamestop_trade_price NUMERIC(12,2),
    retail_loose_buy NUMERIC(12,2),
    retail_loose_sell NUMERIC(12,2),
    retail_cib_buy NUMERIC(12,2),
    retail_cib_sell NUMERIC(12,2),
    retail_new_buy NUMERIC(12,2),
    retail_new_sell NUMERIC(12,2),
    
    -- Volume and IDs
    sales_volume NUMERIC,
    upc TEXT,
    tcg_id TEXT,
    asin TEXT,
    epid TEXT,
    genre TEXT,
    release_date DATE,
    
    -- Metadata
    snapshot_date DATE,
    source_file TEXT,
    source_path TEXT,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT,
    
    -- Raw data backup
    raw_csv_line TEXT,
    
    -- Constraints
    UNIQUE(card_id, console_uid, snapshot_date, source_file)
);

-- Simple indexes
CREATE INDEX idx_raw_ingests_unprocessed ON cards_raw_ingests(processed) WHERE processed = FALSE;
CREATE INDEX idx_raw_ingests_snapshot ON cards_raw_ingests(snapshot_date);

COMMENT ON TABLE cards_raw_ingests IS 'Staging table for raw CSV data - simplified version';
