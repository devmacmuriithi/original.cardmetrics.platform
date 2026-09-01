// Player Profiles JavaScript

let allData = [];
let filteredData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    document.getElementById('searchPlayer').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
});

async function loadData() {
    window.uiStates?.renderLoadingState('dataContainer', 'Loading player profiles...');

    try {
        const response = await fetch('/api/intelligence/player-profiles?limit=500');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        // Handle both old and new API response formats
        allData = result.data || result;
        filteredData = allData;
        renderTable();
    } catch (error) {
        console.error('Error loading player profiles:', error);
        window.uiStates?.renderErrorState('dataContainer', 'Error loading player profiles. Please try again.', 'loadData');
    }
}

function applyFilters() {
    const searchPlayer = document.getElementById('searchPlayer').value.toLowerCase();
    const marketTier = document.getElementById('marketTier').value;
    const gradingProfile = document.getElementById('gradingProfile').value;
    const investmentRating = document.getElementById('investmentRating').value;
    
    filteredData = allData.filter(item => {
        const matchesPlayer = !searchPlayer || item.player_name.toLowerCase().includes(searchPlayer);
        const matchesTier = !marketTier || item.market_tier === marketTier;
        const matchesProfile = !gradingProfile || item.grading_profile === gradingProfile;
        const matchesRating = !investmentRating || item.investment_rating === investmentRating;
        return matchesPlayer && matchesTier && matchesProfile && matchesRating;
    });
    renderTable();
}

function quickFilterPlayer(playerName) {
    const input = document.getElementById('searchPlayer');
    if (!input) return;
    input.value = playerName || '';
    applyFilters();
}

function resetFilters() {
    document.getElementById('searchPlayer').value = '';
    document.getElementById('marketTier').value = '';
    document.getElementById('gradingProfile').value = '';
    document.getElementById('investmentRating').value = '';
    filteredData = allData;
    renderTable();
}

function renderTable() {
    document.getElementById('resultCount').textContent = filteredData.length;
    
    if (filteredData.length === 0) {
        window.uiStates?.renderEmptyState('dataContainer', 'No players found matching your criteria.');
        return;
    }
    
    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('player_name')" title="Player name. Pulled from player_name field across all cards for this player.">
                            Player <i class="fas ${getSortIcon('player_name')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('total_parallels')" title="Number of parallel card variations tracked for this player. Count of distinct card_type entries.">
                            Parallels <i class="fas ${getSortIcon('total_parallels')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('total_cards_graded')" title="Total PSA-graded cards for this player across all variations. Sum of population counts from PSA data.">
                            Total Graded <i class="fas ${getSortIcon('total_cards_graded')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('avg_gem_rate_pct')" title="Average gem rate across all player cards. Step 1: Sum PSA 10 counts. Step 2: Divide by total graded. Step 3: Average across all card variations.">
                            Avg Gem Rate <i class="fas ${getSortIcon('avg_gem_rate_pct')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Overall grading difficulty for this player's cards. Based on avg gem rate: Easy (>70%), Moderate (40-70%), Difficult (20-40%), Very Difficult (<20%).">Difficulty</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('avg_grade_premium')" title="Average grading premium across player cards. Calculation: AVG(PSA10_price / raw_price) across all variations.">
                            Avg Premium <i class="fas ${getSortIcon('avg_grade_premium')} ml-1"></i>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Market tier based on average card price. Budget (<$20), Mid ($20-$100), Premium ($100-$500), Ultra (>$500).">Market Tier</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Investment rating. Step 1: Score avg premium + avg gem rate + momentum. Step 2: Adjust for market tier liquidity. Step 3: A = excellent, B = good, C = average, D = poor.">Investment Rating</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Quick actions: View player profile, see all cards, or analyze further.">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">`;
    
    filteredData.forEach(player => {
        const tierColor = {
            'Superstar': 'bg-purple-100 text-purple-800',
            'Star': 'bg-blue-100 text-blue-800',
            'Starter': 'bg-green-100 text-green-800',
            'Bench': 'bg-gray-100 text-gray-800'
        }[player.market_tier] || 'bg-gray-100 text-gray-800';
        
        const ratingColor = {
            'Premium Investment': 'text-green-700 font-bold',
            'Good Investment': 'text-green-600',
            'Liquid Asset': 'text-blue-600',
            'Speculative': 'text-gray-600'
        }[player.investment_rating] || 'text-gray-600';
        
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">${player.player_name}</div>
                    <div class="text-xs text-gray-500">${player.total_gems} PSA 10s</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">${player.total_parallels}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">${player.total_cards_graded.toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-semibold text-gray-900">${player.avg_gem_rate_pct}%</div>
                    <div class="text-xs text-gray-500">${player.min_gem_rate_pct}% - ${player.max_gem_rate_pct}%</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${player.grading_profile}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">${player.avg_grade_premium}x</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${tierColor}">
                        ${player.market_tier}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm ${ratingColor}">${player.investment_rating}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <button onclick="quickFilterPlayer('${(player.player_name || '').replace(/'/g, "\\'")}')" class="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 mr-2">
                        <i class="fas fa-filter mr-1"></i>Focus
                    </button>
                    <a href="/opportunities" class="inline-flex items-center px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">
                        <i class="fas fa-bullseye mr-1"></i>Opps
                    </a>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    document.getElementById('dataContainer').innerHTML = html;
}

let sortColumn = 'total_cards_graded';
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
        sortDirection = column === 'player_name' ? 'asc' : 'desc';
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
