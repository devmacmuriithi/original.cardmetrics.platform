-- ============================================================================
-- STAGING TABLE: cards_raw_ingests
-- Fast bulk import from CSVs before transformation to normalized schema
-- ============================================================================

-- Clean up old duplicate table if exists
DROP TABLE IF EXISTS cards_raw_ingest CASCADE;

DROP TABLE IF EXISTS cards_raw_ingests CASCADE;

CREATE TABLE cards_raw_ingests (
    id SERIAL PRIMARY KEY,
    
    -- Raw CSV fields (exact column mapping from source files)
    card_id BIGINT,                    -- id from CSV
    product_name TEXT,                   -- product-name from CSV (player/card name)
    console_name TEXT,                   -- console-name from CSV (set name)
    console_uid TEXT,                    -- set identifier (parsed from filename or CSV)
    
    -- Price fields (raw from CSV)
    loose_price NUMERIC(12,2),           -- loose-price
    graded_price NUMERIC(12,2),          -- graded-price
    psa10_price NUMERIC(12,2),           -- manual-only-price (PSA 10 proxy)
    bgs10_price NUMERIC(12,2),           -- bgs-10-price
    cib_price NUMERIC(12,2),              -- cib-price (Complete in box)
    new_price NUMERIC(12,2),              -- new-price
    box_only_price NUMERIC(12,2),         -- box-only-price
    manual_only_price NUMERIC(12,2),      -- manual-only-price
    condition_17_price NUMERIC(12,2),     -- condition-17-price
    condition_18_price NUMERIC(12,2),     -- condition-18-price
    gamestop_price NUMERIC(12,2),         -- gamestop-price
    gamestop_trade_price NUMERIC(12,2),   -- gamestop-trade-price
    retail_loose_buy NUMERIC(12,2),        -- retail-loose-buy
    retail_loose_sell NUMERIC(12,2),       -- retail-loose-sell
    retail_cib_buy NUMERIC(12,2),         -- retail-cib-buy
    retail_cib_sell NUMERIC(12,2),        -- retail-cib-sell
    retail_new_buy NUMERIC(12,2),         -- retail-new-buy
    retail_new_sell NUMERIC(12,2),        -- retail-new-sell
    
    -- Volume
    sales_volume NUMERIC,                -- sales-volume (365-day rolling)
    
    -- Product identifiers
    upc TEXT,                             -- upc
    tcg_id TEXT,                          -- tcg-id
    asin TEXT,                            -- asin
    epid TEXT,                            -- epid
    genre TEXT,                           -- genre
    
    -- Release metadata
    release_date DATE,                    -- release-date
    
    -- Metadata
    snapshot_date DATE,                  -- date from folder path (dt=YYYY-MM-DD)
    source_file TEXT,                    -- CSV filename
    source_path TEXT,                    -- Full S3 path or local path
    
    -- Processing status
    processed BOOLEAN DEFAULT FALSE,     -- Whether synced to normalized tables
    processed_at TIMESTAMP,            -- When synced
    error_message TEXT,                  -- If processing failed
    
    -- Raw data preservation
    raw_csv_line TEXT,                   -- Original CSV line (for debugging)
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast operations
CREATE INDEX idx_raw_ingests_card ON cards_raw_ingests(card_id);
CREATE INDEX idx_raw_ingests_date ON cards_raw_ingests(snapshot_date);
CREATE INDEX idx_raw_ingests_console ON cards_raw_ingests(console_uid);
CREATE INDEX idx_raw_ingests_processed ON cards_raw_ingests(processed) WHERE processed = FALSE;
CREATE INDEX idx_raw_ingests_unprocessed ON cards_raw_ingests(snapshot_date, processed) WHERE processed = FALSE;

COMMENT ON TABLE cards_raw_ingests IS 'Staging table for fast CSV bulk imports before transformation to normalized schema';

-- ============================================================================
-- View: Unprocessed raw ingests ready for sync
-- ============================================================================

DROP VIEW IF EXISTS vw_raw_ingests_unprocessed;

CREATE VIEW vw_raw_ingests_unprocessed AS
SELECT *
FROM cards_raw_ingests
WHERE processed = FALSE
ORDER BY snapshot_date, card_id;

COMMENT ON VIEW vw_raw_ingests_unprocessed IS 'Raw ingests waiting to be synced to normalized tables';

-- ============================================================================
-- View: Raw ingests processing summary
-- ============================================================================

DROP VIEW IF EXISTS vw_raw_ingests_summary;

CREATE VIEW vw_raw_ingests_summary AS
SELECT 
    snapshot_date,
    console_uid,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE processed = TRUE) as processed_rows,
    COUNT(*) FILTER (WHERE processed = FALSE) as pending_rows,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as error_rows,
    MIN(created_at) as first_import,
    MAX(created_at) as last_import
FROM cards_raw_ingests
GROUP BY snapshot_date, console_uid
ORDER BY snapshot_date DESC, console_uid;

COMMENT ON VIEW vw_raw_ingests_summary IS 'Summary of raw ingests by date and set';
