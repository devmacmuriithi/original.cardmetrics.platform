require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS card_sales (
  id SERIAL PRIMARY KEY,
  card_id BIGINT,
  sale_date DATE,
  sale_price NUMERIC(12,2),
  currency TEXT,
  platform TEXT,
  platform_listing_id TEXT,
  platform_url TEXT,
  listing_type TEXT,
  condition TEXT,
  seller_rating NUMERIC(5,2),
  seller_location TEXT,
  quantity INTEGER,
  shipping_cost NUMERIC(12,2),
  listing_title TEXT,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified BOOLEAN DEFAULT false,
  data_source TEXT
);

CREATE INDEX IF NOT EXISTS idx_card_sales_imported_at ON card_sales(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_sales_platform ON card_sales(platform);
`;

const platforms = ['eBay', 'Goldin', 'PWCC', 'MySlabs'];
const listingTypes = ['Auction', 'BIN'];
const conditions = ['PSA 10', 'PSA 9', 'Raw', 'BGS 9.5', 'SGC 10'];
const titles = [
  '2020 Prizm LeBron James #1 PSA 10',
  '2018 Topps Shohei Ohtani Rookie PSA 9',
  '2003 Upper Deck LeBron Rookie Raw',
  '2019 Prizm Zion Williamson PSA 10',
  '2017 Optic Patrick Mahomes PSA 10',
  '2021 Select LaMelo Ball PSA 9',
  '1996 Topps Chrome Kobe Bryant PSA 9',
  '2022 Bowman Chrome Elly De La Cruz PSA 10',
  '2015 Panini Curry PSA 10',
  '2020 Mosaic Giannis PSA 9'
];

function buildSampleRows(count = 25) {
  const rows = [];
  const now = new Date();

  for (let i = 0; i < count; i += 1) {
    const platform = platforms[i % platforms.length];
    const listingType = listingTypes[i % listingTypes.length];
    const condition = conditions[i % conditions.length];
    const title = titles[i % titles.length];
    const salePrice = (35 + (i * 7.25)) % 450 + 20;
    const shippingCost = (i % 3) * 4.99;
    const saleDate = new Date(now.getTime() - i * 86400000);
    const importedAt = new Date(now.getTime() - i * 3600000);
    const listingId = `${platform.toLowerCase()}-${100000 + i}`;

    rows.push({
      card_id: 1000 + i,
      sale_date: saleDate.toISOString().slice(0, 10),
      sale_price: salePrice.toFixed(2),
      currency: 'USD',
      platform,
      platform_listing_id: listingId,
      platform_url: `https://example.com/listing/${listingId}`,
      listing_type: listingType,
      condition,
      seller_rating: (4.2 + (i % 5) * 0.15).toFixed(2),
      seller_location: i % 2 === 0 ? 'United States' : 'Canada',
      quantity: (i % 3) + 1,
      shipping_cost: shippingCost.toFixed(2),
      listing_title: title,
      imported_at: importedAt.toISOString(),
      verified: i % 2 === 0,
      data_source: 'sample_seed'
    });
  }

  return rows;
}

async function main() {
  const shouldTruncate = process.argv.includes('--truncate');
  const client = await pool.connect();

  try {
    await client.query(CREATE_TABLE_SQL);

    if (shouldTruncate) {
      await client.query('TRUNCATE card_sales RESTART IDENTITY');
      console.log('⚠️  card_sales truncated');
    }

    const rows = buildSampleRows(30);
    const values = [];
    const placeholders = rows.map((row, index) => {
      const offset = index * 17;
      values.push(
        row.card_id,
        row.sale_date,
        row.sale_price,
        row.currency,
        row.platform,
        row.platform_listing_id,
        row.platform_url,
        row.listing_type,
        row.condition,
        row.seller_rating,
        row.seller_location,
        row.quantity,
        row.shipping_cost,
        row.listing_title,
        row.imported_at,
        row.verified,
        row.data_source
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17})`;
    });

    await client.query(
      `INSERT INTO card_sales (
        card_id,
        sale_date,
        sale_price,
        currency,
        platform,
        platform_listing_id,
        platform_url,
        listing_type,
        condition,
        seller_rating,
        seller_location,
        quantity,
        shipping_cost,
        listing_title,
        imported_at,
        verified,
        data_source
      ) VALUES ${placeholders.join(', ')}`,
      values
    );

    const { rows: countRows } = await client.query('SELECT COUNT(*) FROM card_sales');
    console.log(`✅ Seeded card_sales with ${rows.length} rows (total: ${countRows[0].count}).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
