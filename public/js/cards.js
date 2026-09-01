// Cards Analytics Page JavaScript
class CardsPage {
    constructor() {
        this.currentView = this.getViewFromPath();
        this.init();
    }

    getViewFromPath() {
        const path = window.location.pathname;
        if (path === '/cards/top-movers') return 'top-movers';
        if (path === '/cards/volatility') return 'volatility';
        if (path === '/cards/premium') return 'premium';
        if (path.startsWith('/cards/detail/')) return 'detail';
        return 'list';
    }

    async init() {
        this.showLoading();
        try {
            switch(this.currentView) {
                case 'list':
                    await this.renderCardsList();
                    break;
                case 'top-movers':
                    await this.renderTopMovers();
                    break;
                case 'volatility':
                    await this.renderVolatility();
                    break;
                case 'premium':
                    await this.renderGradingPremium();
                    break;
                case 'detail':
                    const cardId = window.location.pathname.split('/').pop();
                    await this.renderCardDetail(cardId);
                    break;
            }
        } catch (error) {
            console.error('Error loading cards page:', error);
            this.showError(error.message);
        }
        this.hideLoading();
    }

    async renderCardsList(searchQuery = '', trendFilter = '') {
        let url = '/api/cards?limit=50';
        if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
        const cards = await this.fetch(url);
        
        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Cards Analytics</h1>
                    <p class="text-gray-600 mt-2">Browse and analyze individual card performance</p>
                </div>
                
                <!-- Search and Filters -->
                <div class="bg-white rounded-lg shadow p-6 mb-8">
                    <div class="flex flex-wrap gap-4">
                        <input type="text" id="cardSearch" placeholder="Search cards..." value="${searchQuery}"
                               class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <select id="trendFilter" class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">All Trends</option>
                            <option value="Rising" ${trendFilter === 'Rising' ? 'selected' : ''}>Rising</option>
                            <option value="Declining" ${trendFilter === 'Declining' ? 'selected' : ''}>Declining</option>
                            <option value="Stable" ${trendFilter === 'Stable' ? 'selected' : ''}>Stable</option>
                        </select>
                        <button onclick="cardsPage.applyFilters()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-search mr-2"></i>Search
                        </button>
                        <button onclick="cardsPage.resetFilters()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                            <i class="fas fa-redo mr-2"></i>Reset
                        </button>
                    </div>
                </div>
                
                <!-- Cards Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${cards.map(card => `
                        <a href="/cards/detail/${card.card_id}" class="bg-white rounded-lg shadow hover:shadow-lg transition">
                            <div class="p-6">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex-1">
                                        <h3 class="font-semibold text-gray-900">${card.product_name}</h3>
                                        <p class="text-sm text-gray-600">${card.console_name}</p>
                                    </div>
                                    <span class="px-2 py-1 text-xs rounded-full ${
                                        card.trend_state === 'Rising' ? 'bg-green-100 text-green-800' :
                                        card.trend_state === 'Declining' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                    }">
                                        ${card.trend_state || 'N/A'}
                                    </span>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p class="text-sm text-gray-600">Loose Price</p>
                                        <p class="text-lg font-bold">$${card.loose_price || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p class="text-sm text-gray-600">PSA 10</p>
                                        <p class="text-lg font-bold">$${card.psa10_price || 'N/A'}</p>
                                    </div>
                                </div>
                                
                                <div class="flex justify-between items-center text-sm">
                                    <span class="${card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                                        ${card.price_change_pct ? (card.price_change_pct >= 0 ? '+' : '') + card.price_change_pct + '%' : 'N/A'}
                                    </span>
                                    <span class="text-gray-600">Vol: ${card.sales_volume ? card.sales_volume.toLocaleString() : 'N/A'}</span>
                                </div>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('content').innerHTML = html;
        
        // Add enter key support for search
        const searchInput = document.getElementById('cardSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.applyFilters();
            });
        }
    }
    
    applyFilters() {
        const searchQuery = document.getElementById('cardSearch')?.value || '';
        const trendFilter = document.getElementById('trendFilter')?.value || '';
        this.renderCardsList(searchQuery, trendFilter);
    }
    
    resetFilters() {
        this.renderCardsList('', '');
    }

    async renderTopMovers() {
        const data = await this.fetch('/api/cards/top-movers');
        
        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Top Movers</h1>
                    <p class="text-gray-600 mt-2">Cards with the biggest price changes</p>
                </div>
                
                <div class="grid grid-cols-1 gap-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Price Change Leaders</h2>
                        <div id="topMoversChart" class="chart-container"></div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top 50 Movers</h2>
                        <div class="overflow-x-auto">
                            <table class="min-w-full">
                                <thead>
                                    <tr class="border-b">
                                        <th class="text-left py-2" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                        <th class="text-right py-2" title="Current ungraded market price. Latest sale_price from card_sales where condition = 'ungraded'.">Price</th>
                                        <th class="text-right py-2" title="30-day % price change. Calculation: (latest_price - price_30d_ago) / price_30d_ago * 100.">Change</th>
                                        <th class="text-right py-2" title="Number of recorded sales in the last 90 days from card_sales table.">Volume</th>
                                        <th class="text-center py-2" title="Trend arrow. Step 1: Compare latest price to 30-day average. Step 2: Up arrow if +5%+, down if -5%+, flat otherwise.">Trend</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map(card => `
                                        <tr class="border-b hover:bg-gray-50">
                                            <td class="py-2">
                                                <a href="/cards/detail/${card.card_id}" class="hover:text-blue-600">
                                                    <div class="font-medium">${card.product_name}</div>
                                                    <div class="text-sm text-gray-600">${card.console_name}</div>
                                                </a>
                                            </td>
                                            <td class="text-right py-2">$${card.loose_price}</td>
                                            <td class="text-right py-2">
                                                <span class="${card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                                                    ${card.price_change_pct >= 0 ? '+' : ''}${card.price_change_pct}%
                                                </span>
                                            </td>
                                            <td class="text-right py-2">${card.sales_volume.toLocaleString()}</td>
                                            <td class="text-center py-2">
                                                <span class="px-2 py-1 text-xs rounded-full ${
                                                    card.trend_state === 'Rising' ? 'bg-green-100 text-green-800' :
                                                    card.trend_state === 'Declining' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }">
                                                    ${card.trend_state || 'N/A'}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('content').innerHTML = html;
        
        setTimeout(() => {
            if (data && data.length > 0) {
                const top20 = data.slice(0, 20);
                Highcharts.chart('topMoversChart', {
                    chart: { type: 'bar', height: 600 },
                    title: { text: null },
                    xAxis: { 
                        categories: top20.map(c => c.product_name.substring(0, 40)),
                        labels: { style: { fontSize: '10px' } }
                    },
                    yAxis: { 
                        title: { text: 'Price Change (%)' },
                        type: 'logarithmic'
                    },
                    legend: { enabled: false },
                    tooltip: {
                        formatter: function() {
                            return '<b>' + this.x + '</b><br/>' +
                                   'Change: ' + this.y.toFixed(2) + '%';
                        }
                    },
                    series: [{
                        name: 'Change %',
                        data: top20.map(c => ({
                            y: parseFloat(c.price_change_pct),
                            color: c.price_change_pct >= 0 ? '#10b981' : '#ef4444'
                        }))
                    }]
                });
            }
        }, 100);
    }

    async renderVolatility() {
        const data = await this.fetch('/api/cards/volatility');
        
        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Volatility Analysis</h1>
                    <p class="text-gray-600 mt-2">Price volatility and risk metrics</p>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Volatility Distribution</h2>
                        <div id="volatilityDistChart" class="chart-container"></div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Risk vs Return</h2>
                        <div id="riskReturnChart" class="chart-container"></div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold mb-4">Most Volatile Cards</h2>
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="border-b">
                                    <th class="text-left py-2" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                    <th class="text-right py-2" title="Current ungraded market price. Latest sale_price from card_sales where condition = 'ungraded'.">Price</th>
                                    <th class="text-right py-2" title="Price volatility score. Step 1: Collect last 20 sale prices. Step 2: Calculate standard deviation. Step 3: Divide by mean to get coefficient of variation (higher = more volatile).">Volatility</th>
                                    <th class="text-right py-2" title="30-day % price change. Calculation: (latest_price - price_30d_ago) / price_30d_ago * 100.">Change</th>
                                    <th class="text-right py-2" title="Number of recorded sales in the last 90 days from card_sales table.">Volume</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.slice(0, 50).map(card => `
                                    <tr class="border-b hover:bg-gray-50">
                                        <td class="py-2">
                                            <a href="/cards/detail/${card.card_id}" class="hover:text-blue-600">
                                                <div class="font-medium">${card.product_name}</div>
                                                <div class="text-sm text-gray-600">${card.console_name}</div>
                                            </a>
                                        </td>
                                        <td class="text-right py-2">$${card.loose_price}</td>
                                        <td class="text-right py-2">
                                            <span class="font-medium text-orange-600">${parseFloat(card.loose_price_volatility).toFixed(4)}</span>
                                        </td>
                                        <td class="text-right py-2">
                                            <span class="${card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}">
                                                ${card.price_change_pct ? (card.price_change_pct >= 0 ? '+' : '') + card.price_change_pct + '%' : 'N/A'}
                                            </span>
                                        </td>
                                        <td class="text-right py-2">${card.sales_volume.toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('content').innerHTML = html;
        
        setTimeout(() => {
            if (data && data.length > 0) {
                // Volatility distribution
                const volatilityBuckets = { low: 0, medium: 0, high: 0, veryHigh: 0 };
                data.forEach(card => {
                    const vol = parseFloat(card.loose_price_volatility);
                    if (vol < 0.1) volatilityBuckets.low++;
                    else if (vol < 0.3) volatilityBuckets.medium++;
                    else if (vol < 0.5) volatilityBuckets.high++;
                    else volatilityBuckets.veryHigh++;
                });
                
                Highcharts.chart('volatilityDistChart', {
                    chart: { type: 'column' },
                    title: { text: null },
                    xAxis: { categories: ['Low (<0.1)', 'Medium (0.1-0.3)', 'High (0.3-0.5)', 'Very High (>0.5)'] },
                    yAxis: { title: { text: 'Number of Cards' } },
                    series: [{ 
                        name: 'Cards', 
                        data: [volatilityBuckets.low, volatilityBuckets.medium, volatilityBuckets.high, volatilityBuckets.veryHigh],
                        color: '#f59e0b'
                    }]
                });
                
                // Risk vs Return scatter
                const scatterData = data.slice(0, 50).map(card => ([
                    parseFloat(card.loose_price_volatility),
                    parseFloat(card.price_change_pct || 0)
                ]));
                
                Highcharts.chart('riskReturnChart', {
                    chart: { type: 'scatter' },
                    title: { text: null },
                    xAxis: { title: { text: 'Volatility (Risk)' } },
                    yAxis: { title: { text: 'Price Change (%)' } },
                    series: [{ 
                        name: 'Cards', 
                        data: scatterData,
                        color: '#3b82f6'
                    }]
                });
            }
        }, 100);
    }

    async renderGradingPremium() {
        const data = await this.fetch('/api/cards/grading-premium');
        
        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Grading Premium Analysis</h1>
                    <p class="text-gray-600 mt-2">PSA 10 vs Loose price comparison</p>
                </div>
                
                <div class="grid grid-cols-1 gap-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top Grading Premiums</h2>
                        <div id="gradingPremiumChart" class="chart-container"></div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top 50 Premium Opportunities</h2>
                        <div class="overflow-x-auto">
                            <table class="min-w-full">
                                <thead>
                                    <tr class="border-b">
                                        <th class="text-left py-2" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                        <th class="text-right py-2" title="Ungraded (raw) market price. Latest sale_price from card_sales where condition = 'ungraded'.">Loose</th>
                                        <th class="text-right py-2" title="PSA 10 graded market price. Latest sale_price from card_sales where condition = 'PSA10' or from psa10_price field.">PSA 10</th>
                                        <th class="text-right py-2" title="Grading premium multiple. Calculation: PSA10_price / loose_price. E.g., 5x means graded is 5x raw price.">Premium</th>
                                        <th class="text-right py-2" title="Number of recorded sales in the last 90 days from card_sales table.">Volume</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map(card => `
                                        <tr class="border-b hover:bg-gray-50">
                                            <td class="py-2">
                                                <a href="/cards/detail/${card.card_id}" class="hover:text-blue-600">
                                                    <div class="font-medium">${card.product_name}</div>
                                                    <div class="text-sm text-gray-600">${card.console_name}</div>
                                                </a>
                                            </td>
                                            <td class="text-right py-2">$${card.loose_price}</td>
                                            <td class="text-right py-2">$${card.psa10_price}</td>
                                            <td class="text-right py-2">
                                                <span class="font-medium text-purple-600">+${card.premium_pct}%</span>
                                            </td>
                                            <td class="text-right py-2">${card.sales_volume.toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('content').innerHTML = html;
        
        setTimeout(() => {
            if (data && data.length > 0) {
                const top20 = data.slice(0, 20);
                Highcharts.chart('gradingPremiumChart', {
                    chart: { type: 'bar', height: 600 },
                    title: { text: null },
                    xAxis: { 
                        categories: top20.map(c => c.product_name.substring(0, 40)),
                        labels: { style: { fontSize: '10px' } }
                    },
                    yAxis: { title: { text: 'Premium (%)' } },
                    legend: { enabled: false },
                    tooltip: {
                        formatter: function() {
                            return '<b>' + this.x + '</b><br/>' +
                                   'Premium: +' + this.y.toFixed(2) + '%';
                        }
                    },
                    series: [{ 
                        name: 'Premium %', 
                        data: top20.map(c => parseFloat(c.premium_pct)),
                        color: '#8b5cf6'
                    }]
                });
            }
        }, 100);
    }

    async renderCardDetail(cardId) {
        const data = await this.fetch(`/api/cards/${cardId}`);
        
        if (!data.card) {
            this.showError('Card not found');
            return;
        }

        const loosePriceNum = Number(data.card.loose_price) || 0;
        const psa10PriceNum = Number(data.card.psa10_price) || 0;
        const gradedPriceNum = Number(data.card.graded_price) || 0;
        const psa10PremiumMultiplier = loosePriceNum > 0 && psa10PriceNum > 0
            ? (psa10PriceNum / loosePriceNum)
            : null;
        const gradedPremiumMultiplier = loosePriceNum > 0 && gradedPriceNum > 0
            ? (gradedPriceNum / loosePriceNum)
            : null;
        const trendState = data.card.trend_state || 'N/A';
        const pricePosition7d = data.card.price_position_7d != null
            ? `${data.card.price_position_7d}%`
            : 'N/A';
        
        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <a href="/cards" class="mb-4 inline-block text-blue-600 hover:text-blue-800">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Cards
                    </a>
                    <h1 class="text-3xl font-bold text-gray-900">${data.card.product_name}</h1>
                    <p class="text-gray-600 mt-2">${data.card.console_name}</p>
                </div>
                
                <!-- Key Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Loose Price</p>
                        <p class="text-2xl font-bold">$${data.card.loose_price || 'N/A'}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">PSA 10</p>
                        <p class="text-2xl font-bold">$${data.card.psa10_price || 'N/A'}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">24h Change</p>
                        <p class="text-2xl font-bold ${data.card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${data.card.price_change_pct ? (data.card.price_change_pct >= 0 ? '+' : '') + data.card.price_change_pct + '%' : 'N/A'}
                        </p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Volume</p>
                        <p class="text-2xl font-bold">${data.card.sales_volume ? data.card.sales_volume.toLocaleString() : 'N/A'}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">PSA10 Premium</p>
                        <p class="text-2xl font-bold text-purple-700">${psa10PremiumMultiplier ? `${psa10PremiumMultiplier.toFixed(2)}x` : 'N/A'}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">7D Price Position</p>
                        <p class="text-2xl font-bold text-indigo-700">${pricePosition7d}</p>
                        <p class="text-xs text-gray-500 mt-1">Trend: ${trendState}</p>
                    </div>
                </div>
                
                <!-- Charts -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Price History</h2>
                        <div class="chart-container"><canvas id="priceHistoryChart"></canvas></div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Premium Multipliers Over Time</h2>
                        <div class="chart-container"><canvas id="premiumTrendChart"></canvas></div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Volume Trend</h2>
                        <div class="chart-container"><canvas id="volumeChart"></canvas></div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Daily Price Change %</h2>
                        <div class="chart-container"><canvas id="changePctChart"></canvas></div>
                    </div>
                </div>
                
                <!-- Price Windows -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold mb-4">Price Windows</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h3 class="font-medium mb-2">7-Day Range</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span>High:</span>
                                    <span class="font-bold">$${data.card.high_7d || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Low:</span>
                                    <span class="font-bold">$${data.card.low_7d || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Range:</span>
                                    <span class="font-bold">${data.card.range_pct_7d || 'N/A'}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <h3 class="font-medium mb-2">15-Day Range</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span>High:</span>
                                    <span class="font-bold">$${data.card.high_15d || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Low:</span>
                                    <span class="font-bold">$${data.card.low_15d || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Range:</span>
                                    <span class="font-bold">${data.card.range_pct_15d || 'N/A'}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <h3 class="font-medium mb-2">30-Day Range</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span>High:</span>
                                    <span class="font-bold">$${data.card.high_30d || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Low:</span>
                                    <span class="font-bold">$${data.card.low_30d || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Range:</span>
                                    <span class="font-bold">${data.card.range_pct_30d || 'N/A'}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('content').innerHTML = html;
        
        // Initialize charts
        setTimeout(() => {
            if (typeof Chart === 'undefined' || !data.history || data.history.length === 0) {
                return;
            }

            const labels = data.history.map(h => new Date(h.date).toLocaleDateString());
            const looseSeries = data.history.map(h => Number(h.loose_price) || null);
            const gradedSeries = data.history.map(h => Number(h.graded_price) || null);
            const psa10Series = data.history.map(h => Number(h.psa10_price) || null);
            const volumeSeries = data.history.map(h => Number(h.sales_volume) || 0);
            const changeSeries = data.history.map(h => Number(h.price_change_pct) || 0);
            const psa10PremiumSeries = data.history.map(h => {
                const loose = Number(h.loose_price) || 0;
                const psa10 = Number(h.psa10_price) || 0;
                return loose > 0 && psa10 > 0 ? Number((psa10 / loose).toFixed(2)) : null;
            });
            const gradedPremiumSeries = data.history.map(h => {
                const loose = Number(h.loose_price) || 0;
                const graded = Number(h.graded_price) || 0;
                return loose > 0 && graded > 0 ? Number((graded / loose).toFixed(2)) : null;
            });

            new Chart(document.getElementById('priceHistoryChart'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Loose', data: looseSeries, borderColor: '#1d4ed8', backgroundColor: 'rgba(29, 78, 216, 0.15)', tension: 0.25 },
                        { label: 'Graded', data: gradedSeries, borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.15)', tension: 0.25 },
                        { label: 'PSA 10', data: psa10Series, borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.15)', tension: 0.25 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Price ($)' } } }
                }
            });

            new Chart(document.getElementById('premiumTrendChart'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'PSA10 / Loose', data: psa10PremiumSeries, borderColor: '#9333ea', backgroundColor: 'rgba(147, 51, 234, 0.15)', tension: 0.25 },
                        { label: 'Graded / Loose', data: gradedPremiumSeries, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.15)', tension: 0.25 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Multiplier (x)' } } }
                }
            });

            new Chart(document.getElementById('volumeChart'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{ label: 'Sales Volume', data: volumeSeries, backgroundColor: 'rgba(14, 165, 233, 0.6)' }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Volume' } } }
                }
            });

            new Chart(document.getElementById('changePctChart'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Price Change %',
                        data: changeSeries,
                        backgroundColor: changeSeries.map(v => (v >= 0 ? 'rgba(22, 163, 74, 0.6)' : 'rgba(220, 38, 38, 0.6)'))
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            title: { display: true, text: 'Change (%)' },
                            grid: { color: 'rgba(107,114,128,0.2)' }
                        }
                    }
                }
            });
        }, 100);
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showError(message) {
        document.getElementById('content').innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <p class="text-gray-600">Error: ${message}</p>
            </div>
        `;
    }

    async fetch(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
}

// Initialize cards page
new CardsPage();
