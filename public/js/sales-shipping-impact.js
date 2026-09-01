const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const formatCurrency = (value, digits = 2) => `$${formatNumber(value, digits)}`;

async function loadShippingImpact() {
  const response = await fetch('/api/sales/shipping-impact');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function renderKpis(kpis) {
  const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Avg Shipping</p>
      <p class="text-3xl font-bold text-orange-600">${formatCurrency(kpis.avg_shipping)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Median Shipping</p>
      <p class="text-3xl font-bold text-gray-900">${formatCurrency(kpis.median_shipping)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Shipping % of Price</p>
      <p class="text-3xl font-bold text-purple-600">${formatNumber(kpis.shipping_pct_price, 1)}%</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Free Shipping Share</p>
      <p class="text-3xl font-bold text-emerald-600">${formatNumber(kpis.free_shipping_share, 1)}%</p>
    </div>
  `;

  document.getElementById('kpiCards').innerHTML = html;
}

function renderCharts(charts) {
  new Chart(document.getElementById('chartShippingDistribution'), {
    type: 'bar',
    data: {
      labels: charts.shippingDistribution.map(row => row.bucket),
      datasets: [{
        label: 'Sales',
        data: charts.shippingDistribution.map(row => Number(row.count)),
        backgroundColor: '#f97316'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartShippingByPlatform'), {
    type: 'bar',
    data: {
      labels: charts.shippingByPlatform.map(row => row.platform),
      datasets: [{
        label: 'Avg Shipping',
        data: charts.shippingByPlatform.map(row => Number(row.avg_shipping)),
        backgroundColor: '#fb7185'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartShippingByListingType'), {
    type: 'bar',
    data: {
      labels: charts.shippingByListingType.map(row => row.listing_type),
      datasets: [{
        label: 'Avg Shipping',
        data: charts.shippingByListingType.map(row => Number(row.avg_shipping)),
        backgroundColor: '#60a5fa'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartShippingByCondition'), {
    type: 'bar',
    data: {
      labels: charts.shippingByCondition.map(row => row.condition),
      datasets: [{
        label: 'Avg Shipping',
        data: charts.shippingByCondition.map(row => Number(row.avg_shipping)),
        backgroundColor: '#22c55e'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartShippingByPriceTier'), {
    type: 'bar',
    data: {
      labels: charts.shippingByPriceTier.map(row => row.bucket),
      datasets: [{
        label: 'Avg Shipping',
        data: charts.shippingByPriceTier.map(row => Number(row.avg_shipping)),
        backgroundColor: '#a855f7'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartTotalCostByListingType'), {
    type: 'bar',
    data: {
      labels: charts.totalCostByListingType.map(row => row.listing_type),
      datasets: [{
        label: 'Avg Total Cost',
        data: charts.totalCostByListingType.map(row => Number(row.avg_total_cost)),
        backgroundColor: '#f59e0b'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function init() {
  try {
    const data = await loadShippingImpact();
    if (window.renderDecisionSignals) {
      window.renderDecisionSignals(data.decisionSignals);
    }
    renderKpis(data.kpis || {});
    renderCharts(data.charts || {});
  } catch (error) {
    console.error('Error loading shipping impact:', error);
    document.getElementById('kpiCards').innerHTML = '<div class="col-span-4 text-red-600">Failed to load Shipping Impact.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
