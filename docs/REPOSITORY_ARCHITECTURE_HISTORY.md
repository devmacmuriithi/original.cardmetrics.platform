# CardMetrics Platform — Version History & Repository Architecture Guide

This document preserves the architectural history, rationale, and relationship between the repositories in the CardMetrics workspace for all future developers and commits.

---

## 1. Executive Summary & Active Repositories

| Repository | GitHub URL | Local Path | Status & Role | Port | Tech Stack |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`cardmetrics.platform`** | `https://github.com/devmacmuriithi/cardmetrics.platform.git` | `.../saas.sportscardsmetrics.com` | **ACTIVE / PRIMARY PRODUCTION** | `3001` (Dev/Prod) | React 18, Vite, TypeScript, Tailwind, Express API, PostgreSQL (Supabase) |
| **`original.cardmetrics.platform`** | `https://github.com/devmacmuriithi/original.cardmetrics.platform.git` | `.../original.cardmetrics.platform` | **ACTIVE / LEGACY REFERENCE** | `3002` | Node.js CommonJS (`server.js`), Vanilla JS, Tailwind CDN, PostgreSQL |
| **`sportscardsmetrics.com`** | `https://github.com/devmacmuriithi/sportscardsmetrics.com.git` | *(Archived on GitHub)* | **DEPRECATED / ARCHIVED** | N/A | Intermediate v1 React prototype (frozen August 28, 2026) |

> [!IMPORTANT]
> **Active Development Rule**:
> All ongoing feature development, UI changes, sync engines, and production deployments must be committed to **`cardmetrics.platform`**.
> **`original.cardmetrics.platform`** is maintained strictly as an active legacy reference server running on port `3002` behind `/login` for client verification and historical baseline comparison.

---

## 2. Chronological Repository Evolution

### Phase 1: The Original Platform (`original.cardmetrics.platform`)
- **Origin**: Initial implementation built as a monolithic Node.js Express server (`server.js` ~3,000 lines) serving static HTML files (`dashboard.html`, `sale-feed.html`, `top-movers.html`, etc.) with vanilla JavaScript and Highcharts.
- **Data Source**: Legacy CSV imports (`cards_raw_ingests`, `card_daily_snapshots`) and bulk transaction history.
- **Why Kept Active**:
  - Howard Schwartz and stakeholders requested keeping the original system runnable in parallel to verify data parity, review legacy layouts, and inspect original metrics logic.
  - Secured behind a custom HTML session login (`/login`, credentials: `admin` / `Admin@2026`) and explicit `/dashboard` redirect on port `3002`.
  - Upgraded to extract live sale metadata (`COALESCE` with `raw_sale` payloads) so its legacy sale feed displays all 77,800+ real transactions.

### Phase 2: The Intermediate Prototype (`sportscardsmetrics.com`)
- **Period**: Created August 21, 2026 – August 28, 2026.
- **Purpose**: Initial proof-of-concept for modernizing the platform into a React + TypeScript Single Page Application (SPA) with Recharts and Tailwind CSS.
- **Why Superseded**:
  - Reached commit `a6ae5d0` on August 28, 2026.
  - Scope was originally restricted to sports cards only ("SportsCardsMetrics").
  - Accumulated prototyping baggage, experimental mock routes, and mixed configurations during Milestone 1 validation.
  - Lacked multi-tenant authentication, automated title parsing, embedded AI/MCP capabilities, and TCG domain coverage.

### Phase 3: The Production SaaS Platform (`cardmetrics.platform`)
- **Period**: Initialized August 28, 2026 (`f0721fb: feat(core): initialize clean Sports Cards Metrics SaaS Platform v2.0`) – Present.
- **Why Named `cardmetrics.platform`**:
  - Expanded beyond sports to first-class **Trading Card Games (TCG)** support (Pokémon, Magic: The Gathering, Lorcana).
  - General branding aligns with multi-category card intelligence rather than sports cards exclusively.
- **Key Capabilities Added Only in `cardmetrics.platform`**:
  1. **Embedded MCP Server & AI Chatbox**:
     - Embedded Model Context Protocol (MCP) server exposing tools: `search_cards`, `get_card_details`, `get_card_sales`, `get_market_movers`, `get_investment_opportunities`.
     - Direct in-app AI chat supporting Google Gemini 2.5 Flash, OpenAI GPT-4o, and Anthropic Claude 3.5 Sonnet.
     - Per-tenant dynamic MCP API key issuance and automatic host/port resolution for Claude Desktop and Cursor.
  2. **Live Data Pipelines**:
     - `alx-sync-service.ts`: Pulls live ALX TCG comps data, streaming raw transactions and PSA cert payloads into `card_sales`.
     - `alx-gemrate-sync-service.ts`: Pulls live GemRate population reports, grade distributions, and monthly momentum.
     - Automated entity mining linking unstructured titles to structured sets and players.
  3. **Advanced Analytics & Indicators**:
     - Global Category Filter (`All`, `Sports`, `TCG/Pokémon`) with instant reactive switching.
     - Dual-Path Drill-down Modal (Analytics & Valuation vs Transaction/Listing Information).
     - Set Coverage Ratio & Confidence Tiers (High, Medium, Thin).
     - 12-Month Population Trendlines, Population Velocity, Acceleration, and GemRate Supply Pressure Indicators.
     - Video Game Player Rating integration (NBA 2K & Madden ratings display on player profiles).
     - Independent Data Freshness Timestamps (`Pricing`, `Pop Report`, `Multipliers`).

---

## 3. Comparative Architecture & Feature Matrix

| Feature | Legacy Platform (`original.cardmetrics.platform`) | Production SaaS (`cardmetrics.platform`) |
| :--- | :--- | :--- |
| **Frontend Framework** | Vanilla JS, HTML5, Tailwind CDN | React 18, Vite, TypeScript, Tailwind CSS |
| **Charts Engine** | Highcharts CDN | Recharts, Lucide Icons |
| **Routing** | Multi-page server routes (`.html` files) | React Router v6 (SPA) |
| **Authentication** | Cookie-based session auth (`admin` / `Admin@2026`) | JWT / Session Workspace Auth (`users`, `tenants`) |
| **AI / MCP Integration** | None | Embedded MCP server + in-app AI Assistant + dynamic keys |
| **Category Coverage** | Sports primarily | Global Switcher: All, Sports, TCG / Pokémon |
| **Sales Syncing** | Static/CSV batch processing | Live cursor-based ALX streaming API + entity miner |
| **Modal Drilldown** | Standard card link redirect | Dual-Tab Modal (Deep Analytics & Sale Metadata) |
| **Video Game Ratings** | None | Integrated NBA 2K & Madden rating badges |
| **Deployment Port** | `3002` | `3001` (Dev) / Production URL (Railway) |

---

## 4. Port Allocations & Execution Guidelines

### Running the Production SaaS:
```bash
cd saas.sportscardsmetrics.com
npm run dev # Starts on port 3001
```
- Client interface: `http://localhost:3001`
- Backend API & MCP endpoint: `http://localhost:3001/api/mcp`

### Running the Legacy Platform Reference:
```bash
cd original.cardmetrics.platform
node server.js # Starts on port 3002
```
- Client interface: `http://localhost:3002`
- Login URL: `http://localhost:3002/login` (User: `admin`, Password: `Admin@2026`)
- Direct Dashboard: `http://localhost:3002/dashboard`
- Live Sale Feed: `http://localhost:3002/sale-feed`
