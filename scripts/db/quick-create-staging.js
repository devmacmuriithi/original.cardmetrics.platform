/**
 * quick-create-staging.js - Create staging table directly with timeout handling
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  statement_timeout: 30000 // 30 second timeout per query
});

const CREATE_SQL = `
DROP TABLE IF EXISTS cards_raw_ingests CASCADE;

CREATE TABLE cards_raw_ingests (
    id SERIAL PRIMARY KEY,
    ingest_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    card_id BIGINT,
    product_name TEXT,
    console_name TEXT,
    console_uid TEXT,
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
    sales_volume NUMERIC,
    upc TEXT,
    tcg_id TEXT,
    asin TEXT,
    epid TEXT,
    genre TEXT,
    release_date DATE,
    snapshot_date DATE,
    source_file TEXT,
    source_path TEXT,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT,
    raw_csv_line TEXT,
    UNIQUE(card_id, console_uid, snapshot_date, source_file)
);

CREATE INDEX idx_raw_ingests_unprocessed ON cards_raw_ingests(processed) WHERE processed = FALSE;
CREATE INDEX idx_raw_ingests_snapshot ON cards_raw_ingests(snapshot_date);
`;

async function createStaging() {
  const client = await pool.connect();
  
  try {
    console.log('Creating cards_raw_ingests staging table...');
    await client.query(CREATE_SQL);
    console.log('✅ Staging table created successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

(async () => {
  try {
    await createStaging();
    await pool.end();
    process.exit(0);
  } catch (err) {
    await pool.end();
    process.exit(1);
  }
})();
