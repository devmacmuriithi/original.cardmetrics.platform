require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Dropping old table...');
    await client.query('DROP TABLE IF EXISTS sets_computed_metrics CASCADE');
    
    console.log('Creating new table with updated schema...');
    await client.query(`
      CREATE TABLE sets_computed_metrics (
        id SERIAL PRIMARY KEY,
        set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
        console_uid TEXT,
        console_name TEXT,
        date DATE NOT NULL,
        cards_count INTEGER NOT NULL DEFAULT 0,
        cards_with_prices_count INTEGER NOT NULL DEFAULT 0,
        cards_with_windows_count INTEGER NOT NULL DEFAULT 0,
        coverage_pct DECIMAL(5,2) DEFAULT 0,
        avg_loose_price DECIMAL(15,2),
        median_loose_price DECIMAL(15,2),
        min_loose_price DECIMAL(15,2),
        max_loose_price DECIMAL(15,2),
        price_range_pct DECIMAL(8,4),
        std_dev_price DECIMAL(15,4),
        total_sales_volume BIGINT DEFAULT 0,
        total_market_value NUMERIC(20,2),
        avg_daily_volume DECIMAL(15,2),
        avg_price_change_pct_7d DECIMAL(12,4),
        avg_price_change_pct_30d DECIMAL(12,4),
        weighted_avg_change_pct_7d DECIMAL(12,4),
        cards_up_count_7d INTEGER DEFAULT 0,
        cards_down_count_7d INTEGER DEFAULT 0,
        cards_flat_count_7d INTEGER DEFAULT 0,
        pct_cards_up_7d DECIMAL(12,4),
        avg_volatility_30d DECIMAL(12,4),
        high_volatility_cards_count INTEGER DEFAULT 0,
        high_volatility_cards_pct DECIMAL(12,4),
        liquidity_score DECIMAL(12,4),
        computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(set_id, date)
      )
    `);
    
    console.log('Creating indexes...');
    await client.query('CREATE INDEX idx_sets_metrics_date ON sets_computed_metrics(date)');
    await client.query('CREATE INDEX idx_sets_metrics_set_id ON sets_computed_metrics(set_id)');
    
    console.log('✅ Migration complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
