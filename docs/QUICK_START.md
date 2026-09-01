# Quick Start Guide

## Running the Analytics Dashboard

### 1. Start the Server

```bash
npm start
```

Expected output:
```
🚀 Analytics server running at http://localhost:3000
📊 Dashboard: http://localhost:3000
🃏 Cards: http://localhost:3000/cards
📦 Sets: http://localhost:3000/sets
```

### 2. Access the Dashboard

Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Navigation

The dashboard has two main sections accessible via the sidebar:

#### Cards Analytics
- **All Cards** - Browse all cards with search and filters
- **Top Movers** - Cards with biggest price changes
- **Volatility Analysis** - Risk analysis across cards
- **Grading Premium** - PSA 10 vs loose price comparison

#### Sets Analytics
- **All Sets** - Browse all card sets
- **Performance** - Set performance metrics
- **Liquidity** - Trading volume analysis
- **Set Comparison** - Compare multiple sets

### 4. Viewing Card Details

Click any card to see:
- Current prices (loose, graded, PSA 10, BGS 10)
- Price history charts
- Volume trends
- 7/15/30-day price windows
- Volatility metrics

### 5. Viewing Set Details

Click any set to see:
- Set overview metrics
- Top cards in the set
- Historical performance
- Trend distribution

## API Testing

Test the API endpoints directly:

```bash
# Dashboard data
curl http://localhost:3000/api/dashboard

# List cards
curl http://localhost:3000/api/cards?limit=10

# Card details
curl http://localhost:3000/api/cards/12345

# List sets
curl http://localhost:3000/api/sets?limit=10

# Set details
curl http://localhost:3000/api/sets/1
```

## Troubleshooting

### Server won't start
- Check DATABASE_URL in .env file
- Ensure PostgreSQL is running
- Verify port 3000 is available

### No data showing
- Run compute scripts to populate metrics:
  ```bash
  node scripts/compute/compute-metrics.js --date=2026-01-24
  node scripts/compute/compute-set-metrics.js --date=2026-01-24
  ```

### Charts not loading
- Check browser console for errors
- Ensure Highcharts CDN is accessible
- Verify API endpoints return data

## Development Mode

For auto-reload during development:

```bash
npm run dev
```

This uses nodemon to restart the server on file changes.
