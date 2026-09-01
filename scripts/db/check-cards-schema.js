#!/usr/bin/env node
/**
 * Check cards table schema
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trading_cards',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  
  try {
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cards'
      ORDER BY ordinal_position
    `);
    console.log('cards table columns:');
    rows.forEach(r => console.log('  ' + r.column_name + ': ' + r.data_type + ' (nullable: ' + r.is_nullable + ', default: ' + (r.column_default || 'none') + ')'));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
