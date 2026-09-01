// Enhanced Cards Page with Comprehensive Metric Intelligence
let currentPage = 0;
const pageSize = 50;
let currentFilters = {};
let currentCardData = null;
let currentHistoryData = null;
let currentCards = [];
let sortColumn = 'opportunity_score';
let sortDirection = 'desc';

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadCards();
  attachEventListeners();
});

function attachEventListeners() {
  document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);
  
  // Enter key support
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') applyFilters();
    });
  });
}

function applyFilters() {
  currentFilters = {
    search: document.getElementById('searchInput')?.value || '',
    trendState: document.getElementById('trendStateFilter')?.value || '',
    minLiquidity: document.getElementById('minLiquidityFilter')?.value || '',
    minOpportunity: document.getElementById('minOpportunityFilter')?.value || '',
    minMomentum: document.getElementById('minMomentumFilter')?.value || '',
    maxMomentum: document.getElementById('maxMomentumFilter')?.value || '',
    sortBy: document.getElementById('sortByFilter')?.value || 'opportunity_score'
  };
  currentPage = 0;
  loadCards();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('trendStateFilter').value = '';
  document.getElementById('minLiquidityFilter').value = '';
  document.getElementById('minOpportunityFilter').value = '';
  document.getElementById('minMomentumFilter').value = '';
  document.getElementById('maxMomentumFilter').value = '';
  document.getElementById('sortByFilter').value = 'opportunity_score';
  currentFilters = {};
  currentPage = 0;
  loadCards();
}

async function loadCards() {
  showLoading();
  
  try {
    const params = new URLSearchParams({
      limit: pageSize,
      offset: currentPage * pageSize,
      ...currentFilters
    });
    
    const response = await fetch(`/api/cards?${params}`);
    if (!response.ok) throw new Error('Failed to load cards');
    
    const data = await response.json();
    currentCards = data.cards || [];
    sortAndRenderCards();
    renderPagination(data.total || 0, currentPage, pageSize);
  } catch (error) {
    console.error('Error loading cards:', error);
    showError('Failed to load cards. Please try again.');
  } finally {
    hideLoading();
  }
}

function renderCardsTable(cards) {
  const tbody = document.getElementById('cardsTableBody');
  if (!tbody) return;
  
  if (cards.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-12 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-4"></i>
          <p>No cards found matching your filters</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = cards.map(card => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4">
        <div class="text-sm font-medium text-gray-900">${escapeHtml(card.product_name || 'Unknown')}</div>
        <div class="text-sm text-gray-500">${escapeHtml(card.console_name || '')}</div>
      </td>
      <td class="px-6 py-4 text-right">
        <div class="text-sm font-bold text-gray-900">$${formatNumber(card.loose_price)}</div>
        <div class="text-xs text-gray-500">PSA10: $${formatNumber(card.psa10_price)}</div>
      </td>
      <td class="px-6 py-4 text-center">
        ${renderOpportunityScore(card.opportunity_score)}
      </td>
      <td class="px-6 py-4 text-center">
        ${renderTrendBadge(card.trend_state)}
        <div class="text-xs text-gray-500 mt-1">${formatPercent(card.price_change_30d)}%</div>
      </td>
      <td class="px-6 py-4 text-center">
        ${renderMomentumIndicator(card.momentum)}
      </td>
      <td class="px-6 py-4 text-center">
        ${renderLiquidityScore(card.liquidity_score)}
        <div class="text-xs text-gray-500 mt-1">${formatNumber(card.days_to_liquidity, 1)}d</div>
      </td>
      <td class="px-6 py-4 text-center">
        ${renderRiskBadge(card.volatility_regime)}
        <div class="text-xs text-gray-500 mt-1">Conf: ${card.data_confidence_score || 0}</div>
      </td>
      <td class="px-6 py-4 text-center">
        <a href="/card-detail/${card.card_id}" class="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          <i class="fas fa-chart-line mr-1"></i>View
        </a>
      </td>
    </tr>
  `).join('');
}

function renderOpportunityScore(score) {
  const value = Number(score) || 0;
  let colorClass = 'bg-gray-100 text-gray-800';
  let icon = 'fa-minus';
  
  if (value >= 70) {
    colorClass = 'bg-green-100 text-green-800';
    icon = 'fa-arrow-up';
  } else if (value >= 50) {
    colorClass = 'bg-blue-100 text-blue-800';
    icon = 'fa-arrow-right';
  } else if (value >= 30) {
    colorClass = 'bg-yellow-100 text-yellow-800';
    icon = 'fa-minus';
  }
  
  return `
    <div class="inline-flex items-center px-3 py-1 rounded-full ${colorClass}">
      <i class="fas ${icon} mr-1"></i>
      <span class="font-bold">${value}</span>
    </div>
  `;
}

function renderTrendBadge(trend) {
  const trendMap = {
    'Rising': { color: 'bg-green-100 text-green-800', icon: 'fa-arrow-trend-up' },
    'Stable': { color: 'bg-gray-100 text-gray-800', icon: 'fa-minus' },
    'Declining': { color: 'bg-red-100 text-red-800', icon: 'fa-arrow-trend-down' }
  };
  
  const config = trendMap[trend] || trendMap['Stable'];
  return `
    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}">
      <i class="fas ${config.icon} mr-1"></i>${trend || 'N/A'}
    </span>
  `;
}

function renderMomentumIndicator(momentum) {
  const value = Number(momentum) || 0;
  const percent = (value * 100).toFixed(1);
  let colorClass = 'text-gray-600';
  let icon = 'fa-minus';
  
  if (value > 0.05) {
    colorClass = 'text-green-600';
    icon = 'fa-arrow-up';
  } else if (value < -0.05) {
    colorClass = 'text-red-600';
    icon = 'fa-arrow-down';
  }
  
  return `
    <div class="${colorClass} font-semibold">
      <i class="fas ${icon}"></i> ${percent}%
    </div>
  `;
}

function renderLiquidityScore(score) {
  const value = Number(score) || 0;
  const percent = (value * 100).toFixed(0);
  let colorClass = 'bg-gray-100 text-gray-800';
  
  if (value >= 0.7) {
    colorClass = 'bg-green-100 text-green-800';
  } else if (value >= 0.4) {
    colorClass = 'bg-blue-100 text-blue-800';
  } else if (value >= 0.2) {
    colorClass = 'bg-yellow-100 text-yellow-800';
  } else {
    colorClass = 'bg-red-100 text-red-800';
  }
  
  return `
    <div class="inline-flex items-center px-2 py-1 rounded ${colorClass} text-xs font-medium">
      ${percent}%
    </div>
  `;
}

function renderRiskBadge(regime) {
  const riskMap = {
    'Low Volatility': { color: 'bg-green-100 text-green-800', text: 'Low' },
    'Medium Volatility': { color: 'bg-yellow-100 text-yellow-800', text: 'Med' },
    'High Volatility': { color: 'bg-red-100 text-red-800', text: 'High' },
    'Unknown': { color: 'bg-gray-100 text-gray-800', text: 'N/A' }
  };
  
  const config = riskMap[regime] || riskMap['Unknown'];
  return `
    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.color}">
      ${config.text}
    </span>
  `;
}

function renderPagination(total, page, size) {
  const paginationDiv = document.getElementById('pagination');
  if (!paginationDiv) return;
  
  const totalPages = Math.ceil(total / size);
  const start = page * size + 1;
  const end = Math.min((page + 1) * size, total);
  
  paginationDiv.innerHTML = `
    <div class="text-sm text-gray-700">
      Showing <span class="font-medium">${start}</span> to <span class="font-medium">${end}</span> of <span class="font-medium">${total}</span> cards
    </div>
    <div class="flex gap-2">
      <button onclick="previousPage()" ${page === 0 ? 'disabled' : ''} 
              class="px-3 py-1 border rounded ${page === 0 ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'}">
        <i class="fas fa-chevron-left"></i> Previous
      </button>
      <button onclick="nextPage()" ${page >= totalPages - 1 ? 'disabled' : ''} 
              class="px-3 py-1 border rounded ${page >= totalPages - 1 ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'}">
        Next <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  `;
}

function previousPage() {
  if (currentPage > 0) {
    currentPage--;
    loadCards();
  }
}

function nextPage() {
  currentPage++;
  loadCards();
}

function showLoading() {
  document.getElementById('loading')?.style.setProperty('display', 'flex');
}

function hideLoading() {
  document.getElementById('loading')?.style.setProperty('display', 'none');
}

function showError(message) {
  const tbody = document.getElementById('cardsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-12 text-center text-red-600">
          <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
          <p>${escapeHtml(message)}</p>
        </td>
      </tr>
    `;
  }
}

function formatNumber(value, decimals = 2) {
  const num = Number(value);
  if (isNaN(num)) return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPercent(value, decimals = 1) {
  const num = Number(value);
  if (isNaN(num)) return 'N/A';
  return num.toFixed(decimals);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function openCardDetail(cardId) {
  const offcanvas = document.getElementById('cardDetailOffcanvas');
  const content = document.getElementById('offcanvasContent');
  
  offcanvas.classList.remove('hidden');
  content.innerHTML = `
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span class="ml-4 text-gray-600">Loading card details...</span>
    </div>
  `;
  
  try {
    const response = await fetch(`/api/cards/${cardId}`);
    if (!response.ok) throw new Error('Failed to load card');
    
    const data = await response.json();
    currentCardData = data.card;
    currentHistoryData = data.history || [];
    
    renderOffcanvasContent();
  } catch (error) {
    console.error('Error loading card:', error);
    content.innerHTML = `
      <div class="text-center py-12 text-red-600">
        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
        <p>Failed to load card details. Please try again.</p>
      </div>
    `;
  }
}

function closeCardDetail() {
  const offcanvas = document.getElementById('cardDetailOffcanvas');
  offcanvas.classList.add('hidden');
  currentCardData = null;
  currentHistoryData = null;
}

function renderOffcanvasContent() {
  if (!currentCardData) return;
  
  const content = document.getElementById('offcanvasContent');
  const card = currentCardData;
  
  content.innerHTML = `
    <!-- Header -->
    <div class="mb-6">
      <h3 class="text-3xl font-bold text-gray-900 mb-2">${escapeHtml(card.product_name || 'Unknown Card')}</h3>
      <p class="text-gray-600">${escapeHtml(card.console_name || '')}</p>
    </div>

    <!-- Key Metrics Summary -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <div class="bg-gray-50 rounded-lg p-4">
        <p class="text-sm text-gray-600">Current Price</p>
        <p class="text-xl font-bold text-gray-900">$${formatNumber(card.loose_price)}</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-4">
        <p class="text-sm text-gray-600">PSA 10</p>
        <p class="text-xl font-bold text-purple-700">$${formatNumber(card.psa10_price)}</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-4">
        <p class="text-sm text-gray-600">30d Change</p>
        <p class="text-xl font-bold ${getChangeColor(card.price_change_30d)}">${formatPercent(card.price_change_30d)}%</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-4">
        <p class="text-sm text-gray-600">Trend State</p>
        <p class="text-lg font-bold">${card.trend_state || 'N/A'}</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-4">
        <p class="text-sm text-gray-600">Opportunity</p>
        <p class="text-xl font-bold text-green-600">${Math.round(card.opportunity_score || 0)}</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-4">
        <p class="text-sm text-gray-600">Sales Volume</p>
        <p class="text-xl font-bold text-blue-600">${formatNumber(card.sales_volume, 0)}</p>
      </div>
    </div>

    <!-- 1. Price Intelligence -->
    <div class="bg-white border rounded-lg p-6 mb-6">
      <h4 class="text-lg font-semibold mb-4 flex items-center">
        <i class="fas fa-chart-line text-blue-500 mr-2"></i>Price Intelligence
      </h4>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div>
          <p class="text-sm text-gray-600 mb-1">7-Day Trend Slope</p>
          <p class="text-xl font-bold ${getChangeColor(card.trend_slope_7d)}">${formatPercent(card.trend_slope_7d)}%</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">30-Day Trend Slope</p>
          <p class="text-xl font-bold ${getChangeColor(card.trend_slope_30d)}">${formatPercent(card.trend_slope_30d)}%</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">90-Day Trend Slope</p>
          <p class="text-xl font-bold ${getChangeColor(card.trend_slope_90d)}">${formatPercent(card.trend_slope_90d)}%</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Volatility Regime</p>
          <p class="text-lg font-bold ${getVolatilityColor(card.volatility_regime)}">${card.volatility_regime || 'Unknown'}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Fair Value Deviation</p>
          <p class="text-xl font-bold ${getChangeColor(-1 * card.fair_value_deviation_pct)}">${formatPercent(card.fair_value_deviation_pct)}%</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">30-Day Range</p>
          <p class="text-lg font-bold">$${formatNumber(card.low_30d)} - $${formatNumber(card.high_30d)}</p>
        </div>
      </div>
      <div class="mt-6">
        <canvas id="offcanvasPriceChart" class="chart-container" style="height: 250px;"></canvas>
      </div>
    </div>

    <!-- 2. Liquidity Intelligence -->
    <div class="bg-white border rounded-lg p-6 mb-6">
      <h4 class="text-lg font-semibold mb-4 flex items-center">
        <i class="fas fa-water text-cyan-500 mr-2"></i>Liquidity Intelligence
      </h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p class="text-sm text-gray-600 mb-1">Days to Liquidity</p>
          <p class="text-xl font-bold ${card.days_to_liquidity < 30 ? 'text-green-600' : card.days_to_liquidity < 60 ? 'text-yellow-600' : 'text-red-600'}">${card.days_to_liquidity > 100 ? '100+' : formatNumber(card.days_to_liquidity, 1)}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Weekly Sales Velocity</p>
          <p class="text-xl font-bold">${formatNumber(card.weekly_sales_velocity, 1)}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Liquidity Score</p>
          <p class="text-xl font-bold ${card.liquidity_score >= 0.7 ? 'text-green-600' : card.liquidity_score >= 0.4 ? 'text-yellow-600' : 'text-red-600'}">${Math.round((card.liquidity_score || 0) * 100)}%</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Spread Proxy</p>
          <p class="text-xl font-bold">${formatPercent(card.spread_proxy_pct)}%</p>
        </div>
      </div>
    </div>

    <!-- 3. Grade Intelligence -->
    <div class="bg-white border rounded-lg p-6 mb-6">
      <h4 class="text-lg font-semibold mb-4 flex items-center">
        <i class="fas fa-certificate text-purple-500 mr-2"></i>Grade Intelligence
      </h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p class="text-sm text-gray-600 mb-1">PSA 10 Premium</p>
          <p class="text-xl font-bold ${card.psa10_premium_pct > 100 ? 'text-green-600' : 'text-gray-900'}">${formatPercent(card.psa10_premium_pct)}%</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Grading Expected Value</p>
          <p class="text-xl font-bold ${card.grading_expected_value > 0 ? 'text-green-600' : 'text-red-600'}">$${formatNumber(card.grading_expected_value)}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Raw Price</p>
          <p class="text-xl font-bold">$${formatNumber(card.loose_price)}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">PSA 10 Price</p>
          <p class="text-xl font-bold">$${formatNumber(card.psa10_price)}</p>
        </div>
      </div>
      <div class="mt-6">
        <canvas id="offcanvasPremiumChart" class="chart-container" style="height: 250px;"></canvas>
      </div>
    </div>

    <!-- 4. Opportunity Score -->
    <div class="bg-white border rounded-lg p-6 mb-6">
      <h4 class="text-lg font-semibold mb-4 flex items-center">
        <i class="fas fa-bullseye text-yellow-500 mr-2"></i>Opportunity Score
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="flex items-center justify-center">
          <div class="relative w-40 h-40">
            <svg class="transform -rotate-90 w-40 h-40">
              <circle cx="80" cy="80" r="70" stroke="#e5e7eb" stroke-width="12" fill="none" />
              <circle id="offcanvasOpportunityCircle" cx="80" cy="80" r="70" stroke="#10b981" stroke-width="12" fill="none"
                      stroke-dasharray="439.6" stroke-dashoffset="439.6" stroke-linecap="round" />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-center">
                <div id="offcanvasOpportunityScoreValue" class="text-3xl font-bold">${Math.round(card.opportunity_score || 0)}</div>
                <div class="text-sm text-gray-500">/ 100</div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h5 class="font-semibold mb-3">Score Breakdown</h5>
          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span>Undervaluation (0-30)</span>
                <span id="offcanvasUndervalScore" class="font-semibold">${Math.min(30, Math.max(0, -1 * (card.fair_value_deviation_pct || 0)))}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div id="offcanvasUndervalBar" class="bg-blue-600 h-2 rounded-full" style="width: ${Math.min(100, Math.max(0, -1 * (card.fair_value_deviation_pct || 0)) / 30 * 100)}%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span>Momentum (0-25)</span>
                <span id="offcanvasMomentumScore" class="font-semibold">${Math.min(25, Math.max(0, (card.momentum || 0) * 100))}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div id="offcanvasMomentumBar" class="bg-green-600 h-2 rounded-full" style="width: ${Math.min(100, Math.max(0, (card.momentum || 0) * 100) / 25 * 100)}%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span>Liquidity (0-25)</span>
                <span id="offcanvasLiquidityScore" class="font-semibold">${Math.round((card.liquidity_score || 0) * 25)}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div id="offcanvasLiquidityBar" class="bg-cyan-600 h-2 rounded-full" style="width: ${Math.round((card.liquidity_score || 0) * 100)}%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span>Low Volatility Bonus (0-20)</span>
                <span id="offcanvasVolatilityScore" class="font-semibold">${Math.min(20, Math.max(0, 20 - ((card.price_stddev_30d || 0) / (card.avg_price_30d || 1) * 100)))}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div id="offcanvasVolatilityBar" class="bg-purple-600 h-2 rounded-full" style="width: ${Math.min(100, Math.max(0, 20 - ((card.price_stddev_30d || 0) / (card.avg_price_30d || 1) * 100)) / 20 * 100)}%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. Risk Metrics -->
    <div class="bg-white border rounded-lg p-6 mb-6">
      <h4 class="text-lg font-semibold mb-4 flex items-center">
        <i class="fas fa-shield-alt text-red-500 mr-2"></i>Risk Metrics
      </h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p class="text-sm text-gray-600 mb-1">Drawdown Risk</p>
          <p class="text-xl font-bold ${card.drawdown_risk_pct > 20 ? 'text-red-600' : card.drawdown_risk_pct > 10 ? 'text-yellow-600' : 'text-green-600'}">${formatPercent(card.drawdown_risk_pct)}%</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Trend Break Risk</p>
          <p class="text-lg font-bold ${card.trend_break_risk === 'High' ? 'text-red-600' : card.trend_break_risk === 'Medium' ? 'text-yellow-600' : 'text-green-600'}">${card.trend_break_risk || 'Unknown'}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Data Confidence</p>
          <p class="text-xl font-bold ${card.data_confidence_score >= 80 ? 'text-green-600' : card.data_confidence_score >= 60 ? 'text-yellow-600' : 'text-red-600'}">${card.data_confidence_score || 0}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">Execution Eligible</p>
          <p class="text-lg font-bold ${card.execution_eligible ? 'text-green-600' : 'text-red-600'}">${card.execution_eligible ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>

    <!-- Historical Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white border rounded-lg p-6">
        <h5 class="text-lg font-semibold mb-4">Momentum Trend</h5>
        <canvas id="offcanvasMomentumChart" class="chart-container" style="height: 250px;"></canvas>
      </div>
      <div class="bg-white border rounded-lg p-6">
        <h5 class="text-lg font-semibold mb-4">Liquidity Trend</h5>
        <canvas id="offcanvasLiquidityChart" class="chart-container" style="height: 250px;"></canvas>
      </div>
    </div>
  `;
  
  // Update opportunity gauge
  const score = Math.round(card.opportunity_score || 0);
  const circle = document.getElementById('offcanvasOpportunityCircle');
  const circumference = 439.6;
  const offset = circumference - (score / 100) * circumference;
  circle.style.strokeDashoffset = offset;
  
  let color = '#10b981';
  if (score < 30) color = '#ef4444';
  else if (score < 50) color = '#f59e0b';
  else if (score < 70) color = '#3b82f6';
  circle.style.stroke = color;
  
  // Render charts
  renderOffcanvasCharts();
}

function renderOffcanvasCharts() {
  if (!currentHistoryData || currentHistoryData.length === 0) return;
  
  const labels = currentHistoryData.map(h => new Date(h.date).toLocaleDateString());
  
  // Price History Chart
  new Chart(document.getElementById('offcanvasPriceChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Loose Price',
          data: currentHistoryData.map(h => Number(h.loose_price) || null),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3
        },
        {
          label: '30d Average',
          data: currentHistoryData.map(h => Number(h.avg_price_30d) || null),
          borderColor: '#10b981',
          borderDash: [5, 5],
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: false, title: { display: true, text: 'Price ($)' } } }
    }
  });
  
  // Premium History Chart
  new Chart(document.getElementById('offcanvasPremiumChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'PSA 10 Premium %',
        data: currentHistoryData.map(h => {
          const loose = Number(h.loose_price) || 0;
          const psa10 = Number(h.psa10_price) || 0;
          return loose > 0 && psa10 > 0 ? ((psa10 - loose) / loose * 100) : null;
        }),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Premium (%)' } } }
    }
  });
  
  // Momentum Chart
  new Chart(document.getElementById('offcanvasMomentumChart'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Momentum',
        data: labels.map((label, idx) => ({
          x: label,
          y: (Number(currentHistoryData[idx]?.momentum) || 0) * 100
        })),
        showLine: true,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: {
          type: 'category'
        },
        y: {
          suggestedMin: -50,
          suggestedMax: 50,
          title: { display: true, text: 'Momentum (%)' }
        }
      }
    }
  });
  
  // Liquidity Chart
  new Chart(document.getElementById('offcanvasLiquidityChart'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Liquidity Score',
        data: labels.map((label, idx) => ({
          x: label,
          y: (Number(currentHistoryData[idx]?.liquidity_score) || 0) * 100
        })),
        showLine: true,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: {
          type: 'category'
        },
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          title: { display: true, text: 'Score (%)' }
        }
      }
    }
  });
}

function getChangeColor(value) {
  const num = Number(value) || 0;
  if (num > 0) return 'text-green-600';
  if (num < 0) return 'text-red-600';
  return 'text-gray-600';
}

function getVolatilityColor(regime) {
  if (regime && regime.includes('Low')) return 'text-green-600';
  if (regime && regime.includes('Medium')) return 'text-yellow-600';
  if (regime && regime.includes('High')) return 'text-red-600';
  return 'text-gray-600';
}

function updateHeaderSortIcons() {
  const columns = ['product_name', 'loose_price', 'opportunity_score', 'trend_state', 'momentum', 'liquidity_score', 'volatility_regime'];
  columns.forEach(col => {
    const icon = document.getElementById(`sort-icon-${col}`);
    if (!icon) return;
    if (sortColumn === col) {
      icon.className = sortDirection === 'asc' ? 'fas fa-sort-up ml-1 text-blue-600' : 'fas fa-sort-down ml-1 text-blue-600';
    } else {
      icon.className = 'fas fa-sort ml-1 text-gray-400';
    }
  });
}

function sortAndRenderCards() {
  currentCards.sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];
    if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
    if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;

    if (typeof aVal === 'string' && !isNaN(aVal)) aVal = parseFloat(aVal);
    if (typeof bVal === 'string' && !isNaN(bVal)) bVal = parseFloat(bVal);

    if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  renderCardsTable(currentCards);
  updateHeaderSortIcons();
}

function sortBy(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = column === 'product_name' || column === 'trend_state' || column === 'volatility_regime' ? 'asc' : 'desc';
  }
  sortAndRenderCards();
}

// Make functions globally available
window.previousPage = previousPage;
window.nextPage = nextPage;
window.openCardDetail = openCardDetail;
window.closeCardDetail = closeCardDetail;
window.sortBy = sortBy;
