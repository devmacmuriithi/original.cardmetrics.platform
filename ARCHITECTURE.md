# Application Architecture & File Organization

## Directory Structure

```
milestone2/
├── public/
│   ├── css/
│   │   └── styles.css                    # Global styles
│   ├── js/
│   │   ├── alerts.js                     # Opportunity Alerts page
│   │   ├── app.js                        # LEGACY - Shared utilities (consider refactoring)
│   │   ├── cards.js                      # All Cards page
│   │   ├── dashboard.js                  # Main Dashboard page
│   │   ├── grading.js                    # Grading Intelligence page
│   │   ├── intelligence-dashboard.js     # Intelligence Dashboard page
│   │   ├── intelligence.js               # DEPRECATED - Old tabbed interface
│   │   ├── market-efficiency.js          # Market Efficiency page
│   │   ├── opportunities.js              # Investment Opportunities page
│   │   ├── player-profiles.js            # Player Profiles page
│   │   ├── sets.js                       # All Sets page
│   │   ├── top-movers.js                 # Top Movers page
│   │   └── top-sets.js                   # Top Sets by Volume page
│   ├── alerts.html                       # Opportunity Alerts
│   ├── cards.html                        # All Cards
│   ├── grading.html                      # Grading Intelligence
│   ├── index.html                        # Main Dashboard
│   ├── intelligence-dashboard.html       # Intelligence Dashboard
│   ├── intelligence.html                 # DEPRECATED - Old tabbed interface
│   ├── market-efficiency.html            # Market Efficiency
│   ├── opportunities.html                # Investment Opportunities
│   ├── player-profiles.html              # Player Profiles
│   ├── sets.html                         # All Sets
│   ├── top-movers.html                   # Top Movers
│   └── top-sets.html                     # Top Sets by Volume
├── db/
│   └── schemas/
│       ├── 21-matched-cards-final.sql    # Matched cards table
│       └── 22-market-intelligence-views.sql # Analytics views
├── server.js                              # Express server & API routes
├── PAGE_SCRIPT_MAPPING.md                 # Page-to-script reference
└── ARCHITECTURE.md                        # This file
```

## Page-Script Mapping (1:1 Relationship)

### ✅ Active Pages (Production)

| HTML Page | JavaScript File | Route | Purpose |
|-----------|----------------|-------|---------|
| `index.html` | `dashboard.js` | `/` | Main landing dashboard |
| `intelligence-dashboard.html` | `intelligence-dashboard.js` | `/intelligence-dashboard` | MI analytics dashboard |
| `opportunities.html` | `opportunities.js` | `/opportunities` | Investment opportunities |
| `grading.html` | `grading.js` | `/grading` | Grading intelligence |
| `market-efficiency.html` | `market-efficiency.js` | `/market-efficiency` | Market efficiency |
| `player-profiles.html` | `player-profiles.js` | `/player-profiles` | Player profiles |
| `alerts.html` | `alerts.js` | `/alerts` | Opportunity alerts |
| `cards.html` | `cards.js` | `/cards` | All cards browser |
| `top-movers.html` | `top-movers.js` | `/cards/top-movers` | Top price movers |
| `sets.html` | `sets.js` | `/sets` | All sets browser |
| `top-sets.html` | `top-sets.js` | `/sets/top-volume` | Top sets by volume |

### ⚠️ Legacy/Deprecated Files

| File | Status | Action Required |
|------|--------|-----------------|
| `intelligence.html` | DEPRECATED | Can be deleted - replaced by individual MI pages |
| `intelligence.js` | DEPRECATED | Can be deleted - replaced by individual MI scripts |
| `app.js` | LEGACY | Review for shared utilities, refactor if needed |

## Database Layer

### Tables
- `matched_cards_final` - Main data table (9,134 cards)

### Views (Market Intelligence)
- `vw_investment_opportunities` - Investment scoring & opportunities
- `vw_grading_intelligence` - Expected value calculations
- `vw_market_efficiency` - Price efficiency analysis
- `vw_player_grading_profiles` - Player-level statistics
- `vw_opportunity_alerts` - Real-time signals
- `vw_parallel_performance` - Parallel comparison

## API Endpoints

### Dashboard APIs
- `GET /api/dashboard` - Main dashboard metrics & data
- `GET /api/intelligence/dashboard` - Intelligence dashboard with KPIs & charts

### Market Intelligence APIs
- `GET /api/intelligence/opportunities` - Investment opportunities
- `GET /api/intelligence/grading` - Grading intelligence
- `GET /api/intelligence/market-efficiency` - Market efficiency
- `GET /api/intelligence/player-profiles` - Player profiles
- `GET /api/intelligence/alerts` - Opportunity alerts
- `GET /api/intelligence/stats` - Intelligence statistics

### Cards APIs
- `GET /api/cards` - All cards with pagination
- `GET /api/cards/top-movers` - Top price movers
- `GET /api/cards/:id` - Single card details

### Sets APIs
- `GET /api/sets` - All sets with pagination
- `GET /api/sets/:id` - Single set details

## Design Principles

### 1. One Page, One Script
Each HTML page has exactly one dedicated JavaScript file with matching name:
- ✅ `opportunities.html` → `js/opportunities.js`
- ❌ Multiple pages sharing one script
- ❌ One page using multiple scripts (except libraries)

### 2. Clear Naming Convention
- HTML files: `{feature-name}.html` (kebab-case)
- JS files: `js/{feature-name}.js` (same name as HTML)
- Routes: `/{feature-name}` or `/{section}/{feature-name}`

### 3. Script Responsibilities
Each page script handles:
- Data fetching from API
- Client-side filtering & sorting
- Table/chart rendering
- User interactions (search, filters, buttons)
- Error handling

### 4. No Cross-Page Dependencies
- Scripts don't reference other page scripts
- Shared utilities should go in separate utility files
- Each script is self-contained

## Navigation Structure

```
Dashboard (/)
├── Market Intelligence
│   ├── Investment Opportunities (/opportunities)
│   ├── Grading Intelligence (/grading)
│   ├── Market Efficiency (/market-efficiency)
│   ├── Player Profiles (/player-profiles)
│   ├── Opportunity Alerts (/alerts)
│   └── Intelligence Dashboard (/intelligence-dashboard)
├── Cards
│   ├── All Cards (/cards)
│   └── Top Movers (/cards/top-movers)
└── Sets
    ├── All Sets (/sets)
    └── Top by Volume (/sets/top-volume)
```

## Common Patterns

### Page Structure
```html
<!DOCTYPE html>
<html>
<head>
    <title>{Page Title}</title>
    <!-- CSS libraries -->
    <link href="tailwindcss" rel="stylesheet">
    <link href="font-awesome" rel="stylesheet">
    <link href="/css/styles.css" rel="stylesheet">
</head>
<body>
    <div class="flex h-screen">
        <aside><!-- Sidebar --></aside>
        <main><!-- Content --></main>
    </div>
    <script src="/js/{page-name}.js"></script>
</body>
</html>
```

### Script Structure
```javascript
// Global state
let allData = [];
let filteredData = [];

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// Data loading
async function loadData() {
    // Fetch from API
    // Store in allData
    // Render initial view
}

// Filtering
function applyFilters() {
    // Filter allData → filteredData
    // Re-render
}

// Rendering
function renderTable() {
    // Build HTML from filteredData
    // Update DOM
}

// Sorting
function sortBy(column) {
    // Sort filteredData
    // Re-render
}
```

## Maintenance Guidelines

### Adding a New Page
1. Create `{page-name}.html` in `/public`
2. Create `js/{page-name}.js` in `/public/js`
3. Add route in `server.js`
4. Update sidebar navigation in all pages
5. Update `PAGE_SCRIPT_MAPPING.md`
6. Update this `ARCHITECTURE.md`

### Removing a Page
1. Delete HTML file
2. Delete JS file
3. Remove route from `server.js`
4. Remove from sidebar navigation
5. Update documentation

### Refactoring Shared Code
If you find duplicate code across multiple scripts:
1. Create a utility file (e.g., `js/utils.js`)
2. Extract common functions
3. Include utility script before page script
4. Document the utility file

## File Size Reference
- Small scripts: < 10KB (alerts, grading, market-efficiency, etc.)
- Medium scripts: 10-20KB (dashboard, intelligence-dashboard, etc.)
- Large scripts: > 20KB (cards, intelligence [deprecated], app [legacy])

## Next Steps for Cleanup
1. ✅ All pages have dedicated scripts
2. ⚠️ Review `app.js` for shared utilities
3. ⚠️ Consider deleting deprecated `intelligence.html` and `intelligence.js`
4. ⚠️ Extract common patterns into utility functions if needed
5. ✅ All pages follow consistent naming convention
