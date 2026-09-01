#!/usr/bin/env node
/**
 * create_intelligence_views.js
 * ----------------------------
 * Creates Market Intelligence views for analytics
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

async function createViews() {
  const sql = fs.readFileSync('db/schemas/22-market-intelligence-views.sql', 'utf8');
  
  const client = await pool.connect();
  
  try {
    console.log('Creating Market Intelligence views...');
    await client.query(sql);
    console.log('✓ All views created successfully!');
    console.log('\nCreated views:');
    console.log('  - vw_investment_opportunities');
    console.log('  - vw_grading_intelligence');
    console.log('  - vw_market_efficiency');
    console.log('  - vw_player_grading_profiles');
    console.log('  - vw_opportunity_alerts');
    console.log('  - vw_parallel_performance');
  } catch (err) {
    console.error('✗ Error creating views:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createViews().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
