#!/usr/bin/env node
/**
 * create_matched_table.js
 * -----------------------
 * Creates the matched_cards_final table and views
 */

require('dotenv').config();

const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createTable() {
  const sql = fs.readFileSync('db/schemas/21-matched-cards-final.sql', 'utf8');
  
  const client = await pool.connect();
  
  try {
    console.log('Creating matched_cards_final table and views...');
    await client.query(sql);
    console.log('✓ Table and views created successfully!');
  } catch (err) {
    console.error('✗ Error creating table:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createTable().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
