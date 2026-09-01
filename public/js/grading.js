// Grading Intelligence JavaScript

let currentData = [];
let totalRecords = 0;
let currentPage = 1;
const recordsPerPage = 100;
let sortColumn = 'expected_value';
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
    window.uiStates?.renderLoadingState('dataContainer', 'Loading grading intelligence...');

    try {
        const searchPlayer = document.getElementById('searchPlayer').value;
        const minEV = parseFloat(document.getElementById('minEV').value) || 0;
        const difficulty = document.getElementById('difficulty').value;
        const recommendation = document.getElementById('recommendation').value;
        
        const offset = (page - 1) * recordsPerPage;
        const params = new URLSearchParams({
            limit: recordsPerPage,
            offset: offset,
            minExpectedValue: minEV
        });
        
        if (searchPlayer) params.append('search', searchPlayer);
        if (difficulty) params.append('difficulty', difficulty);
        if (recommendation) params.append('recommendation', recommendation);
        
        const response = await fetch(`/api/intelligence/grading?${params}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        currentData = result.data;
        totalRecords = result.total;
        currentPage = page;
        
        renderTable();
        renderPagination();
    } catch (error) {
        console.error('Error loading grading intelligence:', error);
        window.uiStates?.renderErrorState('dataContainer', 'Error loading grading intelligence. Please try again.', 'loadData');
    }
}

function applyFilters() {
    currentPage = 1;
    loadData(1);
}

function resetFilters() {
    document.getElementById('searchPlayer').value = '';
    document.getElementById('minEV').value = '0';
    document.getElementById('difficulty').value = '';
    document.getElementById('recommendation').value = '';
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
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('grading_difficulty')" title="Grading difficulty classification. Based on gem rate: Easy (>70%), Moderate (40-70%), Difficult (20-40%), Very Difficult (<20%).">
                            Difficulty <i class="fas ${getSortIcon('grading_difficulty')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('gem_rate_pct')" title="Gem rate percentage. Step 1: Count PSA 10 submissions. Step 2: Divide by total submissions. Step 3: Higher % = better grading odds.">
                            Gem Rate <i class="fas ${getSortIcon('gem_rate_pct')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('expected_value')" title="Expected value after grading. Step 1: (Gem_rate * PSA10_price) + ((1 - Gem_rate) * PSA9_price). Step 2: Subtract grading cost (~$20).">
                            Expected Value <i class="fas ${getSortIcon('expected_value')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('net_profit_if_gem')" title="Profit if card gems (gets PSA 10). Calculation: PSA10_price - raw_price - grading_cost. Shows upside in best-case scenario.">
                            If Gem Profit <i class="fas ${getSortIcon('net_profit_if_gem')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('grading_recommendation')" title="Investment recommendation. Strong Buy = high expected value + high gem rate; Hold = marginal; Avoid = low gem rate or negative expected value.">
                            Recommendation <i class="fas ${getSortIcon('grading_recommendation')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('grading_trend')" title="Price trend over last 30 days. Rising = price up >5%, Stable = +/-5%, Declining = down >5%.">
                            Trend <i class="fas ${getSortIcon('grading_trend')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Quick actions: View card detail, add to watchlist, or analyze further.">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">`;
    
    currentData.forEach(card => {
        const detailHref = card.card_id || card.id ? `/card-detail/${card.card_id || card.id}` : '';
        const difficultyColor = {
            'Extremely Difficult': 'bg-red-100 text-red-800',
            'Very Difficult': 'bg-orange-100 text-orange-800',
            'Difficult': 'bg-yellow-100 text-yellow-800',
            'Moderate': 'bg-blue-100 text-blue-800',
            'Easy': 'bg-green-100 text-green-800'
        }[card.grading_difficulty] || 'bg-gray-100 text-gray-800';
        
        const recColor = {
            'Strong Buy for Grading': 'text-green-700 font-semibold',
            'Good Grading Candidate': 'text-green-600',
            'Marginal': 'text-yellow-600',
            'Not Recommended': 'text-red-600'
        }[card.grading_recommendation] || 'text-gray-600';
        
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">${card.player_name}</div>
                    <div class="text-sm text-gray-500">${card.parallel} #${card.card_number}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${difficultyColor}">
                        ${card.grading_difficulty}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-semibold text-gray-900">${card.gem_rate_pct}%</div>
                    <div class="text-xs text-gray-500">${card.total_graded} graded</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <span class="text-lg font-bold ${card.expected_value > 30 ? 'text-green-600' : card.expected_value > 10 ? 'text-blue-600' : 'text-gray-900'}">
                        $${card.expected_value}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">$${card.net_profit_if_gem}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm ${recColor}">${card.grading_recommendation}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${
                        card.grading_trend === 'Surging' || card.grading_trend === 'Hot' ? 'bg-green-100 text-green-800' :
                        card.grading_trend === 'Rising' ? 'bg-blue-100 text-blue-800' :
                        card.grading_trend === 'Cooling' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                    }">
                        ${card.grading_trend}
                    </span>
                </td>
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
    
    // Previous button
    paginationHTML += `
        <button onclick="loadData(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}
                class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
            <i class="fas fa-chevron-left"></i> Previous
        </button>
    `;
    
    // Page numbers
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
    
    // Next button
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
        sortDirection = column === 'player_name' || column === 'grading_difficulty' || column === 'grading_recommendation' || column === 'grading_trend' ? 'asc' : 'desc';
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
