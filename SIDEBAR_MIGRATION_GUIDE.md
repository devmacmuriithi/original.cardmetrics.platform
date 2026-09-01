# Centralized Sidebar Navigation Migration Guide

## Overview
The sidebar navigation has been centralized into `/public/js/sidebar-nav.js` to ensure consistency across all pages.

## How to Use

### 1. Add the script to your HTML page
Add this script tag before your closing `</body>` tag (before other page-specific scripts):

```html
<script src="/js/sidebar-nav.js"></script>
```

### 2. Add data-page attribute to body tag
Add a `data-page` attribute to your `<body>` tag to highlight the active page:

```html
<body class="bg-gray-50" data-page="indices-set">
```

### 3. Keep the aside element structure
Keep your `<aside>` element with the same classes, but the content will be auto-populated:

```html
<aside class="w-64 bg-gray-900 text-white flex-shrink-0">
    <!-- Content will be auto-populated by sidebar-nav.js -->
</aside>
```

## Page Identifiers (data-page values)

Use these exact values for the `data-page` attribute:

### Main Pages
- `dashboard` - Dashboard (/)
- `sale-feed` - Sale Feed

### Market Intelligence
- `opportunities` - Investment Opportunities
- `grading` - Grading Intelligence
- `market-efficiency` - Market Efficiency
- `player-profiles` - Player Profiles
- `alerts` - Opportunity Alerts
- `intelligence-dashboard` - Intelligence Dashboard

### Sales Intelligence
- `sales-pulse` - Sales Pulse
- `sales-platform-mix` - Platform Mix
- `sales-auction-vs-bin` - Auction vs BIN
- `sales-condition-premiums` - Condition Premiums
- `sales-liquidity` - Liquidity & Velocity
- `sales-seller-quality` - Seller Quality
- `sales-shipping-impact` - Shipping Impact

### Indices
- `indices-set` - Set Index
- `indices-player` - Player Index
- `indices-grade` - Grade Index
- `indices-market` - Market Index

### Cards
- `cards` - All Cards
- `cards-top-movers` - Top Movers
- `cards-volatility` - Volatility Analysis
- `cards-premium` - Grading Premium

### Sets
- `sets` - All Sets
- `sets-performance` - Performance
- `sets-liquidity` - Liquidity

## Example: Complete Page Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Page - Trading Card Analytics</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="bg-gray-50" data-page="your-page-id">
    <div class="flex h-screen">
        <aside class="w-64 bg-gray-900 text-white flex-shrink-0">
            <!-- Sidebar content auto-populated -->
        </aside>

        <main class="flex-1 overflow-auto">
            <!-- Your page content here -->
        </main>
    </div>

    <script src="/js/sidebar-nav.js"></script>
    <!-- Your other scripts here -->
</body>
</html>
```

## Benefits
- ✅ Consistent navigation across all pages
- ✅ Single source of truth for menu structure
- ✅ Easy to add/remove/update menu items globally
- ✅ Automatic active page highlighting
- ✅ No need to manually maintain sidebar HTML in each page

## Migration Checklist
For each HTML page:
1. [ ] Add `data-page="page-id"` to `<body>` tag
2. [ ] Add `<script src="/js/sidebar-nav.js"></script>` before closing `</body>`
3. [ ] Remove all sidebar content inside `<aside>` element (keep the element itself)
4. [ ] Test that sidebar renders correctly and active page is highlighted
