const fs = require('fs');
const path = require('path');

// Page ID mappings
const pageIds = {
  'index.html': 'dashboard',
  'sale-feed.html': 'sale-feed',
  'opportunities.html': 'opportunities',
  'grading.html': 'grading',
  'market-efficiency.html': 'market-efficiency',
  'player-profiles.html': 'player-profiles',
  'alerts.html': 'alerts',
  'intelligence-dashboard.html': 'intelligence-dashboard',
  'intelligence.html': 'intelligence',
  'sales-pulse.html': 'sales-pulse',
  'sales-platform-mix.html': 'sales-platform-mix',
  'sales-auction-vs-bin.html': 'sales-auction-vs-bin',
  'sales-condition-premiums.html': 'sales-condition-premiums',
  'sales-liquidity.html': 'sales-liquidity',
  'sales-seller-quality.html': 'sales-seller-quality',
  'sales-shipping-impact.html': 'sales-shipping-impact',
  'indices-player.html': 'indices-player',
  'indices-grade.html': 'indices-grade',
  'indices-market.html': 'indices-market',
  'cards.html': 'cards',
  'sets.html': 'sets',
  'top-movers.html': 'cards-top-movers',
  'top-sets.html': 'sets-performance'
};

const publicDir = path.join(__dirname, 'public');

function migratePage(filename) {
  const filepath = path.join(publicDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  Skipping ${filename} - file not found`);
    return;
  }

  let content = fs.readFileSync(filepath, 'utf8');
  const pageId = pageIds[filename];
  
  if (!pageId) {
    console.log(`⚠️  Skipping ${filename} - no page ID mapping`);
    return;
  }

  // Step 1: Add data-page attribute to body tag if not present
  if (!content.includes('data-page=')) {
    content = content.replace(
      /<body([^>]*class="[^"]*")([^>]*)>/,
      `<body$1 data-page="${pageId}"$2>`
    );
  }

  // Step 2: Remove sidebar content between <aside> and </aside>, keeping the aside element
  const asideRegex = /(<aside[^>]*>)([\s\S]*?)(<\/aside>)/;
  if (asideRegex.test(content)) {
    content = content.replace(asideRegex, '$1\n            <!-- Sidebar auto-populated by sidebar-nav.js -->\n        $3');
  }

  // Step 3: Add sidebar-nav.js script if not present
  if (!content.includes('sidebar-nav.js')) {
    content = content.replace(
      /(<\/body>)/,
      `    <script src="/js/sidebar-nav.js"></script>\n$1`
    );
  }

  // Write back
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`✅ Migrated ${filename} (page: ${pageId})`);
}

// Migrate all pages
console.log('🚀 Starting sidebar migration...\n');

Object.keys(pageIds).forEach(filename => {
  try {
    migratePage(filename);
  } catch (error) {
    console.error(`❌ Error migrating ${filename}:`, error.message);
  }
});

console.log('\n✨ Migration complete!');
