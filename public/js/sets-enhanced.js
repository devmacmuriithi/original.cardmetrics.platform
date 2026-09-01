// Enhanced Sets Page with Comprehensive Metric Intelligence
let currentPage = 0;
const pageSize = 50;
let currentFilters = {};
let currentSets = [];
let sortColumn = 'opportunity_score';
let sortDirection = 'desc';

document.addEventListener('DOMContentLoaded', () => {
  loadSets();
  attachEventListeners();
});

function attachEventListeners() {
  document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);
  
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
    minOpportunity: document.getElementById('minOpportunityFilter')?.value || ''
  };
  currentPage = 0;
  loadSets();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('trendStateFilter').value = '';
  document.getElementById('minLiquidityFilter').value = '';
  document.getElementById('minOpportunityFilter').value = '';
  currentFilters = {};
  currentPage = 0;
  loadSets();
}

async function loadSets() {
  showLoading();
  
  try {
    const params = new URLSearchParams({
      limit: pageSize,
      offset: currentPage * pageSize,
      ...currentFilters
    });
    
    const response = await fetch(`/api/sets?${params}`);
    if (!response.ok) throw new Error('Failed to load sets');
    
    const data = await response.json();
    currentSets = data.sets || [];
    sortAndRenderSets();
    renderPagination(data.total || 0, currentPage, pageSize);
  } catch (error) {
    console.error('Error loading sets:', error);
    showError('Failed to load sets. Please try again.');
  } finally {
    hideLoading();
  }
}

function renderSetsTable(sets) {
  const tbody = document.getElementById('setsTableBody');
  if (!tbody) return;
  
  if (sets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-12 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-4"></i>
          <p>No sets found matching your filters</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = sets.map(set => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4">
        <div class="text-sm font-medium text-gray-900">${escapeHtml(set.console_name || 'Unknown')}</div>
        <div class="text-sm text-gray-500">${escapeHtml(set.name || '')}</div>
      </td>
      <td class="px-6 py-4 text-right">
        <div class="text-sm font-bold text-gray-900">$${formatNumber(set.avg_price)}</div>
        <div class="text-xs text-gray-500">Range: $${formatNumber(set.min_price)} - $${formatNumber(set.max_price)}</div>
      </td>
      <td class="px-6 py-4 text-center">
        <div class="text-sm font-semibold">${formatNumber(set.card_count, 0)}</div>
        <div class="text-xs text-gray-500">Vol: ${formatNumber(set.total_volume, 0)}</div>
      </td>
      <td class="px-6 py-4 text-center">
        ${renderOpportunityScore(set.opportunity_score)}
      </td>
      <td class="px-6 py-4 text-center">
        ${renderTrendBadge(set.set_trend)}
        <div class="text-xs text-gray-500 mt-1">
          <span class="text-green-600">${set.rising_count || 0}↑</span> / 
          <span class="text-red-600">${set.declining_count || 0}↓</span>
        </div>
      </td>
      <td class="px-6 py-4 text-center">
        ${renderMomentumIndicator(set.avg_momentum)}
      </td>
      <td class="px-6 py-4 text-center">
        ${renderLiquidityScore(set.avg_liquidity)}
      </td>
      <td class="px-6 py-4 text-center">
        ${renderRiskBadge(set.risk_score)}
      </td>
      <td class="px-6 py-4 text-center">
        <a href="/set-detail/${set.id}" class="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">
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
    'Mixed': { color: 'bg-gray-100 text-gray-800', icon: 'fa-minus' },
    'Declining': { color: 'bg-red-100 text-red-800', icon: 'fa-arrow-trend-down' }
  };
  
  const config = trendMap[trend] || trendMap['Mixed'];
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

function renderRiskBadge(riskScore) {
  const value = Number(riskScore) || 0;
  let colorClass = 'bg-green-100 text-green-800';
  let text = 'Low';
  
  if (value > 25) {
    colorClass = 'bg-red-100 text-red-800';
    text = 'High';
  } else if (value > 15) {
    colorClass = 'bg-yellow-100 text-yellow-800';
    text = 'Med';
  }
  
  return `
    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colorClass}">
      ${text}
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
      Showing <span class="font-medium">${start}</span> to <span class="font-medium">${end}</span> of <span class="font-medium">${total}</span> sets
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
    loadSets();
  }
}

function nextPage() {
  currentPage++;
  loadSets();
}

function showLoading() {
  document.getElementById('loading')?.style.setProperty('display', 'flex');
}

function hideLoading() {
  document.getElementById('loading')?.style.setProperty('display', 'none');
}

function showError(message) {
  const tbody = document.getElementById('setsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-12 text-center text-red-600">
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateHeaderSortIcons() {
  const columns = ['console_name', 'avg_price', 'card_count', 'opportunity_score', 'set_trend', 'avg_momentum', 'avg_liquidity', 'risk_score'];
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

function sortAndRenderSets() {
  currentSets.sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];
    if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
    if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;

    if (typeof aVal === 'string' && !isNaN(aVal)) aVal = parseFloat(aVal);
    if (typeof bVal === 'string' && !isNaN(bVal)) bVal = parseFloat(bVal);

    if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  renderSetsTable(currentSets);
  updateHeaderSortIcons();
}

function sortBy(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = column === 'console_name' || column === 'set_trend' ? 'asc' : 'desc';
  }
  sortAndRenderSets();
}

window.previousPage = previousPage;
window.nextPage = nextPage;
window.sortBy = sortBy;
