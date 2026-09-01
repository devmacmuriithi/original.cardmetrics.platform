// Opportunity Alerts JavaScript

let allData = [];
let filteredData = [];

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Add enter key support for search
    document.getElementById('searchPlayer').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
});

// Load alerts data
async function loadData() {
    try {
        const response = await fetch('/api/intelligence/alerts?limit=1000');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        // Handle both old and new API response formats
        allData = result.data || result;
        filteredData = allData;
        renderAlerts();
    } catch (error) {
        console.error('Error loading alerts:', error);
        document.getElementById('dataContainer').innerHTML = `
            <div class="bg-white rounded-lg shadow p-6 text-center text-red-600">
                <i class="fas fa-exclamation-triangle text-3xl mb-4"></i>
                <p>Error loading data. Please try again.</p>
            </div>
        `;
    }
}

// Apply filters
function applyFilters() {
    const searchPlayer = document.getElementById('searchPlayer').value.toLowerCase();
    const priorityLevel = document.getElementById('priorityLevel').value;
    const alertType = document.getElementById('alertType').value;
    const minPremium = parseFloat(document.getElementById('minPremium').value) || 0;
    
    filteredData = allData.filter(item => {
        const matchesPlayer = !searchPlayer || item.player_name.toLowerCase().includes(searchPlayer);
        const matchesPriority = !priorityLevel || item.priority === priorityLevel;
        const matchesType = !alertType || item.alert_type.includes(alertType);
        const matchesPremium = (item.grade_premium || 0) >= minPremium;
        
        return matchesPlayer && matchesPriority && matchesType && matchesPremium;
    });
    
    renderAlerts();
}

// Reset filters
function resetFilters() {
    document.getElementById('searchPlayer').value = '';
    document.getElementById('priorityLevel').value = '';
    document.getElementById('alertType').value = '';
    document.getElementById('minPremium').value = '0';
    
    filteredData = allData;
    renderAlerts();
}

// Render alerts
function renderAlerts() {
    document.getElementById('resultCount').textContent = filteredData.length;
    
    if (filteredData.length === 0) {
        document.getElementById('dataContainer').innerHTML = `
            <div class="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                <i class="fas fa-search text-3xl mb-4"></i>
                <p>No alerts found matching your criteria.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    filteredData.forEach(alert => {
        const priorityClass = {
            'Critical': 'badge-critical',
            'High': 'badge-high',
            'Medium': 'badge-medium',
            'Low': 'badge-low'
        }[alert.priority] || 'badge-low';
        
        const alertIcon = alert.alert_type.includes('HOT') ? 'fa-fire' :
                        alert.alert_type.includes('ARBITRAGE') ? 'fa-coins' :
                        alert.alert_type.includes('QUALITY') ? 'fa-star' :
                        alert.alert_type.includes('POPULATION') ? 'fa-users' :
                        alert.alert_type.includes('WARNING') ? 'fa-exclamation-triangle' :
                        alert.alert_type.includes('VALUE') ? 'fa-dollar-sign' :
                        alert.alert_type.includes('FRESH') ? 'fa-certificate' :
                        'fa-bell';
        
        html += `
            <div class="alert-card bg-white rounded-lg shadow p-6">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-3">
                            <span class="px-3 py-1 text-xs font-bold text-white rounded ${priorityClass}">
                                ${alert.priority}
                            </span>
                            <span class="flex items-center text-sm font-semibold text-gray-900">
                                <i class="fas ${alertIcon} mr-2"></i>
                                ${alert.alert_type}
                            </span>
                        </div>
                        <div class="mb-4">
                            <div class="text-xl font-bold text-gray-900">${alert.player_name}</div>
                            <div class="text-sm text-gray-600">${alert.parallel} #${alert.card_number}</div>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span class="text-gray-500">Raw Price:</span>
                                <span class="ml-2 font-semibold text-gray-900">$${alert.loose_price || 'N/A'}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">PSA 10:</span>
                                <span class="ml-2 font-semibold text-gray-900">$${alert.bgs_10_price || 'N/A'}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Premium:</span>
                                <span class="ml-2 font-semibold text-green-600">${alert.grade_premium ? alert.grade_premium + 'x' : 'N/A'}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Gem Rate:</span>
                                <span class="ml-2 font-semibold ${alert.gem_rate_pct < 20 ? 'text-red-600' : 'text-gray-900'}">
                                    ${alert.gem_rate_pct != null ? alert.gem_rate_pct + '%' : 'Not graded yet'}
                                </span>
                            </div>
                            <div>
                                <span class="text-gray-500">Momentum:</span>
                                <span class="ml-2 font-semibold ${alert.momentum_pct > 0 ? 'text-green-600' : alert.momentum_pct < 0 ? 'text-red-600' : 'text-gray-500'}">
                                    ${alert.momentum_pct != null ? (alert.momentum_pct > 0 ? '+' : '') + alert.momentum_pct + '%' : 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span class="text-gray-500">Sales:</span>
                                <span class="ml-2 font-semibold text-gray-900">${alert.sales_volume || 0}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Graded/Month:</span>
                                <span class="ml-2 font-semibold text-gray-900">${alert.graded_past_month || 0}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Last Gem:</span>
                                <span class="ml-2 text-gray-600">
                                    ${alert.days_since_last_gem != null ? alert.days_since_last_gem + ' days ago' : 'Never'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="ml-4 flex space-x-2">
                        <a href="${alert.gemrate_url}" target="_blank" class="text-blue-600 hover:text-blue-800" title="GemRate">
                            <i class="fas fa-chart-bar text-xl"></i>
                        </a>
                        <a href="${alert.cardladder_all_graded_url}" target="_blank" class="text-green-600 hover:text-green-800" title="CardLadder">
                            <i class="fas fa-dollar-sign text-xl"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('dataContainer').innerHTML = html;
}
