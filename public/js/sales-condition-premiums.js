const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const formatCurrency = (value, digits = 2) => `$${formatNumber(value, digits)}`;

async function loadConditionPremiums() {
  const response = await fetch('/api/sales/condition-premiums');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function renderKpis(kpis) {
  const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Top Condition</p>
      <p class="text-2xl font-bold text-green-700">${kpis.top_condition || 'N/A'}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Avg PSA 10</p>
      <p class="text-3xl font-bold text-blue-700">${formatCurrency(kpis.avg_psa10)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Avg Raw</p>
      <p class="text-3xl font-bold text-orange-600">${formatCurrency(kpis.avg_raw)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Premium Multiplier</p>
      <p class="text-3xl font-bold text-purple-600">${formatNumber(kpis.premium_multiplier, 2)}x</p>
    </div>
  `;

  document.getElementById('kpiCards').innerHTML = html;
}

function buildGroupedSeries(rows, dimensionKey, groupKey) {
  const categories = Array.from(new Set(rows.map(row => row[dimensionKey])));
  const groups = Array.from(new Set(rows.map(row => row[groupKey])));

  const datasets = groups.map((group, index) => ({
    label: group,
    data: categories.map(category => {
      const match = rows.find(row => row[dimensionKey] === category && row[groupKey] === group);
      return match ? Number(match.count) : 0;
    }),
    backgroundColor: ['#22c55e', '#f59e0b', '#6366f1', '#94a3b8'][index % 4]
  }));

  return { categories, datasets };
}

function renderCharts(charts) {
  new Chart(document.getElementById('chartAvgPriceByCondition'), {
    type: 'bar',
    data: {
      labels: charts.avgPriceByCondition.map(row => row.condition),
      datasets: [{
        label: 'Avg Price',
        data: charts.avgPriceByCondition.map(row => Number(row.avg_price)),
        backgroundColor: '#22c55e'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartCountByCondition'), {
    type: 'bar',
    data: {
      labels: charts.countByCondition.map(row => row.condition),
      datasets: [{
        label: 'Sales',
        data: charts.countByCondition.map(row => Number(row.count)),
        backgroundColor: '#2563eb'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const platformGrouped = buildGroupedSeries(charts.platformByCondition, 'condition', 'platform');
  new Chart(document.getElementById('chartPlatformByCondition'), {
    type: 'bar',
    data: {
      labels: platformGrouped.categories,
      datasets: platformGrouped.datasets
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });

  const listingTypeGrouped = buildGroupedSeries(charts.listingTypeByCondition, 'condition', 'listing_type');
  new Chart(document.getElementById('chartListingTypeByCondition'), {
    type: 'bar',
    data: {
      labels: listingTypeGrouped.categories,
      datasets: listingTypeGrouped.datasets
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });

  new Chart(document.getElementById('chartShippingByCondition'), {
    type: 'bar',
    data: {
      labels: charts.shippingByCondition.map(row => row.condition),
      datasets: [{
        label: 'Avg Shipping',
        data: charts.shippingByCondition.map(row => Number(row.avg_shipping)),
        backgroundColor: '#f97316'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const bucketGrouped = buildGroupedSeries(charts.priceBucketsByCondition, 'bucket', 'condition');
  new Chart(document.getElementById('chartPriceBucketsByCondition'), {
    type: 'bar',
    data: {
      labels: bucketGrouped.categories,
      datasets: bucketGrouped.datasets
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });
}

async function init() {
  try {
    const data = await loadConditionPremiums();
    if (window.renderDecisionSignals) {
      window.renderDecisionSignals(data.decisionSignals);
    }
    renderKpis(data.kpis || {});
    renderCharts(data.charts || {});
  } catch (error) {
    console.error('Error loading condition premiums:', error);
    document.getElementById('kpiCards').innerHTML = '<div class="col-span-4 text-red-600">Failed to load Condition Premiums.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
