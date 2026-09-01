const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const formatCurrency = (value, digits = 2) => `$${formatNumber(value, digits)}`;

async function loadLiquidity() {
  const response = await fetch('/api/sales/liquidity');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function renderKpis(kpis) {
  const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Total Sales</p>
      <p class="text-3xl font-bold text-gray-900">${formatNumber(kpis.total_sales)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Avg Daily Sales</p>
      <p class="text-3xl font-bold text-emerald-600">${formatNumber(kpis.avg_daily_sales, 1)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Peak Day Sales</p>
      <p class="text-3xl font-bold text-blue-700">${formatNumber(kpis.peak_day_sales)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Avg Sale Price</p>
      <p class="text-3xl font-bold text-purple-600">${formatCurrency(kpis.avg_sale_price)}</p>
    </div>
  `;

  document.getElementById('kpiCards').innerHTML = html;
}

function renderCharts(charts) {
  const labels = charts.salesByDay.map(row => row.date);

  new Chart(document.getElementById('chartSalesByDay'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Sales',
        data: charts.salesByDay.map(row => Number(row.count)),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.2)',
        tension: 0.25
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartRevenueByDay'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: charts.revenueByDay.map(row => Number(row.revenue)),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        tension: 0.25
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartSalesByWeekday'), {
    type: 'bar',
    data: {
      labels: charts.salesByWeekday.map(row => row.weekday),
      datasets: [{
        label: 'Sales',
        data: charts.salesByWeekday.map(row => Number(row.count)),
        backgroundColor: '#14b8a6'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartPriceTierVolume'), {
    type: 'bar',
    data: {
      labels: charts.priceTierVolume.map(row => row.bucket),
      datasets: [{
        label: 'Sales',
        data: charts.priceTierVolume.map(row => Number(row.count)),
        backgroundColor: '#8b5cf6'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartListingTypeShare'), {
    type: 'doughnut',
    data: {
      labels: charts.listingTypeShare.map(row => row.listing_type),
      datasets: [{
        data: charts.listingTypeShare.map(row => Number(row.count)),
        backgroundColor: ['#f59e0b', '#22c55e', '#94a3b8']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartQuantityDistribution'), {
    type: 'bar',
    data: {
      labels: charts.quantityDistribution.map(row => row.quantity),
      datasets: [{
        label: 'Sales',
        data: charts.quantityDistribution.map(row => Number(row.count)),
        backgroundColor: '#f97316'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function init() {
  try {
    const data = await loadLiquidity();
    if (window.renderDecisionSignals) {
      window.renderDecisionSignals(data.decisionSignals);
    }
    renderKpis(data.kpis || {});
    renderCharts(data.charts || {});
  } catch (error) {
    console.error('Error loading liquidity:', error);
    document.getElementById('kpiCards').innerHTML = '<div class="col-span-4 text-red-600">Failed to load Liquidity & Velocity.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
