// Investment Opportunities JavaScript

let currentData = [];
let totalRecords = 0;
let currentPage = 1;
const recordsPerPage = 50;
let sortColumn = 'investment_score';
let sortDirection = 'desc';

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Initialize autocomplete for player search
    initAutocomplete('searchPlayer', '/api/autocomplete/players', (selectedPlayer) => {
        // Optionally auto-apply filters when player is selected
        // applyFilters();
    });
    
    document.getElementById('searchPlayer').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
});

// Load opportunities data
async function loadData(page = 1) {
    window.uiStates?.renderLoadingState('dataContainer', 'Loading opportunities...');

    try {
        const searchPlayer = document.getElementById('searchPlayer').value;
        const minScore = parseFloat(document.getElementById('minScore').value) || 0;
        const opportunityType = document.getElementById('opportunityType').value;
        const riskLevel = document.getElementById('riskLevel').value;
        
        const offset = (page - 1) * recordsPerPage;
        const params = new URLSearchParams({
            limit: recordsPerPage,
            offset: offset,
            minScore: minScore
        });
        
        if (searchPlayer) params.append('search', searchPlayer);
        if (opportunityType) params.append('opportunityType', opportunityType);
        if (riskLevel) params.append('riskLevel', riskLevel);
        
        const response = await fetch(`/api/intelligence/opportunities?${params}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        currentData = result.data;
        totalRecords = result.total;
        currentPage = page;
        
        renderTable();
        renderPagination();
    } catch (error) {
        console.error('Error loading opportunities:', error);
        window.uiStates?.renderErrorState('dataContainer', 'Error loading opportunities. Please try again.', 'loadData');
    }
}

// Apply filters
function applyFilters() {
    currentPage = 1;
    loadData(1);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchPlayer').value = '';
    document.getElementById('minScore').value = '0';
    document.getElementById('opportunityType').value = '';
    document.getElementById('riskLevel').value = '';
    
    currentPage = 1;
    loadData(1);
}

// Render table
function renderTable() {
    const start = (currentPage - 1) * recordsPerPage + 1;
    const end = Math.min(currentPage * recordsPerPage, totalRecords);
    document.getElementById('resultCount').textContent = `${start}-${end} of ${totalRecords}`;
    
    if (currentData.length === 0) {
        window.uiStates?.renderEmptyState('dataContainer', 'No opportunities found matching your criteria.');
        return;
    }
    
    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('investment_score')" title="Rank by composite investment score (0-100). Step 1: Calculate grade upside (PSA10 - raw). Step 2: Weight by gem rate. Step 3: Adjust for momentum and liquidity. Step 4: Normalize to 0-100.">
                            Rank / Score <i class="fas ${getSortIcon('investment_score')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('player_name')" title="Card name and player. Pulled from product_name in the cards table.">
                            Card <i class="fas ${getSortIcon('player_name')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Card category: Base, Parallel, Insert, or Auto. Pulled from card_type field.">Type</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('loose_price')" title="Current ungraded (raw) market price. Latest sale_price from card_sales where condition = 'ungraded'.">
                            Raw Price <i class="fas ${getSortIcon('loose_price')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('bgs_10_price')" title="PSA 10 graded market price. Latest sale_price from card_sales where condition = 'PSA10' or from psa10_price field.">
                            PSA 10 <i class="fas ${getSortIcon('bgs_10_price')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('grade_premium_multiplier')" title="Grading premium multiple. Calculation: PSA10_price / raw_price. Shows how many times more a graded card is worth.">
                            Premium <i class="fas ${getSortIcon('grade_premium_multiplier')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('gem_rate_pct')" title="Gem rate percentage. Step 1: Count PSA 10 submissions. Step 2: Divide by total submissions. Step 3: Higher % = better grading odds.">
                            Gem Rate <i class="fas ${getSortIcon('gem_rate_pct')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('momentum_pct')" title="7-day price momentum %. Step 1: Calculate 7d % change. Step 2: Weight by sales volume. Step 3: Normalize to show directional strength.">
                            Momentum <i class="fas ${getSortIcon('momentum_pct')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Quick actions: View card detail, add to watchlist, or analyze further.">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    currentData.forEach((opp, index) => {
        const globalIndex = (currentPage - 1) * recordsPerPage + index;
        const typeClass = opp.opportunity_type.toLowerCase().replace(/\s+/g, '-');
        const detailHref = opp.card_id || opp.id ? `/card-detail/${opp.card_id || opp.id}` : '';
        const typeColor = {
            'grading-arbitrage': 'bg-yellow-100 text-yellow-800',
            'rising-star': 'bg-green-100 text-green-800',
            'undervalued-gem': 'bg-purple-100 text-purple-800',
            'improving-quality': 'bg-blue-100 text-blue-800',
            'standard-opportunity': 'bg-gray-100 text-gray-800'
        }[typeClass] || 'bg-gray-100 text-gray-800';
        
        const riskColor = {
            'High Risk': 'text-red-600',
            'Medium Risk': 'text-yellow-600',
            'Low Risk': 'text-green-600'
        }[opp.risk_level] || 'text-gray-600';
        
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">#${globalIndex + 1}</div>
                    <div class="text-lg font-bold text-blue-600">${opp.investment_score}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">${opp.player_name}</div>
                    <div class="text-sm text-gray-500">${opp.parallel} #${opp.card_number}</div>
                    <div class="text-xs ${riskColor} font-semibold mt-1">${opp.risk_level}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${typeColor}">
                        ${opp.opportunity_type}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">$${opp.loose_price}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">$${opp.bgs_10_price}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <span class="text-sm font-semibold text-green-600">${opp.grade_premium_multiplier}x</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <span class="text-sm ${opp.gem_rate_pct < 20 ? 'text-red-600 font-semibold' : 'text-gray-900'}">${opp.gem_rate_pct}%</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <span class="text-sm ${opp.momentum_pct > 0 ? 'text-green-600' : opp.momentum_pct < 0 ? 'text-red-600' : 'text-gray-500'}">
                        ${opp.momentum_pct != null ? (opp.momentum_pct > 0 ? '+' : '') + opp.momentum_pct + '%' : 'N/A'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    ${detailHref
                        ? `<a href="${detailHref}" class="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 mx-1"><i class="fas fa-chart-line mr-1"></i>Detail</a>`
                        : `<span class="inline-flex items-center px-2 py-1 bg-gray-200 text-gray-500 text-xs rounded mx-1">No Detail</span>`}
                    <a href="/grading" class="inline-flex items-center px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 mx-1"><i class="fas fa-certificate mr-1"></i>Grading</a>
                    <a href="${opp.gemrate_url || '#'}" target="_blank" class="text-blue-600 hover:text-blue-800 mx-1 ${opp.gemrate_url ? '' : 'opacity-40 pointer-events-none'}" title="GemRate">
                        <i class="fas fa-chart-bar"></i>
                    </a>
                    <a href="${opp.cardladder_all_graded_url || '#'}" target="_blank" class="text-green-600 hover:text-green-800 mx-1 ${opp.cardladder_all_graded_url ? '' : 'opacity-40 pointer-events-none'}" title="CardLadder">
                        <i class="fas fa-dollar-sign"></i>
                    </a>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    document.getElementById('dataContainer').innerHTML = html;
}

function renderPagination() {
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    if (totalPages <= 1) return;
    
    let paginationHTML = '<div class="flex justify-center items-center space-x-2 mt-6">';
    
    paginationHTML += `
        <button onclick="loadData(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}
                class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
            <i class="fas fa-chevron-left"></i> Previous
        </button>
    `;
    
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="loadData(${i})" 
                    class="px-4 py-2 rounded ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}">
                ${i}
            </button>
        `;
    }
    
    paginationHTML += `
        <button onclick="loadData(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}
                class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationHTML += '</div>';
    
    const paginationContainer = document.getElementById('dataContainer');
    paginationContainer.innerHTML += paginationHTML;
}

function getSortIcon(column) {
    if (sortColumn !== column) return 'fa-sort text-gray-400';
    return sortDirection === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600';
}

function sortBy(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = column === 'player_name' ? 'asc' : 'desc';
    }
    
    currentData.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
        if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
        
        if (typeof aVal === 'string' && !isNaN(aVal)) aVal = parseFloat(aVal);
        if (typeof bVal === 'string' && !isNaN(bVal)) bVal = parseFloat(bVal);
        
        if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    renderTable();
}
