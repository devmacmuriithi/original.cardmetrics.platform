const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const formatCurrency = (value, digits = 2) => `$${formatNumber(value, digits)}`;

async function loadSalesPulse() {
  const response = await fetch('/api/sales/pulse');
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
      <p class="text-sm text-gray-500">Total Revenue</p>
      <p class="text-3xl font-bold text-emerald-600">${formatCurrency(kpis.total_revenue)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Average Sale Price</p>
      <p class="text-3xl font-bold text-blue-700">${formatCurrency(kpis.avg_price)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Average Shipping</p>
      <p class="text-3xl font-bold text-orange-600">${formatCurrency(kpis.avg_shipping)}</p>
    </div>
  `;

  document.getElementById('kpiCards').innerHTML = html;
}

function renderCharts(charts) {
  const salesLabels = charts.salesByDay.map(row => row.date);
  const salesCounts = charts.salesByDay.map(row => Number(row.count));
  const salesRevenue = charts.salesByDay.map(row => Number(row.revenue));

  new Chart(document.getElementById('chartSalesByDay'), {
    type: 'line',
    data: {
      labels: salesLabels,
      datasets: [{
        label: 'Sales',
        data: salesCounts,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        tension: 0.25
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartRevenueByDay'), {
    type: 'line',
    data: {
      labels: salesLabels,
      datasets: [{
        label: 'Revenue',
        data: salesRevenue,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        tension: 0.25
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartPlatformShare'), {
    type: 'doughnut',
    data: {
      labels: charts.platformShare.map(row => row.platform),
      datasets: [{
        data: charts.platformShare.map(row => Number(row.count)),
        backgroundColor: ['#2563eb', '#f59e0b', '#10b981', '#6366f1', '#f43f5e']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartListingType'), {
    type: 'pie',
    data: {
      labels: charts.listingTypeShare.map(row => row.listing_type),
      datasets: [{
        data: charts.listingTypeShare.map(row => Number(row.count)),
        backgroundColor: ['#22c55e', '#eab308', '#94a3b8']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartPriceBuckets'), {
    type: 'bar',
    data: {
      labels: charts.priceBuckets.map(row => row.bucket),
      datasets: [{
        label: 'Sales',
        data: charts.priceBuckets.map(row => Number(row.count)),
        backgroundColor: '#8b5cf6'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  new Chart(document.getElementById('chartSalesByHour'), {
    type: 'bar',
    data: {
      labels: charts.salesByHour.map(row => `${row.hour}:00`),
      datasets: [{
        label: 'Sales',
        data: charts.salesByHour.map(row => Number(row.count)),
        backgroundColor: '#f97316'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function init() {
  try {
    const data = await loadSalesPulse();
    if (window.renderDecisionSignals) {
      window.renderDecisionSignals(data.decisionSignals);
    }
    renderKpis(data.kpis || {});
    renderCharts(data.charts || {});
  } catch (error) {
    console.error('Error loading sales pulse:', error);
    document.getElementById('kpiCards').innerHTML = '<div class="col-span-4 text-red-600">Failed to load Sales Pulse.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
