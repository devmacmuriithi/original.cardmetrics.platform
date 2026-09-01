require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const sql = `
CREATE TABLE IF NOT EXISTS card_computed_metrics (
    card_id BIGINT NOT NULL,
    date DATE NOT NULL,
    console_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    loose_price NUMERIC(12,2) NOT NULL,
    high_7d NUMERIC(12,2) NOT NULL,
    low_7d NUMERIC(12,2) NOT NULL,
    range_pct_7d NUMERIC(6,2) NOT NULL,
    high_15d NUMERIC(12,2) NOT NULL,
    low_15d NUMERIC(12,2) NOT NULL,
    range_pct_15d NUMERIC(6,2) NOT NULL,
    high_30d NUMERIC(12,2) NOT NULL,
    low_30d NUMERIC(12,2) NOT NULL,
    range_pct_30d NUMERIC(6,2) NOT NULL,
    price_position_7d NUMERIC(5,1) NOT NULL,
    price_change_pct NUMERIC(8,2) NOT NULL,
    trend_state TEXT NOT NULL,
    days_of_data INTEGER NOT NULL,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (card_id, date)
);

CREATE INDEX IF NOT EXISTS idx_cm_date ON card_computed_metrics(date);
CREATE INDEX IF NOT EXISTS idx_cm_trend ON card_computed_metrics(trend_state, date);
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 60000');
    await client.query(sql);
    console.log('✅ Table card_computed_metrics created');
    
    // Verify
    const r = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'card_computed_metrics' 
      ORDER BY ordinal_position
    `);
    console.log(`\nColumns (${r.rows.length}):`);
    for (const row of r.rows) {
      console.log(`  - ${row.column_name}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Error:', e.message); pool.end(); });
