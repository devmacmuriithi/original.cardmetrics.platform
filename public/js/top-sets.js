// Top Sets JavaScript

let allData = [];
let filteredData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    document.getElementById('searchSet').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
});

async function loadData() {
    window.uiStates?.renderLoadingState('dataContainer', 'Loading top sets...');

    try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        allData = data.topSets || [];
        filteredData = allData;
        renderTable();
    } catch (error) {
        console.error('Error loading top sets:', error);
        window.uiStates?.renderErrorState('dataContainer', 'Error loading top sets. Please try again.', 'loadData');
    }
}

function applyFilters() {
    const searchSet = document.getElementById('searchSet').value.toLowerCase();
    const minCards = parseInt(document.getElementById('minCards').value) || 0;
    const minAvgPrice = parseFloat(document.getElementById('minAvgPrice').value) || 0;
    const minVolume = parseInt(document.getElementById('minVolume').value) || 0;
    
    filteredData = allData.filter(item => {
        const matchesSearch = !searchSet || item.console_name.toLowerCase().includes(searchSet);
        const matchesCards = item.card_count >= minCards;
        const matchesPrice = item.avg_price >= minAvgPrice;
        const matchesVolume = item.total_volume >= minVolume;
        
        return matchesSearch && matchesCards && matchesPrice && matchesVolume;
    });
    
    renderTable();
}

function resetFilters() {
    document.getElementById('searchSet').value = '';
    document.getElementById('minCards').value = '0';
    document.getElementById('minAvgPrice').value = '0';
    document.getElementById('minVolume').value = '0';
    filteredData = allData;
    renderTable();
}

function renderTable() {
    document.getElementById('resultCount').textContent = filteredData.length;
    
    if (filteredData.length === 0) {
        window.uiStates?.renderEmptyState('dataContainer', 'No sets found matching your criteria.');
        return;
    }
    
    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('console_name')" title="Card set name. Pulled from console_name in card_sets table.">
                            Set Name <i class="fas ${getSortIcon('console_name')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('card_count')" title="Total number of cards tracked in this set. Count of rows in cards table linked by console_id.">
                            Cards <i class="fas ${getSortIcon('card_count')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('avg_price')" title="Average ungraded price across all cards in this set. Calculation: SUM(loose_price) / COUNT(cards) where loose_price > 0.">
                            Avg Price <i class="fas ${getSortIcon('avg_price')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('total_volume')" title="Total number of sales transactions across all cards in this set in the last 90 days.">
                            Total Volume <i class="fas ${getSortIcon('total_volume')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Estimated total market value of the set. Calculation: card_count * avg_price. Represents approximate total value of all tracked cards in the set.">
                            Market Value
                        </th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Quick actions: View set detail, see all cards in set, or add to watchlist.">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">`;
    
    filteredData.forEach(set => {
        const marketValue = (set.avg_price * set.card_count).toFixed(2);
        const setId = set.set_id || set.id;
        
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">${set.console_name}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    ${set.card_count.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                    $${set.avg_price}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <span class="text-sm font-bold text-purple-600">
                        ${set.total_volume.toLocaleString()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                    $${parseFloat(marketValue).toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    ${setId
                        ? `<a href="/set-detail/${setId}" class="inline-flex items-center px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 mr-2"><i class="fas fa-chart-line mr-1"></i>Detail</a>`
                        : `<span class="inline-flex items-center px-2 py-1 bg-gray-200 text-gray-500 text-xs rounded mr-2">No Detail</span>`}
                    <a href="/sets" class="inline-flex items-center px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"><i class="fas fa-layer-group mr-1"></i>Sets</a>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    document.getElementById('dataContainer').innerHTML = html;
}

let sortColumn = 'total_volume';
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
        sortDirection = column === 'console_name' ? 'asc' : 'desc';
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
