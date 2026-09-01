require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  statement_timeout: 30000
});

const CREATE_SNAPSHOTS_SQL = `
DROP TABLE IF EXISTS card_daily_snapshots CASCADE;

CREATE TABLE card_daily_snapshots (
    card_id BIGINT NOT NULL,
    console_uid TEXT NOT NULL,
    date DATE NOT NULL,
    
    -- Card metadata (denormalized for performance)
    console_name TEXT,
    product_name TEXT,
    
    -- Raw prices from CSV
    loose_price NUMERIC(12,2),
    graded_price NUMERIC(12,2),
    psa10_price NUMERIC(12,2),
    bgs10_price NUMERIC(12,2),
    
    -- Additional CSV price fields
    cib_price NUMERIC(12,2),
    new_price NUMERIC(12,2),
    box_only_price NUMERIC(12,2),
    manual_only_price NUMERIC(12,2),
    condition_17_price NUMERIC(12,2),
    condition_18_price NUMERIC(12,2),
    gamestop_price NUMERIC(12,2),
    gamestop_trade_price NUMERIC(12,2),
    
    -- Retail prices
    retail_loose_buy NUMERIC(12,2),
    retail_loose_sell NUMERIC(12,2),
    retail_cib_buy NUMERIC(12,2),
    retail_cib_sell NUMERIC(12,2),
    retail_new_buy NUMERIC(12,2),
    retail_new_sell NUMERIC(12,2),
    
    -- Volume
    sales_volume NUMERIC,
    
    -- Product identifiers
    upc TEXT,
    tcg_id TEXT,
    asin TEXT,
    epid TEXT,
    genre TEXT,
    
    -- Release metadata
    release_date DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_file TEXT,
    
    PRIMARY KEY (card_id, date)
);

CREATE INDEX idx_snapshots_date ON card_daily_snapshots(date);
CREATE INDEX idx_snapshots_console ON card_daily_snapshots(console_uid);
CREATE INDEX idx_snapshots_card ON card_daily_snapshots(card_id);
CREATE INDEX idx_snapshots_recent ON card_daily_snapshots(date, card_id);
`;

async function createSnapshots() {
  const client = await pool.connect();
  try {
    console.log('Creating card_daily_snapshots...');
    await client.query(CREATE_SNAPSHOTS_SQL);
    console.log('✅ card_daily_snapshots created with all fields');
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

createSnapshots().then(() => pool.end()).catch(err => {
  console.error('Failed:', err.message);
  pool.end();
  process.exit(1);
});
