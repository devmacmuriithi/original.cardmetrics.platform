# Navigation Menu Audit & Synchronization Report

## Complete Menu Structure (from cards.html - REFERENCE)

### Dashboard
- Dashboard (/)

### Market Intelligence
1. Investment Opportunities (/opportunities)
2. Grading Intelligence (/grading)
3. Market Efficiency (/market-efficiency)
4. Player Profiles (/player-profiles)
5. Opportunity Alerts (/alerts)
6. Intelligence Dashboard (/intelligence-dashboard)

### Cards
1. All Cards (/cards)
2. Top Movers (/cards/top-movers)
3. Volatility Analysis (/cards/volatility)
4. Grading Premium (/cards/premium)

### Sets
1. All Sets (/sets)
2. Performance (/sets/performance)
3. Liquidity (/sets/liquidity)

---

## Page-by-Page Audit

### ✅ COMPLETE MENUS (All 4 sections)
1. **cards.html** - ✅ Has all sections
2. **sets.html** - ✅ Has all sections
3. **index.html** - ✅ Has all sections

### ⚠️ INCOMPLETE MENUS (Missing Cards/Sets subsections)

4. **grading.html** - ❌ Missing Cards subsections (Top Movers, Volatility, Grading Premium)
5. **opportunities.html** - ❌ Missing Cards subsections
6. **market-efficiency.html** - ❌ Missing Cards subsections
7. **player-profiles.html** - ❌ Need to check
8. **alerts.html** - ❌ Need to check
9. **intelligence-dashboard.html** - ❌ Need to check
10. **intelligence.html** - ❌ Need to check
11. **top-movers.html** - ❌ Need to check
12. **top-sets.html** - ❌ Need to check

---

## Standardized Menu Template

All pages should have this exact structure:

```html
<nav class="space-y-2">
    <!-- Dashboard -->
    <a href="/" class="sidebar-link block px-4 py-3 rounded-lg hover:bg-gray-800 flex items-center space-x-3">
        <i class="fas fa-tachometer-alt w-5"></i>
        <span>Dashboard</span>
    </a>
    
    <!-- Market Intelligence Section -->
    <div class="pt-4">
        <h3 class="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider">Market Intelligence</h3>
        <div class="mt-2 space-y-1">
            <a href="/opportunities" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-bullseye w-5 text-yellow-400"></i>
                <span>Investment Opportunities</span>
            </a>
            <a href="/grading" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-certificate w-5 text-green-400"></i>
                <span>Grading Intelligence</span>
            </a>
            <a href="/market-efficiency" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-balance-scale w-5 text-purple-400"></i>
                <span>Market Efficiency</span>
            </a>
            <a href="/player-profiles" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-user-chart w-5 text-blue-400"></i>
                <span>Player Profiles</span>
            </a>
            <a href="/alerts" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-bell w-5 text-red-400"></i>
                <span>Opportunity Alerts</span>
            </a>
            <a href="/intelligence-dashboard" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-chart-pie w-5 text-cyan-400"></i>
                <span>Intelligence Dashboard</span>
            </a>
        </div>
    </div>
    
    <!-- Cards Section -->
    <div class="pt-4">
        <h3 class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cards</h3>
        <div class="mt-2 space-y-1">
            <a href="/cards" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-th-large w-5"></i>
                <span>All Cards</span>
            </a>
            <a href="/cards/top-movers" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-fire w-5"></i>
                <span>Top Movers</span>
            </a>
            <a href="/cards/volatility" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-chart-area w-5"></i>
                <span>Volatility Analysis</span>
            </a>
            <a href="/cards/premium" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-gem w-5"></i>
                <span>Grading Premium</span>
            </a>
        </div>
    </div>
    
    <!-- Sets Section -->
    <div class="pt-4">
        <h3 class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sets</h3>
        <div class="mt-2 space-y-1">
            <a href="/sets" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-layer-group w-5"></i>
                <span>All Sets</span>
            </a>
            <a href="/sets/performance" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-chart-bar w-5"></i>
                <span>Performance</span>
            </a>
            <a href="/sets/liquidity" class="sidebar-link block px-4 py-2 rounded hover:bg-gray-800 flex items-center space-x-3">
                <i class="fas fa-water w-5"></i>
                <span>Liquidity</span>
            </a>
        </div>
    </div>
</nav>
```

---

## Active State Logic

Each page should highlight its active menu item with `bg-gray-800` class:
- Dashboard page: Dashboard link gets `bg-gray-800`
- Grading page: Grading Intelligence link gets `bg-gray-800`
- Cards page: All Cards link gets `bg-gray-800`
- Top Movers page: Top Movers link gets `bg-gray-800`
- etc.

---

## Fix Status

| Page | Current Menu | Needs Fix | Status |
|------|-------------|-----------|--------|
| index.html | Complete | No | ✅ |
| cards.html | Complete | No | ✅ |
| sets.html | Complete | No | ✅ |
| grading.html | Missing Cards subsections | Yes | 🔧 Fixing |
| opportunities.html | Missing Cards subsections | Yes | 🔧 Fixing |
| market-efficiency.html | Missing Cards subsections | Yes | 🔧 Fixing |
| player-profiles.html | TBD | Yes | 🔧 Fixing |
| alerts.html | TBD | Yes | 🔧 Fixing |
| intelligence-dashboard.html | TBD | Yes | 🔧 Fixing |
| intelligence.html | TBD | Yes | 🔧 Fixing |
| top-movers.html | TBD | Yes | 🔧 Fixing |
| top-sets.html | TBD | Yes | 🔧 Fixing |
