require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const table = process.argv[2] || 'card_computed_metrics';
pool.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = $1
  ORDER BY ordinal_position
`, [table]).then(r => {
  console.log(`\nColumns in ${table} (${r.rows.length} total):\n`);
  for (const row of r.rows) {
    console.log(`  ${row.column_name.padEnd(40)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  }
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
