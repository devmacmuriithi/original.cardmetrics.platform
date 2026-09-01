-- ============================================================================
-- FUTURE: card_sales table for granular transaction data
-- Placeholder schema - not populated yet (requires eBay API or auction feeds)
-- ============================================================================

DROP TABLE IF EXISTS card_sales CASCADE;

CREATE TABLE card_sales (
    id SERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    
    -- Transaction details
    sale_date TIMESTAMP NOT NULL,                    -- Exact sale timestamp
    sale_price NUMERIC(12,2) NOT NULL,               -- Transaction price
    currency TEXT DEFAULT 'USD',
    
    -- Platform information
    platform TEXT NOT NULL,                          -- eBay, PWCC, Goldin, MySlabs, COMC
    platform_listing_id TEXT,                        -- Platform's listing ID
    platform_url TEXT,                               -- Link to listing (if available)
    
    -- Sale type and conditions
    listing_type TEXT,                               -- Auction, BIN (Buy It Now), Offer, Best Offer
    condition TEXT,                                    -- PSA 10, BGS 9.5, Raw NM, etc.
    card_attributes JSONB,                           -- {auto: true, patch: false, numbered: "/25"}
    
    -- Seller information (anonymized)
    seller_id TEXT,                                    -- Platform username (hashed/anonymized)
    seller_rating INTEGER,                           -- Feedback score
    seller_location TEXT,                              -- Country/State (anonymized)
    
    -- Buyer information (highly anonymized)
    buyer_location TEXT,                               -- State/Country only
    
    -- Financial details
    quantity INTEGER DEFAULT 1,                      -- Usually 1 for cards
    shipping_cost NUMERIC(6,2),                      -- Shipping charged
    tax_amount NUMERIC(6,2),                         -- Sales tax
    platform_fees NUMERIC(6,2),                      -- eBay/PayPal/other fees
    seller_payout NUMERIC(12,2),                     -- Net to seller (price - fees)
    
    -- Listing metadata
    listing_title TEXT,                                -- Original listing title
    images TEXT[],                                     -- Array of image URLs
    
    -- Data source tracking
    data_source TEXT DEFAULT 'unknown',              -- ebay_api, pwcc_feed, scraping, manual
    source_file TEXT,                                -- If from bulk import
    raw_data JSONB,                                    -- Original API response (for debugging)
    
    -- Record metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    imported_at TIMESTAMP,                           -- When we ingested this record
    verified BOOLEAN DEFAULT FALSE,                  -- Manual verification flag
    
    -- Unique constraint to prevent duplicates
    UNIQUE(platform, platform_listing_id, sale_date)
);

-- Indexes for common query patterns
CREATE INDEX idx_card_sales_card ON card_sales(card_id);
CREATE INDEX idx_card_sales_date ON card_sales(sale_date);
CREATE INDEX idx_card_sales_platform ON card_sales(platform);
CREATE INDEX idx_card_sales_card_date ON card_sales(card_id, sale_date);
CREATE INDEX idx_card_sales_price ON card_sales(sale_price);
CREATE INDEX idx_card_sales_listing_type ON card_sales(listing_type);
CREATE INDEX idx_card_sales_data_source ON card_sales(data_source);

-- Partial index for verified sales (boolean column is immutable)
CREATE INDEX idx_card_sales_verified ON card_sales(card_id, sale_price) 
    WHERE verified = true;

COMMENT ON TABLE card_sales IS 'Individual card transaction records from eBay, PWCC, auction houses (requires API integration)';

-- ============================================================================
-- Aggregation view: Daily summary from card_sales (for comparison with snapshots)
-- ============================================================================

DROP VIEW IF EXISTS vw_card_sales_daily;

CREATE VIEW vw_card_sales_daily AS
SELECT 
    card_id,
    DATE(sale_date) as date,
    COUNT(*) as transaction_count,
    AVG(sale_price) as avg_sale_price,
    MIN(sale_price) as min_sale_price,
    MAX(sale_price) as max_sale_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price) as median_sale_price,
    STDDEV(sale_price) as price_stddev,
    SUM(sale_price) as total_volume_usd,
    COUNT(*) FILTER (WHERE listing_type = 'Auction') as auction_count,
    COUNT(*) FILTER (WHERE listing_type = 'BIN') as bin_count,
    AVG(platform_fees) as avg_fees,
    AVG(seller_payout) as avg_payout
FROM card_sales
GROUP BY card_id, DATE(sale_date);

COMMENT ON VIEW vw_card_sales_daily IS 'Daily aggregations from granular sales (compare to card_daily_snapshots)';

-- ============================================================================
-- View: Compare snapshot prices vs actual sale prices
-- ============================================================================

DROP VIEW IF EXISTS vw_price_accuracy_analysis;

CREATE VIEW vw_price_accuracy_analysis AS
SELECT 
    s.card_id,
    s.date,
    s.loose_price as snapshot_price,
    sa.avg_sale_price as actual_avg_price,
    sa.median_sale_price as actual_median_price,
    sa.transaction_count,
    s.loose_price - sa.avg_sale_price as snapshot_variance,
    CASE 
        WHEN ABS(s.loose_price - sa.avg_sale_price) / NULLIF(sa.avg_sale_price, 0) < 0.05 THEN 'Accurate'
        WHEN ABS(s.loose_price - sa.avg_sale_price) / NULLIF(sa.avg_sale_price, 0) < 0.15 THEN 'Acceptable'
        ELSE 'High Variance'
    END as accuracy_rating
FROM card_daily_snapshots s
LEFT JOIN vw_card_sales_daily sa ON s.card_id = sa.card_id AND s.date = sa.date
WHERE sa.transaction_count > 0;

COMMENT ON VIEW vw_price_accuracy_analysis IS 'Compare snapshot estimated prices to actual transaction prices';
