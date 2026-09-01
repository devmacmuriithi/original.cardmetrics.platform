/**
 * compute-price-analysis.js - Analyze price data quality in card_daily_snapshots
 * 
 * Reports null vs non-null counts for each price field
 * Usage: node scripts/compute/compute-price-analysis.js [--sport=basketball]
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 10
});

async function analyzePriceData() {
  const client = await pool.connect();
  
  const args = process.argv.slice(2);
  const sportArg = args.find(arg => arg.startsWith('--sport='));
  const sport = sportArg ? sportArg.split('=')[1] : null;
  
  try {
    console.log('\n========================================');
    console.log('Price Data Quality Analysis');
    console.log('========================================');
    if (sport) {
      console.log(`Sport filter: ${sport}`);
    }
    console.log('');
    
    // Overall stats
    const totalResult = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT date) as dates,
        COUNT(DISTINCT card_id) as unique_cards,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM card_daily_snapshots s
      ${sport ? 'JOIN cards c ON s.card_id = c.id JOIN sets st ON c.set_id = st.id' : ''}
      WHERE 1=1 ${sport ? `AND st.sport = '${sport}'` : ''}
    `);
    
    const stats = totalResult.rows[0];
    console.log('📊 OVERALL STATISTICS');
    console.log('─────────────────────────────────');
    console.log(`Total records:     ${parseInt(stats.total_records).toLocaleString()}`);
    console.log(`Unique cards:      ${parseInt(stats.unique_cards).toLocaleString()}`);
    console.log(`Date range:        ${stats.earliest_date} to ${stats.latest_date}`);
    console.log(`Number of dates:   ${stats.dates}`);
    console.log('');
    
    // Price field analysis
    const priceFields = [
      { name: 'loose_price', label: 'Loose Price' },
      { name: 'graded_price', label: 'Graded Price' },
      { name: 'psa10_price', label: 'PSA 10 Price' },
      { name: 'bgs10_price', label: 'BGS 10 Price' },
      { name: 'retail_loose_buy', label: 'Retail Loose Buy' },
      { name: 'retail_loose_sell', label: 'Retail Loose Sell' },
      { name: 'sales_volume', label: 'Sales Volume' }
    ];
    
    console.log('💰 PRICE FIELD ANALYSIS');
    console.log('─────────────────────────────────────────────────────────');
    console.log('Field                Has Data    NULL        % Populated');
    console.log('─────────────────────────────────────────────────────────');
    
    for (const field of priceFields) {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(${field.name}) as has_data,
          COUNT(*) - COUNT(${field.name}) as is_null
        FROM card_daily_snapshots s
        ${sport ? 'JOIN cards c ON s.card_id = c.id JOIN sets st ON c.set_id = st.id' : ''}
        WHERE 1=1 ${sport ? `AND st.sport = '${sport}'` : ''}
      `);
      
      const row = result.rows[0];
      const total = parseInt(row.total);
      const hasData = parseInt(row.has_data);
      const isNull = parseInt(row.is_null);
      const pct = total > 0 ? ((hasData / total) * 100).toFixed(1) : '0.0';
      
      const label = field.label.padEnd(20);
      const hasDataStr = hasData.toLocaleString().padStart(10);
      const isNullStr = isNull.toLocaleString().padStart(10);
      const pctStr = pct.padStart(12);
      
      console.log(`${label}${hasDataStr}${isNullStr}${pctStr}%`);
    }
    
    // Records with NO price data at all
    const noPriceResult = await client.query(`
      SELECT COUNT(*) as count
      FROM card_daily_snapshots s
      ${sport ? 'JOIN cards c ON s.card_id = c.id JOIN sets st ON c.set_id = st.id' : ''}
      WHERE loose_price IS NULL 
        AND graded_price IS NULL 
        AND psa10_price IS NULL 
        AND bgs10_price IS NULL
        AND retail_loose_buy IS NULL
        AND retail_loose_sell IS NULL
        ${sport ? `AND st.sport = '${sport}'` : ''}
    `);
    
    const noPriceCount = parseInt(noPriceResult.rows[0].count);
    const totalRecords = parseInt(stats.total_records);
    const noPricePct = totalRecords > 0 ? ((noPriceCount / totalRecords) * 100).toFixed(1) : '0.0';
    
    console.log('');
    console.log('⚠️  DATA QUALITY ISSUES');
    console.log('─────────────────────────────────');
    console.log(`Records with NO prices at all: ${noPriceCount.toLocaleString()} (${noPricePct}%)`);
    console.log('');
    
    // Per-date breakdown (last 10 dates)
    const dateResult = await client.query(`
      SELECT 
        s.date,
        COUNT(*) as total_records,
        COUNT(s.loose_price) as has_loose_price,
        COUNT(s.graded_price) as has_graded_price,
        COUNT(s.psa10_price) as has_psa10_price,
        COUNT(s.bgs10_price) as has_bgs10_price,
        COUNT(s.retail_loose_buy) as has_retail_loose_buy,
        COUNT(s.retail_loose_sell) as has_retail_loose_sell,
        SUM(s.sales_volume) as total_sales_volume
      FROM card_daily_snapshots s
      ${sport ? 'JOIN cards c ON s.card_id = c.id JOIN sets st ON c.set_id = st.id' : ''}
      WHERE 1=1 ${sport ? `AND st.sport = '${sport}'` : ''}
      GROUP BY s.date
      ORDER BY s.date DESC
      LIMIT 10
    `);
    
    console.log('📅 PER-DATE BREAKDOWN (last 10 dates)');
    console.log('─────────────────────────────────────────────────────────');
    console.log('Date       Records  Loose% Graded% PSA10%  BGS10%  RetailBuy% RetailSell% SalesVol');
    console.log('─────────────────────────────────────────────────────────');
    
    for (const row of dateResult.rows) {
      const total = parseInt(row.total_records);
      const loose = parseInt(row.has_loose_price);
      const graded = parseInt(row.has_graded_price);
      const psa10 = parseInt(row.has_psa10_price);
      const bgs10 = parseInt(row.has_bgs10_price);
      const retailBuy = parseInt(row.has_retail_loose_buy);
      const retailSell = parseInt(row.has_retail_loose_sell);
      const salesVol = parseInt(row.total_sales_volume);
      
      const loosePct = total > 0 ? ((loose / total) * 100).toFixed(1) : '0.0';
      const gradedPct = total > 0 ? ((graded / total) * 100).toFixed(1) : '0.0';
      const psa10Pct = total > 0 ? ((psa10 / total) * 100).toFixed(1) : '0.0';
      const bgs10Pct = total > 0 ? ((bgs10 / total) * 100).toFixed(1) : '0.0';
      const retailBuyPct = total > 0 ? ((retailBuy / total) * 100).toFixed(1) : '0.0';
      const retailSellPct = total > 0 ? ((retailSell / total) * 100).toFixed(1) : '0.0';
      
      const dateStr = row.date.toISOString().split('T')[0];
      
      console.log(`${dateStr} ${total.toLocaleString().padStart(7)} ${loosePct.padStart(6)}% ${gradedPct.padStart(6)}% ${psa10Pct.padStart(6)}% ${bgs10Pct.padStart(6)}% ${retailBuyPct.padStart(9)}% ${retailSellPct.padStart(10)}% ${salesVol.toLocaleString().padStart(8)}`);
    }
    
    console.log('');
    console.log('========================================');
    console.log('✅ Analysis complete!');
    console.log('========================================');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

analyzePriceData().catch(() => process.exit(1));
