const formatNumber = (value, digits = 2) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const formatCurrency = (value, digits = 2) => `$${formatNumber(value, digits)}`;
const formatPercent = (value, digits = 1) => `${formatNumber(value, digits)}%`;

let indexChart = null;
let volumeChart = null;

function getSeriesValueAt(series, targetDate) {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i].date <= targetDate) {
      return Number(series[i].index_value || 0);
    }
  }
  return null;
}

function computeSeriesStats(series) {
  if (!series.length) {
    return {
      momentum30: 0,
      volatility30: 0,
      avgSales30: 0,
      maxDrawdown: 0,
      trendLabel: 'No data'
    };
  }

  const latest = series[series.length - 1];
  const lastDate = new Date(latest.date);
  const date30 = new Date(lastDate); date30.setDate(date30.getDate() - 30);
  const value30 = getSeriesValueAt(series, date30.toISOString().slice(0, 10));
  const momentum30 = value30 ? ((latest.index_value / value30) - 1) * 100 : 0;

  const window30 = series.slice(-30);
  const values30 = window30.map(row => Number(row.index_value || 0));
  const avg30 = values30.reduce((sum, v) => sum + v, 0) / (values30.length || 1);
  const variance30 = values30.reduce((sum, v) => sum + Math.pow(v - avg30, 2), 0) / (values30.length || 1);
  const volatility30 = Math.sqrt(variance30);

  const avgSales30 = window30.reduce((sum, row) => sum + Number(row.sales_count || 0), 0) / (window30.length || 1);

  let peak = -Infinity;
  let maxDrawdown = 0;
  series.forEach(row => {
    const value = Number(row.index_value || 0);
    if (value > peak) peak = value;
    const drawdown = peak > 0 ? ((value - peak) / peak) * 100 : 0;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  });

  let trendLabel = 'Stable';
  if (momentum30 >= 7) trendLabel = 'Strong Uptrend';
  else if (momentum30 >= 2) trendLabel = 'Uptrend';
  else if (momentum30 <= -7) trendLabel = 'Strong Downtrend';
  else if (momentum30 <= -2) trendLabel = 'Downtrend';

  return { momentum30, volatility30, avgSales30, maxDrawdown, trendLabel };
}

async function fetchIndexSeries(endpoint) {
  const query = window.indexFilters ? window.indexFilters.buildIndexQueryString() : '';
  const response = await fetch(`${endpoint}${query ? `?${query}` : ''}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function renderIndexKpis(kpis, latest) {
  const html = `
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Index Value</p>
      <p class="text-3xl font-bold text-gray-900">${formatNumber(kpis.current_value, 2)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Change 7D</p>
      <p class="text-3xl font-bold ${kpis.change_7d >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatNumber(kpis.change_7d, 2)}%</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Change 30D</p>
      <p class="text-3xl font-bold ${kpis.change_30d >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatNumber(kpis.change_30d, 2)}%</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Change 90D</p>
      <p class="text-3xl font-bold ${kpis.change_90d >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatNumber(kpis.change_90d, 2)}%</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Latest Median Price</p>
      <p class="text-2xl font-bold text-blue-700">${formatCurrency(latest?.price)}</p>
      <p class="text-xs text-gray-500 mt-1">${latest?.date || ''}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <p class="text-sm text-gray-500">Latest Sales Count</p>
      <p class="text-2xl font-bold text-purple-600">${formatNumber(latest?.sales_count, 0)}</p>
      <p class="text-xs text-gray-500 mt-1">${latest?.date || ''}</p>
    </div>
  `;

  const container = document.getElementById('indexKpis');
  if (container) {
    container.innerHTML = html;
  }
}

function renderIndexInsights(series) {
  const insightsContainer = document.getElementById('indexInsights');
  if (!insightsContainer) return;

  const stats = computeSeriesStats(series);
  const trendColor = stats.momentum30 >= 0 ? 'text-emerald-600' : 'text-red-600';
  const drawdownColor = stats.maxDrawdown <= -10 ? 'text-red-600' : 'text-yellow-600';

  insightsContainer.innerHTML = `
    <div class="bg-white rounded-xl shadow p-6">
      <p class="text-xs uppercase tracking-wide text-gray-500">Trend Signal (30D)</p>
      <p class="text-2xl font-bold ${trendColor}">${stats.trendLabel}</p>
      <p class="text-sm text-gray-500 mt-2">Momentum: <span class="font-semibold">${formatPercent(stats.momentum30, 2)}</span></p>
      <p class="text-sm text-gray-500">Volatility (30D): <span class="font-semibold">${formatNumber(stats.volatility30, 2)}</span></p>
    </div>
    <div class="bg-white rounded-xl shadow p-6">
      <p class="text-xs uppercase tracking-wide text-gray-500">Liquidity Pulse</p>
      <p class="text-2xl font-bold text-indigo-600">${formatNumber(stats.avgSales30, 0)}</p>
      <p class="text-sm text-gray-500 mt-2">Avg daily sales (30D)</p>
      <p class="text-sm text-gray-500">Latest sales count: <span class="font-semibold">${formatNumber(series[series.length - 1]?.sales_count, 0)}</span></p>
    </div>
    <div class="bg-white rounded-xl shadow p-6">
      <p class="text-xs uppercase tracking-wide text-gray-500">Risk Snapshot</p>
      <p class="text-2xl font-bold ${drawdownColor}">${formatPercent(stats.maxDrawdown, 2)}</p>
      <p class="text-sm text-gray-500 mt-2">Max drawdown from peak</p>
      <p class="text-sm text-gray-500">Range: <span class="font-semibold">${formatNumber(Math.min(...series.map(row => Number(row.index_value || 0))), 1)}</span> - <span class="font-semibold">${formatNumber(Math.max(...series.map(row => Number(row.index_value || 0))), 1)}</span></p>
    </div>
  `;
}

function renderIndexCharts(series) {
  const labels = series.map(row => row.date);
  const values = series.map(row => Number(row.index_value));
  const volume = series.map(row => Number(row.sales_count));

  const indexCtx = document.getElementById('indexValueChart');
  const volumeCtx = document.getElementById('indexVolumeChart');

  if (indexCtx) {
    if (indexChart) indexChart.destroy();
    indexChart = new Chart(indexCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Index Value',
          data: values,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.2)',
          tension: 0.25,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { title: { display: true, text: 'Index Value' } },
          x: { ticks: { maxRotation: 0 } }
        }
      }
    });
  }

  if (volumeCtx) {
    if (volumeChart) volumeChart.destroy();
    volumeChart = new Chart(volumeCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Sales Count',
          data: volume,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { title: { display: true, text: 'Sales Count' } },
          x: { ticks: { maxRotation: 0 } }
        }
      }
    });
  }
}

async function loadIndexDashboard(endpoint) {
  const data = await fetchIndexSeries(endpoint);
  const series = data.series || [];
  const kpis = data.kpis || {};
  const latest = series.length ? series[series.length - 1] : null;

  renderIndexKpis(kpis, latest);
  renderIndexInsights(series);
  renderIndexCharts(series);
}

window.indexDashboard = {
  loadIndexDashboard
};
