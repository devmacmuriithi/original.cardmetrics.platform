# Page-Script Mapping Documentation

This document provides a clear mapping between HTML pages and their corresponding JavaScript files.

## Main Dashboard
- **Page**: `index.html`
- **Script**: `js/dashboard.js`
- **Route**: `/`
- **Purpose**: Main landing page with KPIs, charts, and summary tables

## Market Intelligence Section

### Intelligence Dashboard
- **Page**: `intelligence-dashboard.html`
- **Script**: `js/intelligence-dashboard.js`
- **Route**: `/intelligence-dashboard`
- **Purpose**: Comprehensive analytics dashboard with 8 KPIs and 11 charts

### Investment Opportunities
- **Page**: `opportunities.html`
- **Script**: `js/opportunities.js`
- **Route**: `/opportunities`
- **Purpose**: Investment opportunities with filtering by score, type, and risk

### Grading Intelligence
- **Page**: `grading.html`
- **Script**: `js/grading.js`
- **Route**: `/grading`
- **Purpose**: Grading analysis with EV calculations and difficulty ratings

### Market Efficiency
- **Page**: `market-efficiency.html`
- **Script**: `js/market-efficiency.js`
- **Route**: `/market-efficiency`
- **Purpose**: Price efficiency analysis vs expected premiums

### Player Profiles
- **Page**: `player-profiles.html`
- **Script**: `js/player-profiles.js`
- **Route**: `/player-profiles`
- **Purpose**: Player-level grading statistics and profiles

### Opportunity Alerts
- **Page**: `alerts.html`
- **Script**: `js/alerts.js`
- **Route**: `/alerts`
- **Purpose**: Real-time opportunity signals and alerts

## Cards Section

### All Cards
- **Page**: `cards.html`
- **Script**: `js/cards.js`
- **Route**: `/cards`
- **Purpose**: Browse and search all cards in database

### Top Movers
- **Page**: `top-movers.html`
- **Script**: `js/top-movers.js`
- **Route**: `/cards/top-movers`
- **Purpose**: Cards with biggest price changes, filterable and sortable

## Sets Section

### All Sets
- **Page**: `sets.html`
- **Script**: `js/sets.js`
- **Route**: `/sets`
- **Purpose**: Browse and analyze all card sets

### Top Sets by Volume
- **Page**: `top-sets.html`
- **Script**: `js/top-sets.js`
- **Route**: `/sets/top-volume`
- **Purpose**: Sets with highest trading volume, filterable and sortable

## Legacy/Deprecated Files

### Old Intelligence Page (DO NOT USE)
- **Page**: `intelligence.html`
- **Script**: `js/intelligence.js`
- **Status**: DEPRECATED - Replaced by individual Market Intelligence pages
- **Note**: This was the old tabbed interface, now split into separate pages

## Naming Convention

All files follow this pattern:
- **HTML**: `{page-name}.html` (kebab-case)
- **JavaScript**: `js/{page-name}.js` (kebab-case, same as HTML)
- **Route**: `/{page-name}` or `/{section}/{page-name}`

## API Endpoints Used

### Dashboard APIs
- `/api/dashboard` - Main dashboard data (used by `dashboard.js`)
- `/api/intelligence/dashboard` - Intelligence dashboard data (used by `intelligence-dashboard.js`)

### Market Intelligence APIs
- `/api/intelligence/opportunities` - Investment opportunities (used by `opportunities.js`)
- `/api/intelligence/grading` - Grading intelligence (used by `grading.js`)
- `/api/intelligence/market-efficiency` - Market efficiency (used by `market-efficiency.js`)
- `/api/intelligence/player-profiles` - Player profiles (used by `player-profiles.js`)
- `/api/intelligence/alerts` - Opportunity alerts (used by `alerts.js`)

### Cards APIs
- `/api/cards` - All cards (used by `cards.js`)
- `/api/cards/top-movers` - Top movers (used by `top-movers.js`)

### Sets APIs
- `/api/sets` - All sets (used by `sets.js`)
- `/api/dashboard` - Top sets data (used by `top-sets.js`)

## Verification Checklist

When adding a new page:
1. ✅ Create HTML file with descriptive name
2. ✅ Create matching JS file in `js/` folder with same name
3. ✅ Reference correct script in HTML: `<script src="/js/{page-name}.js"></script>`
4. ✅ Add route in `server.js`
5. ✅ Update this mapping document
6. ✅ Update sidebar navigation in all relevant pages
7. ✅ Ensure API endpoint exists and is documented

## Common Issues to Avoid

❌ **Don't**: Use generic script names like `app.js` for specific pages
✅ **Do**: Use descriptive names matching the page

❌ **Don't**: Share scripts between multiple pages
✅ **Do**: Create dedicated scripts for each page

❌ **Don't**: Mix page logic in shared utility files
✅ **Do**: Keep page-specific logic in page-specific scripts

❌ **Don't**: Forget to update this mapping when adding pages
✅ **Do**: Always document new pages here
