const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const formatCurrency = (value, digits = 2) => `$${formatNumber(value, digits)}`;

async function loadAuctionVsBin() {
  const response = await fetch('/api/sales/auction-vs-bin');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function renderKpis(kpis) {
  const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Auction Avg Price</p>
      <p class="text-3xl font-bold text-yellow-600">${formatCurrency(kpis.auction_avg_price)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">BIN Avg Price</p>
      <p class="text-3xl font-bold text-green-600">${formatCurrency(kpis.bin_avg_price)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Auction Share</p>
      <p class="text-3xl font-bold text-gray-900">${formatNumber(kpis.auction_share, 1)}%</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Auction Premium</p>
      <p class="text-3xl font-bold text-purple-600">${formatNumber(kpis.price_premium_pct, 1)}%</p>
    </div>
  `;

  document.getElementById('kpiCards').innerHTML = html;
}

function buildBucketDataset(rows, key) {
  const buckets = Array.from(new Set(rows.map(row => row.bucket)));
  const groups = Array.from(new Set(rows.map(row => row[key])));

  const datasets = groups.map((group, index) => ({
    label: group,
    data: buckets.map(bucket => {
      const match = rows.find(row => row.bucket === bucket && row[key] === group);
      return match ? Number(match.count) : 0;
    }),
    backgroundColor: ['#f59e0b', '#22c55e', '#94a3b8'][index % 3]
  }));

  return { buckets, datasets };
}

function renderCharts(charts) {
  new Chart(document.getElementById('chartCountByType'), {
    type: 'bar',
    data: {
      labels: charts.countByType.map(row => row.listing_type),
      datasets: [{
        label: 'Sales',
        data: charts.countByType.map(row => Number(row.count)),
        backgroundColor: '#f59e0b'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartAvgPriceByType'), {
    type: 'bar',
    data: {
      labels: charts.avgPriceByType.map(row => row.listing_type),
      datasets: [{
        label: 'Avg Price',
        data: charts.avgPriceByType.map(row => Number(row.avg_price)),
        backgroundColor: '#22c55e'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const bucketed = buildBucketDataset(charts.priceBucketsByType, 'listing_type');
  new Chart(document.getElementById('chartPriceBucketsByType'), {
    type: 'bar',
    data: {
      labels: bucketed.buckets,
      datasets: bucketed.datasets
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });

  new Chart(document.getElementById('chartShippingByType'), {
    type: 'bar',
    data: {
      labels: charts.shippingByType.map(row => row.listing_type),
      datasets: [{
        label: 'Avg Shipping',
        data: charts.shippingByType.map(row => Number(row.avg_shipping)),
        backgroundColor: '#fb7185'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const conditionGrouped = buildBucketDataset(charts.conditionByType.map(row => ({
    bucket: row.condition,
    listing_type: row.listing_type,
    count: row.count
  })), 'listing_type');

  new Chart(document.getElementById('chartConditionByType'), {
    type: 'bar',
    data: {
      labels: conditionGrouped.buckets,
      datasets: conditionGrouped.datasets
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });

  new Chart(document.getElementById('chartRatingByType'), {
    type: 'bar',
    data: {
      labels: charts.ratingByType.map(row => row.listing_type),
      datasets: [{
        label: 'Avg Rating',
        data: charts.ratingByType.map(row => Number(row.avg_rating)),
        backgroundColor: '#6366f1'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { suggestedMax: 5 } } }
  });
}

async function init() {
  try {
    const data = await loadAuctionVsBin();
    if (window.renderDecisionSignals) {
      window.renderDecisionSignals(data.decisionSignals);
    }
    renderKpis(data.kpis || {});
    renderCharts(data.charts || {});
  } catch (error) {
    console.error('Error loading auction vs bin:', error);
    document.getElementById('kpiCards').innerHTML = '<div class="col-span-4 text-red-600">Failed to load Auction vs BIN.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
