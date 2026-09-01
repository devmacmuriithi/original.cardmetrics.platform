// Market Efficiency JavaScript

let currentData = [];
let totalRecords = 0;
let currentPage = 1;
const recordsPerPage = 100;
let sortColumn = 'efficiency_variance';
let sortDirection = 'desc';

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

async function loadData(page = 1) {
    window.uiStates?.renderLoadingState('dataContainer', 'Loading market efficiency...');

    try {
        const searchPlayer = document.getElementById('searchPlayer').value;
        const marketSignal = document.getElementById('marketSignal').value;
        const efficiency = document.getElementById('efficiency').value;
        const liquidity = document.getElementById('liquidity').value;
        
        const offset = (page - 1) * recordsPerPage;
        const params = new URLSearchParams({
            limit: recordsPerPage,
            offset: offset
        });
        
        if (searchPlayer) params.append('search', searchPlayer);
        if (marketSignal) params.append('signal', marketSignal);
        if (efficiency) params.append('efficiency', efficiency);
        if (liquidity) params.append('liquidity', liquidity);
        
        const response = await fetch(`/api/intelligence/market-efficiency?${params}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        currentData = result.data;
        totalRecords = result.total;
        currentPage = page;
        
        renderTable();
        renderPagination();
    } catch (error) {
        console.error('Error loading market efficiency:', error);
        window.uiStates?.renderErrorState('dataContainer', 'Error loading market efficiency data. Please try again.', 'loadData');
    }
}

function applyFilters() {
    currentPage = 1;
    loadData(1);
}

function resetFilters() {
    document.getElementById('searchPlayer').value = '';
    document.getElementById('marketSignal').value = '';
    document.getElementById('efficiency').value = '';
    document.getElementById('liquidity').value = '';
    currentPage = 1;
    loadData(1);
}

function renderTable() {
    const start = (currentPage - 1) * recordsPerPage + 1;
    const end = Math.min(currentPage * recordsPerPage, totalRecords);
    document.getElementById('resultCount').textContent = `${start}-${end} of ${totalRecords}`;
    
    if (currentData.length === 0) {
        window.uiStates?.renderEmptyState('dataContainer', 'No cards found matching your criteria.');
        return;
    }
    
    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('player_name')" title="Card name and player. Pulled from product_name in the cards table.">
                            Card <i class="fas ${getSortIcon('player_name')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('gem_rate_pct')" title="Gem rate percentage. Step 1: Count PSA 10 submissions. Step 2: Divide by total submissions. Step 3: Higher % = better grading odds.">
                            Gem Rate <i class="fas ${getSortIcon('gem_rate_pct')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('actual_multiplier')" title="Actual grading premium observed. Calculation: PSA10_price / raw_price. Shows real market multiplier.">
                            Actual Premium <i class="fas ${getSortIcon('actual_multiplier')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Expected premium based on gem rate. Step 1: Lookup typical premium for this gem rate tier. Step 2: Compare to actual. Shows if market is over/under-pricing.">Expected</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('efficiency_variance')" title="Premium variance. Calculation: Actual_premium - Expected_premium. Positive = market paying more than expected (sell signal). Negative = undervalued (buy signal).">
                            Variance <i class="fas ${getSortIcon('efficiency_variance')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Premium efficiency rating. High = actual premium exceeds expected given gem rate; Low = underperforming.">Efficiency</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Trade signal based on variance. Overpriced = actual > expected (consider selling). Underpriced = actual < expected (consider buying). Fair = near expected.">Signal</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('liquidity_tier')" title="Liquidity level. High = frequent sales and good volume; Medium = moderate; Low = rare sales or thin market.">
                            Liquidity <i class="fas ${getSortIcon('liquidity_tier')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Quick actions: View card detail, add to watchlist, or analyze further.">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">`;
    
    currentData.forEach(card => {
        const detailHref = card.card_id || card.id ? `/card-detail/${card.card_id || card.id}` : '';
        const efficiencyColor = {
            'Efficient': 'bg-green-100 text-green-800',
            'Overpriced': 'bg-red-100 text-red-800',
            'Underpriced': 'bg-blue-100 text-blue-800'
        }[card.pricing_efficiency] || 'bg-gray-100 text-gray-800';
        
        const signalColor = {
            'Strong Buy Signal': 'text-green-700 font-bold',
            'Buy Signal': 'text-green-600',
            'Hold': 'text-gray-600',
            'Sell Signal': 'text-red-600'
        }[card.market_signal] || 'text-gray-600';
        
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">${card.player_name}</div>
                    <div class="text-sm text-gray-500">${card.parallel}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">${card.gem_rate_pct}%</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">${card.actual_multiplier}x</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">${card.expected_multiplier}x</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <span class="text-sm font-semibold ${card.efficiency_variance > 0 ? 'text-red-600' : 'text-green-600'}">
                        ${card.efficiency_variance > 0 ? '+' : ''}${card.efficiency_variance}x
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${efficiencyColor}">
                        ${card.pricing_efficiency}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm ${signalColor}">${card.market_signal}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${card.liquidity_tier}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    ${detailHref
                        ? `<a href="${detailHref}" class="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 mr-2"><i class="fas fa-chart-line mr-1"></i>Detail</a>`
                        : `<span class="inline-flex items-center px-2 py-1 bg-gray-200 text-gray-500 text-xs rounded mr-2">No Detail</span>`}
                    <a href="/opportunities" class="inline-flex items-center px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"><i class="fas fa-bullseye mr-1"></i>Opps</a>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
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
        sortDirection = column === 'player_name' || column === 'liquidity_tier' ? 'asc' : 'desc';
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
