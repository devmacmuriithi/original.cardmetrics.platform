const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const consoleUids = process.argv.slice(2);

if (consoleUids.length === 0) {
  console.log('Usage: node scripts/check-console-uids.js <UID1> <UID2> ...');
  console.log('Example: node scripts/check-console-uids.js G68642 G89762 G78842');
  process.exit(1);
}

async function checkUids() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('Checking Console UIDs');
    console.log('========================================\n');
    
    for (const uid of consoleUids) {
      // Check if set exists
      const setResult = await client.query(
        'SELECT id, name, year, csv_path FROM sets WHERE console_uid = $1',
        [uid]
      );
      
      if (setResult.rows.length === 0) {
        console.log(`${uid}: ❌ NOT FOUND in sets table`);
        continue;
      }
      
      const set = setResult.rows[0];
      
      // Check if cards exist for this set
      const cardResult = await client.query(
        'SELECT COUNT(*) as count FROM cards WHERE set_id = $1',
        [set.id]
      );
      
      const cardCount = parseInt(cardResult.rows[0].count);
      
      // Check import status
      const importResult = await client.query(
        `SELECT date, status, imported_records 
         FROM sets_ingestion_stats 
         WHERE console_uid = $1 
         ORDER BY date DESC 
         LIMIT 5`,
        [uid]
      );
      
      console.log(`${uid}:`);
      console.log(`  Set: ${set.name} (${set.year || 'N/A'})`);
      console.log(`  CSV: ${set.csv_path || 'N/A'}`);
      console.log(`  Cards in DB: ${cardCount > 0 ? '✅ ' + cardCount : '⚠️  0'}`);
      
      if (importResult.rows.length > 0) {
        console.log('  Recent imports:');
        importResult.rows.forEach(row => {
          const status = row.status === 'completed' ? '✅' : 
                        row.status === 'pending' ? '⏳' : 
                        row.status === 'in_progress' ? '🔄' : 
                        row.status === 'failed' ? '❌' : '⏭️';
          console.log(`    ${row.date}: ${status} ${row.status} (${row.imported_records || 0} records)`);
        });
      } else {
        console.log('  Import status: ⏳ Not yet queued');
      }
      
      console.log('');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUids();
