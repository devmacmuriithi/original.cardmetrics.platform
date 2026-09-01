const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const formatCurrency = (value, digits = 2) => `$${formatNumber(value, digits)}`;

async function loadPlatformMix() {
  const response = await fetch('/api/sales/platform-mix');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function renderKpis(kpis) {
  const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Platforms Tracked</p>
      <p class="text-3xl font-bold text-gray-900">${formatNumber(kpis.platform_count)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Top Platform</p>
      <p class="text-2xl font-bold text-blue-700">${kpis.top_platform || 'N/A'}</p>
      <p class="text-sm text-gray-500 mt-2">${formatNumber(kpis.top_platform_share, 1)}% share</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Average Sale Price</p>
      <p class="text-3xl font-bold text-emerald-600">${formatCurrency(kpis.avg_price)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Revenue Leader</p>
      <p class="text-2xl font-bold text-purple-600">${kpis.top_platform || 'N/A'}</p>
    </div>
  `;

  document.getElementById('kpiCards').innerHTML = html;
}

function buildGroupedSeries(rows, dimensionKey, groupKey) {
  const categories = Array.from(new Set(rows.map(row => row[dimensionKey])));
  const groups = Array.from(new Set(rows.map(row => row[groupKey])));

  const datasets = groups.map(group => {
    return {
      label: group,
      data: categories.map(category => {
        const match = rows.find(row => row[dimensionKey] === category && row[groupKey] === group);
        return match ? Number(match.count) : 0;
      })
    };
  });

  return { categories, datasets };
}

function renderCharts(charts) {
  new Chart(document.getElementById('chartVolumeByPlatform'), {
    type: 'bar',
    data: {
      labels: charts.volumeByPlatform.map(row => row.platform),
      datasets: [{
        label: 'Sales',
        data: charts.volumeByPlatform.map(row => Number(row.count)),
        backgroundColor: '#2563eb'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartRevenueByPlatform'), {
    type: 'bar',
    data: {
      labels: charts.revenueByPlatform.map(row => row.platform),
      datasets: [{
        label: 'Revenue',
        data: charts.revenueByPlatform.map(row => Number(row.revenue)),
        backgroundColor: '#10b981'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartAvgPriceByPlatform'), {
    type: 'bar',
    data: {
      labels: charts.avgPriceByPlatform.map(row => row.platform),
      datasets: [{
        label: 'Avg Price',
        data: charts.avgPriceByPlatform.map(row => Number(row.avg_price)),
        backgroundColor: '#8b5cf6'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const listingTypeGrouped = buildGroupedSeries(charts.listingTypeByPlatform, 'platform', 'listing_type');
  new Chart(document.getElementById('chartListingTypeByPlatform'), {
    type: 'bar',
    data: {
      labels: listingTypeGrouped.categories,
      datasets: listingTypeGrouped.datasets.map((dataset, index) => ({
        ...dataset,
        backgroundColor: ['#f97316', '#38bdf8', '#facc15'][index % 3]
      }))
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });

  new Chart(document.getElementById('chartRatingByPlatform'), {
    type: 'bar',
    data: {
      labels: charts.ratingByPlatform.map(row => row.platform),
      datasets: [{
        label: 'Avg Rating',
        data: charts.ratingByPlatform.map(row => Number(row.avg_rating)),
        backgroundColor: '#f59e0b'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { suggestedMax: 5 } } }
  });

  new Chart(document.getElementById('chartShippingByPlatform'), {
    type: 'bar',
    data: {
      labels: charts.shippingByPlatform.map(row => row.platform),
      datasets: [{
        label: 'Avg Shipping',
        data: charts.shippingByPlatform.map(row => Number(row.avg_shipping)),
        backgroundColor: '#ec4899'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function init() {
  try {
    const data = await loadPlatformMix();
    if (window.renderDecisionSignals) {
      window.renderDecisionSignals(data.decisionSignals);
    }
    renderKpis(data.kpis || {});
    renderCharts(data.charts || {});
  } catch (error) {
    console.error('Error loading platform mix:', error);
    document.getElementById('kpiCards').innerHTML = '<div class="col-span-4 text-red-600">Failed to load Platform Mix.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
