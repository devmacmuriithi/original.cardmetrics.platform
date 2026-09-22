// Top Movers JavaScript

let allData = [];
let filteredData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    document.getElementById('searchCard').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
});

async function loadData() {
    window.uiStates?.renderLoadingState('dataContainer', 'Loading top movers...');

    try {
        const response = await fetch('/api/cards/top-movers?limit=100');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allData = await response.json();
        filteredData = allData;
        renderTable();
    } catch (error) {
        console.error('Error loading top movers:', error);
        window.uiStates?.renderErrorState('dataContainer', 'Error loading top movers. Please try again.', 'loadData');
    }
}

function applyFilters() {
    const searchCard = document.getElementById('searchCard').value.toLowerCase();
    const movementType = document.getElementById('movementType').value;
    const minChange = parseFloat(document.getElementById('minChange').value) || 0;
    const minVolume = parseFloat(document.getElementById('minVolume').value) || 0;
    
    filteredData = allData.filter(item => {
        const matchesSearch = !searchCard || item.product_name.toLowerCase().includes(searchCard);
        const matchesMovement = !movementType || 
            (movementType === 'gainers' && item.price_change_pct > 0) ||
            (movementType === 'losers' && item.price_change_pct < 0);
        const matchesChange = Math.abs(item.price_change_pct) >= minChange;
        const matchesVolume = item.sales_volume >= minVolume;
        
        return matchesSearch && matchesMovement && matchesChange && matchesVolume;
    });
    
    renderTable();
}

function resetFilters() {
    document.getElementById('searchCard').value = '';
    document.getElementById('movementType').value = '';
    document.getElementById('minChange').value = '0';
    document.getElementById('minVolume').value = '0';
    filteredData = allData;
    renderTable();
}

function renderTable() {
    document.getElementById('resultCount').textContent = filteredData.length;
    
    if (filteredData.length === 0) {
        window.uiStates?.renderEmptyState('dataContainer', 'No cards found matching your criteria.');
        return;
    }
    
    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('product_name')" title="Card name and player. Pulled from product_name in the cards table.">
                            Card <i class="fas ${getSortIcon('product_name')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Card set name. Pulled from console_name in card_sets table.">
                            Set
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('price_change_pct')" title="30-day % price change. Calculation: (latest_price - price_30d_ago) / price_30d_ago * 100.">
                            Change % <i class="fas ${getSortIcon('price_change_pct')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('loose_price')" title="Current ungraded market price. Latest sale_price from card_sales where condition = 'ungraded'.">
                            Current Price <i class="fas ${getSortIcon('loose_price')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('sales_volume')" title="Number of recorded sales in the last 90 days from card_sales table.">
                            Volume <i class="fas ${getSortIcon('sales_volume')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Quick actions: View card detail, add to watchlist, or analyze further.">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">`;
    
    filteredData.forEach(card => {
        const pct = typeof card.price_change_pct === 'number' ? card.price_change_pct : parseFloat(card.price_change_pct || 0);
        const changeClass = pct >= 0 ? 'text-green-600' : 'text-red-600';
        const changeIcon = pct >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const detailHref = card.card_id || card.id ? `/card-detail/${card.card_id || card.id}` : '';
        const loosePrice = typeof card.loose_price === 'number' ? card.loose_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (parseFloat(card.loose_price || 0)).toFixed(2);
        const salesVolume = (card.sales_volume || 0).toLocaleString();
        
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">${card.product_name || 'Card'}</div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">${card.console_name || 'Set'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <span class="${changeClass} font-bold text-lg flex items-center justify-end">
                        <i class="fas ${changeIcon} mr-1"></i>
                        ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                    $${loosePrice}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    ${salesVolume}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    ${detailHref
                        ? `<a href="${detailHref}" class="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 mr-2"><i class="fas fa-chart-line mr-1"></i>Detail</a>`
                        : `<span class="inline-flex items-center px-2 py-1 bg-gray-200 text-gray-500 text-xs rounded mr-2">No Detail</span>`}
                    <a href="/cards" class="inline-flex items-center px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"><i class="fas fa-th-large mr-1"></i>Cards</a>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    document.getElementById('dataContainer').innerHTML = html;
}

let sortColumn = 'price_change_pct';
let sortDirection = 'desc';

function getSortIcon(column) {
    if (sortColumn !== column) return 'fa-sort text-gray-400';
    return sortDirection === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600';
}

function sortBy(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = column === 'product_name' ? 'asc' : 'desc';
    }
    
    filteredData.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
        if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
        if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    renderTable();
}
