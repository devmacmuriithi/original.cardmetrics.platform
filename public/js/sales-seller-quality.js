const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const formatCurrency = (value, digits = 2) => `$${formatNumber(value, digits)}`;

async function loadSellerQuality() {
  const response = await fetch('/api/sales/seller-quality');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function renderKpis(kpis) {
  const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Avg Seller Rating</p>
      <p class="text-3xl font-bold text-purple-700">${formatNumber(kpis.avg_rating, 2)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">High Rated Share</p>
      <p class="text-3xl font-bold text-emerald-600">${formatNumber(kpis.pct_high_rated, 1)}%</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Avg Price (4.8+)</p>
      <p class="text-3xl font-bold text-blue-700">${formatCurrency(kpis.avg_price_high)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Avg Price (<4.0)</p>
      <p class="text-3xl font-bold text-red-600">${formatCurrency(kpis.avg_price_low)}</p>
    </div>
  `;

  document.getElementById('kpiCards').innerHTML = html;
}

function renderCharts(charts) {
  new Chart(document.getElementById('chartRatingDistribution'), {
    type: 'bar',
    data: {
      labels: charts.ratingDistribution.map(row => row.bucket),
      datasets: [{
        label: 'Sales',
        data: charts.ratingDistribution.map(row => Number(row.count)),
        backgroundColor: '#8b5cf6'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartAvgPriceByRating'), {
    type: 'bar',
    data: {
      labels: charts.avgPriceByRating.map(row => row.bucket),
      datasets: [{
        label: 'Avg Price',
        data: charts.avgPriceByRating.map(row => Number(row.avg_price)),
        backgroundColor: '#22c55e'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartPlatformRating'), {
    type: 'bar',
    data: {
      labels: charts.platformRating.map(row => row.platform),
      datasets: [{
        label: 'Avg Rating',
        data: charts.platformRating.map(row => Number(row.avg_rating)),
        backgroundColor: '#f59e0b'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { suggestedMax: 5 } } }
  });

  const listingTypeGroups = Array.from(new Set(charts.listingTypeByRating.map(row => row.listing_type)));
  const ratingBuckets = Array.from(new Set(charts.listingTypeByRating.map(row => row.bucket)));

  const listingTypeDatasets = listingTypeGroups.map((group, index) => ({
    label: group,
    data: ratingBuckets.map(bucket => {
      const match = charts.listingTypeByRating.find(row => row.listing_type === group && row.bucket === bucket);
      return match ? Number(match.count) : 0;
    }),
    backgroundColor: ['#60a5fa', '#f97316', '#34d399'][index % 3]
  }));

  new Chart(document.getElementById('chartListingTypeByRating'), {
    type: 'bar',
    data: {
      labels: ratingBuckets,
      datasets: listingTypeDatasets
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });

  new Chart(document.getElementById('chartShippingByRating'), {
    type: 'bar',
    data: {
      labels: charts.shippingByRating.map(row => row.bucket),
      datasets: [{
        label: 'Avg Shipping',
        data: charts.shippingByRating.map(row => Number(row.avg_shipping)),
        backgroundColor: '#f97316'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartSalesByRating'), {
    type: 'bar',
    data: {
      labels: charts.salesByRating.map(row => row.bucket),
      datasets: [{
        label: 'Sales',
        data: charts.salesByRating.map(row => Number(row.count)),
        backgroundColor: '#6366f1'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function init() {
  try {
    const data = await loadSellerQuality();
    if (window.renderDecisionSignals) {
      window.renderDecisionSignals(data.decisionSignals);
    }
    renderKpis(data.kpis || {});
    renderCharts(data.charts || {});
  } catch (error) {
    console.error('Error loading seller quality:', error);
    document.getElementById('kpiCards').innerHTML = '<div class="col-span-4 text-red-600">Failed to load Seller Quality.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
