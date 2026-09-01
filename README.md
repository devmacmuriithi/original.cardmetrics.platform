# Trading Card Analytics Dashboard

Modern web-based analytics dashboard for trading card market data.

## Features

- **Dashboard**: Overview of market metrics, top movers, and sentiment analysis
- **Card Analytics**: Individual card performance tracking with price history and volatility
- **Set Analytics**: Set-level metrics, performance comparison, and liquidity analysis
- **Real-time Charts**: Interactive Highcharts visualizations
- **Responsive UI**: Modern Tailwind CSS design

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: Vanilla JavaScript + Highcharts
- **Styling**: Tailwind CSS + Font Awesome

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
DATABASE_URL=your_postgresql_connection_string
PORT=3000
```

3. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

4. Open browser:
```
http://localhost:3000
```

## API Endpoints

### Dashboard
- `GET /api/dashboard` - Key metrics and overview data

### Cards
- `GET /api/cards` - List all cards with filters
- `GET /api/cards/:id` - Card details and historical data

### Sets
- `GET /api/sets` - List all sets with aggregated metrics
- `GET /api/sets/:id` - Set details, top cards, and history

## Routes

- `/` - Dashboard home
- `/#cards` - Cards list
- `/#cards/:id` - Card detail page
- `/#cards/top-movers` - Top price movers
- `/#cards/volatility` - Volatility analysis
- `/#cards/premium` - Grading premium analysis
- `/#sets` - Sets list
- `/#sets/:id` - Set detail page
- `/#sets/performance` - Set performance comparison
- `/#sets/liquidity` - Liquidity analysis
- `/#sets/comparison` - Set comparison tool

## Project Structure

```
milestone2/
├── server.js              # Express server and API routes
├── public/
│   ├── index.html         # Main SPA shell
│   └── js/
│       └── app.js         # Frontend application logic
├── scripts/               # Database and compute scripts
├── db/                    # Database schemas and migrations
└── docs/                  # Documentation
```

## Data Sources

The dashboard pulls data from:
- `card_computed_metrics` - Card-level analytics
- `sets_computed_metrics` - Set-level analytics
- `card_daily_snapshots` - Raw price data
- `sets` - Set metadata

## Development

The application uses hash-based routing for a single-page application experience. All routes are handled client-side with dynamic content loading.

### Adding New Reports

1. Add route in sidebar navigation (`public/index.html`)
2. Create render method in `TradingCardAnalytics` class (`public/js/app.js`)
3. Add API endpoint if needed (`server.js`)
4. Initialize charts in `initializeCharts()` method

## Performance

- API responses are optimized with proper indexing
- Charts use lazy loading
- Data is fetched on-demand per route
- Connection pooling for database queries
