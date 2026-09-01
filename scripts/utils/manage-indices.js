/**
 * manage-indices.js - Market Index Management & Computation
 * 
 * Commands:
 *   node manage-indices.js list                    # Show all indices
 *   node manage-indices.js create                  # Create new index interactively
 *   node manage-indices.js add-cards <index_code>  # Add cards to index
 *   node manage-indices.js compute <index_code>    # Compute index values for date range
 *   node manage-indices.js rebalance <index_code>  # Rebalance index constituents
 * 
 * Examples:
 *   node manage-indices.js compute NBA-MODERN-001
 *   node manage-indices.js rebalance PSA10-BLUE-CHIP
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 5
});

// List all indices
async function listIndices(client) {
  console.log('\n📊 Market Indices:');
  
  const result = await client.query(`
    SELECT 
      index_code,
      index_name,
      index_type,
      rebalance_frequency,
      weighting_method,
      is_active,
      (SELECT COUNT(*) 
       FROM market_index_constituents mic 
       WHERE mic.index_id = mi.index_id 
         AND mic.exit_date IS NULL) as constituent_count
    FROM market_indices mi
    ORDER BY index_code
  `);
  
  if (result.rows.length === 0) {
    console.log('  No indices found. Create one with: node manage-indices.js create');
    return;
  }
  
  result.rows.forEach(idx => {
    const status = idx.is_active ? '✅' : '⏸️';
    console.log(`  ${status} ${idx.index_code}`);
    console.log(`     ${idx.index_name}`);
    console.log(`     Type: ${idx.index_type} | ${idx.constituent_count} constituents`);
    console.log(`     Rebalance: ${idx.rebalance_frequency} | Weight: ${idx.weighting_method}`);
    console.log('');
  });
}

// Add qualifying cards to an index
async function addCardsToIndex(client, indexCode, options = {}) {
  console.log(`\n🎯 Adding cards to ${indexCode}...`);
  
  // Get index details
  const indexResult = await client.query(
    'SELECT * FROM market_indices WHERE index_code = $1',
    [indexCode]
  );
  
  if (indexResult.rows.length === 0) {
    console.error(`❌ Index ${indexCode} not found`);
    return;
  }
  
  const index = indexResult.rows[0];
  const minLiquidity = options.minLiquidity || index.min_liquidity_threshold || 0.30;
  const maxCards = options.maxCards || index.max_constituents || 50;
  
  // Find qualifying cards
  const qualifyingQuery = `
    SELECT 
      c.id as card_id,
      c.card_fingerprint_hash,
      cm.liquidity_score,
      cm.momentum,
      cm.last_sale_price,
      p.full_name as player_name
    FROM cards c
    JOIN vw_card_metrics_current cm ON c.id = cm.card_id
    LEFT JOIN players p ON c.player_id = p.id
    WHERE c.card_fingerprint_hash IS NOT NULL
      AND cm.liquidity_score >= $1
      AND NOT EXISTS (
        SELECT 1 FROM market_index_constituents mic
        WHERE mic.index_id = $2
          AND mic.card_id = c.id
          AND mic.exit_date IS NULL
      )
    ORDER BY cm.liquidity_score DESC, cm.momentum DESC
    LIMIT $3
  `;
  
  const cardsResult = await client.query(qualifyingQuery, [
    minLiquidity,
    index.index_id,
    maxCards
  ]);
  
  if (cardsResult.rows.length === 0) {
    console.log('  ℹ️  No qualifying cards found');
    return;
  }
  
  console.log(`  Found ${cardsResult.rows.length} qualifying cards`);
  
  // Calculate equal weights
  const weight = 1.0 / cardsResult.rows.length;
  const today = new Date().toISOString().split('T')[0];
  
  // Insert constituents
  let added = 0;
  for (const card of cardsResult.rows) {
    await client.query(`
      INSERT INTO market_index_constituents (
        index_id, card_id, card_fingerprint_hash, 
        weight, entry_date, entry_reason
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (index_id, card_id, entry_date) DO NOTHING
    `, [
      index.index_id,
      card.card_id,
      card.card_fingerprint_hash,
      weight,
      today,
      'liquidity_threshold_met'
    ]);
    added++;
  }
  
  console.log(`  ✅ Added ${added} cards with ${(weight * 100).toFixed(2)}% weight each`);
  
  // Show sample
  console.log('\n  Sample additions:');
  cardsResult.rows.slice(0, 3).forEach(c => {
    console.log(`    • ${c.player_name || c.card_id}: liquidity ${(c.liquidity_score * 100).toFixed(0)}%`);
  });
}

// Compute index values for a date range
async function computeIndexValues(client, indexCode, startDate, endDate) {
  console.log(`\n📈 Computing index values for ${indexCode}...`);
  console.log(`   Date range: ${startDate} to ${endDate}`);
  
  // Get index
  const indexResult = await client.query(
    'SELECT * FROM market_indices WHERE index_code = $1',
    [indexCode]
  );
  
  if (indexResult.rows.length === 0) {
    console.error(`❌ Index ${indexCode} not found`);
    return;
  }
  
  const index = indexResult.rows[0];
  
  // Get active constituents for each date in range
  const datesResult = await client.query(`
    SELECT DISTINCT date 
    FROM card_daily_snapshots 
    WHERE date BETWEEN $1 AND $2
    ORDER BY date
  `, [startDate, endDate]);
  
  console.log(`   Processing ${datesResult.rows.length} dates...`);
  
  let computed = 0;
  let previousValue = 1000; // Base value
  
  for (const dateRow of datesResult.rows) {
    const date = dateRow.date.toISOString().split('T')[0];
    
    // Get constituents active on this date
    const constituentsResult = await client.query(`
      SELECT 
        mic.card_id,
        mic.weight,
        cds.loose_price,
        cds.sales_volume
      FROM market_index_constituents mic
      JOIN card_daily_snapshots cds 
        ON mic.card_id = cds.card_id
        AND cds.date = $1
      WHERE mic.index_id = $2
        AND mic.entry_date <= $1
        AND (mic.exit_date IS NULL OR mic.exit_date > $1)
    `, [date, index.index_id]);
    
    if (constituentsResult.rows.length === 0) {
      continue; // Skip dates with no data
    }
    
    // Calculate weighted index value
    let weightedValue = 0;
    let totalMarketCap = 0;
    
    for (const c of constituentsResult.rows) {
      const marketCap = (c.loose_price || 0) * (c.sales_volume || 0);
      weightedValue += (c.loose_price || 0) * c.weight;
      totalMarketCap += marketCap;
    }
    
    // Normalize to base 1000
    const indexValue = weightedValue > 0 ? 
      (weightedValue / constituentsResult.rows.length) * 100 : 0;
    
    const change = indexValue - previousValue;
    const changePct = previousValue > 0 ? (change / previousValue) * 100 : 0;
    
    // Insert index value
    await client.query(`
      INSERT INTO market_index_values (
        index_id, date, index_value, index_value_change, index_value_change_pct,
        constituent_count, avg_constituent_price, total_market_cap
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (index_id, date) DO UPDATE SET
        index_value = EXCLUDED.index_value,
        index_value_change = EXCLUDED.index_value_change,
        index_value_change_pct = EXCLUDED.index_value_change_pct,
        constituent_count = EXCLUDED.constituent_count,
        avg_constituent_price = EXCLUDED.avg_constituent_price,
        total_market_cap = EXCLUDED.total_market_cap,
        computed_at = CURRENT_TIMESTAMP
    `, [
      index.index_id,
      date,
      indexValue,
      change,
      changePct,
      constituentsResult.rows.length,
      weightedValue / constituentsResult.rows.length,
      totalMarketCap
    ]);
    
    previousValue = indexValue;
    computed++;
  }
  
  console.log(`   ✅ Computed ${computed} index values`);
  
  // Update index last rebalanced
  await client.query(
    'UPDATE market_indices SET last_rebalanced = $1 WHERE index_id = $2',
    [endDate, index.index_id]
  );
}

// Main CLI handler
(async () => {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const client = await pool.connect();
  
  try {
    switch (command) {
      case 'list':
        await listIndices(client);
        break;
        
      case 'add-cards':
        const indexCode = args[1];
        if (!indexCode) {
          console.error('❌ Usage: node manage-indices.js add-cards <index_code>');
          process.exit(1);
        }
        await addCardsToIndex(client, indexCode);
        break;
        
      case 'compute':
        const computeCode = args[1];
        const startDate = args[2] || '2026-01-01';
        const endDate = args[3] || new Date().toISOString().split('T')[0];
        
        if (!computeCode) {
          console.error('❌ Usage: node manage-indices.js compute <index_code> [start_date] [end_date]');
          process.exit(1);
        }
        await computeIndexValues(client, computeCode, startDate, endDate);
        break;
        
      default:
        console.log('📚 Market Index Management');
        console.log('');
        console.log('Commands:');
        console.log('  list                    Show all indices');
        console.log('  add-cards <code>        Add qualifying cards to index');
        console.log('  compute <code> [start] [end]  Compute index values');
        console.log('');
        console.log('Examples:');
        console.log('  node manage-indices.js list');
        console.log('  node manage-indices.js add-cards NBA-MODERN-001');
        console.log('  node manage-indices.js compute NBA-MODERN-001 2026-01-01 2026-01-31');
    }
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
