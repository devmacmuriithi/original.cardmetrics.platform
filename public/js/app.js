class TradingCardAnalytics {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        this.setupRouting();
        this.loadPage('dashboard');
        this.setupEventListeners();
    }

    setupRouting() {
        // Handle hash-based routing
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'dashboard';
            this.loadPage(hash);
        });
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href').slice(1);
                window.location.hash = href;
            });
        });
    }

    async loadPage(page) {
        this.showLoading();
        this.currentPage = page;
        
        try {
            let content = '';
            
            switch(page) {
                case 'dashboard':
                    content = await this.renderDashboard();
                    break;
                case 'cards':
                    content = await this.renderCardsList();
                    break;
                case 'cards/top-movers':
                    content = await this.renderTopMovers();
                    break;
                case 'cards/volatility':
                    content = await this.renderVolatility();
                    break;
                case 'cards/premium':
                    content = await this.renderGradingPremium();
                    break;
                case 'sets':
                    content = await this.renderSetsList();
                    break;
                case 'sets/performance':
                    content = await this.renderSetPerformance();
                    break;
                case 'sets/liquidity':
                    content = await this.renderSetLiquidity();
                    break;
                case 'sets/comparison':
                    content = await this.renderSetComparison();
                    break;
                default:
                    // Handle card detail pages like /cards/12345
                    if (page.startsWith('cards/')) {
                        const cardId = page.split('/')[1];
                        content = await this.renderCardDetail(cardId);
                    } else if (page.startsWith('sets/')) {
                        const setId = page.split('/')[1];
                        content = await this.renderSetDetail(setId);
                    }
            }
            
            document.getElementById('content').innerHTML = content;
            this.hideLoading();
            
            // Initialize charts after content loads
            setTimeout(() => this.initializeCharts(), 100);
            
        } catch (error) {
            console.error('Error loading page:', error);
            document.getElementById('content').innerHTML = this.renderError(error.message);
            this.hideLoading();
        }
    }

    async renderDashboard() {
        const data = await this.fetch('/api/dashboard');
        
        return `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Trading Card Analytics Dashboard</h1>
                    <p class="text-gray-600 mt-2">Real-time market insights and performance metrics</p>
                </div>
                
                <!-- Key Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div class="metric-card bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Total Cards</p>
                                <p class="text-2xl font-bold text-gray-900">${data.metrics.total_cards.toLocaleString()}</p>
                            </div>
                            <i class="fas fa-layer-group text-3xl text-blue-500"></i>
                        </div>
                    </div>
                    
                    <div class="metric-card bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Avg Card Price</p>
                                <p class="text-2xl font-bold text-gray-900">$${data.metrics.avg_card_price}</p>
                            </div>
                            <i class="fas fa-dollar-sign text-3xl text-green-500"></i>
                        </div>
                    </div>
                    
                    <div class="metric-card bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Total Volume</p>
                                <p class="text-2xl font-bold text-gray-900">${data.metrics.total_volume.toLocaleString()}</p>
                            </div>
                            <i class="fas fa-chart-line text-3xl text-purple-500"></i>
                        </div>
                    </div>
                    
                    <div class="metric-card bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">Rising Cards</p>
                                <p class="text-2xl font-bold text-green-600">${data.metrics.rising_cards.toLocaleString()}</p>
                            </div>
                            <i class="fas fa-arrow-trend-up text-3xl text-green-500"></i>
                        </div>
                    </div>
                </div>
                
                <!-- Charts Row -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top Movers</h2>
                        <div id="topMoversChart" class="chart-container"></div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Market Sentiment</h2>
                        <div id="sentimentChart" class="chart-container"></div>
                    </div>
                </div>
                
                <!-- Tables -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top Movers</h2>
                        <div class="overflow-x-auto">
                            <table class="min-w-full">
                                <thead>
                                    <tr class="border-b">
                                        <th class="text-left py-2" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                        <th class="text-right py-2" title="30-day % price change. Calculation: (latest_price - price_30d_ago) / price_30d_ago * 100.">Change</th>
                                        <th class="text-right py-2" title="Current ungraded market price. Latest sale_price from card_sales where condition = 'ungraded'.">Price</th>
                                        <th class="text-right py-2" title="Number of recorded sales in the last 90 days from card_sales table.">Volume</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.topMovers.map(card => `
                                        <tr class="border-b hover:bg-gray-50">
                                            <td class="py-2">
                                                <div>
                                                    <div class="font-medium">${card.product_name}</div>
                                                    <div class="text-sm text-gray-600">${card.console_name}</div>
                                                </div>
                                            </td>
                                            <td class="text-right py-2">
                                                <span class="${card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                                                    ${card.price_change_pct >= 0 ? '+' : ''}${card.price_change_pct}%
                                                </span>
                                            </td>
                                            <td class="text-right py-2">$${card.loose_price}</td>
                                            <td class="text-right py-2">${card.sales_volume.toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top Sets by Volume</h2>
                        <div class="overflow-x-auto">
                            <table class="min-w-full">
                                <thead>
                                    <tr class="border-b">
                                        <th class="text-left py-2" title="Card set name. Pulled from console_name in card_sets table.">Set</th>
                                        <th class="text-right py-2" title="Total number of cards tracked in this set. Count of rows in cards table linked by console_id.">Cards</th>
                                        <th class="text-right py-2" title="Average ungraded price across all cards in this set. Calculation: SUM(loose_price) / COUNT(cards) where loose_price > 0.">Avg Price</th>
                                        <th class="text-right py-2" title="Total sales volume across all cards in this set. Sum of sales_volume from cards table linked to this set.">Volume</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.topSets.map(set => `
                                        <tr class="border-b hover:bg-gray-50">
                                            <td class="py-2 font-medium">${set.console_name}</td>
                                            <td class="text-right py-2">${set.card_count.toLocaleString()}</td>
                                            <td class="text-right py-2">$${set.avg_price}</td>
                                            <td class="text-right py-2">${set.total_volume.toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async renderCardsList() {
        const cards = await this.fetch('/api/cards?limit=50');
        
        return `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Cards Analytics</h1>
                    <p class="text-gray-600 mt-2">Browse and analyze individual card performance</p>
                </div>
                
                <!-- Search and Filters -->
                <div class="bg-white rounded-lg shadow p-6 mb-8">
                    <div class="flex flex-wrap gap-4">
                        <input type="text" id="cardSearch" placeholder="Search cards..." 
                               class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <select class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option>All Trends</option>
                            <option>Rising</option>
                            <option>Declining</option>
                            <option>Stable</option>
                        </select>
                        <button class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-search mr-2"></i>Search
                        </button>
                    </div>
                </div>
                
                <!-- Cards Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${cards.map(card => `
                        <div class="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer" onclick="window.location.hash='cards/${card.card_id}'">
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
                                        ${card.trend_state}
                                    </span>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p class="text-sm text-gray-600">Loose Price</p>
                                        <p class="text-lg font-bold">$${card.loose_price}</p>
                                    </div>
                                    <div>
                                        <p class="text-sm text-gray-600">PSA 10</p>
                                        <p class="text-lg font-bold">$${card.psa10_price || 'N/A'}</p>
                                    </div>
                                </div>
                                
                                <div class="flex justify-between items-center text-sm">
                                    <span class="${card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                                        ${card.price_change_pct >= 0 ? '+' : ''}${card.price_change_pct}%
                                    </span>
                                    <span class="text-gray-600">Vol: ${card.sales_volume.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async renderCardDetail(cardId) {
        const data = await this.fetch(`/api/cards/${cardId}`);
        
        if (!data.card) {
            return '<div class="text-center py-8"><p class="text-gray-600">Card not found</p></div>';
        }
        
        return `
            <div class="fade-in">
                <div class="mb-8">
                    <button onclick="window.location.hash='cards'" class="mb-4 text-blue-600 hover:text-blue-800">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Cards
                    </button>
                    <h1 class="text-3xl font-bold text-gray-900">${data.card.product_name}</h1>
                    <p class="text-gray-600 mt-2">${data.card.console_name}</p>
                </div>
                
                <!-- Key Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Loose Price</p>
                        <p class="text-2xl font-bold">$${data.card.loose_price}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">PSA 10</p>
                        <p class="text-2xl font-bold">$${data.card.psa10_price || 'N/A'}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">24h Change</p>
                        <p class="text-2xl font-bold ${data.card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${data.card.price_change_pct >= 0 ? '+' : ''}${data.card.price_change_pct}%
                        </p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Volume</p>
                        <p class="text-2xl font-bold">${data.card.sales_volume.toLocaleString()}</p>
                    </div>
                </div>
                
                <!-- Charts -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Price History</h2>
                        <div id="priceHistoryChart" class="chart-container"></div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Volume & Trend</h2>
                        <div id="volumeChart" class="chart-container"></div>
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
                                    <span class="font-bold">$${data.card.high_7d}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Low:</span>
                                    <span class="font-bold">$${data.card.low_7d}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Range:</span>
                                    <span class="font-bold">${data.card.range_pct_7d}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <h3 class="font-medium mb-2">15-Day Range</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span>High:</span>
                                    <span class="font-bold">$${data.card.high_15d}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Low:</span>
                                    <span class="font-bold">$${data.card.low_15d}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Range:</span>
                                    <span class="font-bold">${data.card.range_pct_15d}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <h3 class="font-medium mb-2">30-Day Range</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span>High:</span>
                                    <span class="font-bold">$${data.card.high_30d}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Low:</span>
                                    <span class="font-bold">$${data.card.low_30d}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Range:</span>
                                    <span class="font-bold">${data.card.range_pct_30d}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async renderSetsList() {
        const sets = await this.fetch('/api/sets?limit=50');
        
        return `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Sets Analytics</h1>
                    <p class="text-gray-600 mt-2">Analyze performance across different card sets</p>
                </div>
                
                <!-- Sets Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${sets.map(set => `
                        <div class="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer" onclick="window.location.hash='sets/${set.id}'">
                            <div class="p-6">
                                <h3 class="font-semibold text-gray-900 mb-2">${set.console_name}</h3>
                                
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p class="text-sm text-gray-600">Cards</p>
                                        <p class="text-lg font-bold">${set.card_count.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p class="text-sm text-gray-600">Avg Price</p>
                                        <p class="text-lg font-bold">$${set.avg_price}</p>
                                    </div>
                                </div>
                                
                                <div class="space-y-2 text-sm">
                                    <div class="flex justify-between">
                                        <span>Price Range:</span>
                                        <span>$${set.min_price} - $${set.max_price}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span>Total Volume:</span>
                                        <span>${set.total_volume.toLocaleString()}</span>
                                    </div>
                                </div>
                                
                                <div class="mt-4 pt-4 border-t">
                                    <div class="flex justify-between text-sm">
                                        <span class="text-green-600">↑ ${set.rising_count}</span>
                                        <span class="text-red-600">↓ ${set.declining_count}</span>
                                        <span class="text-gray-600">→ ${set.stable_count}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async renderSetDetail(setId) {
        const data = await this.fetch(`/api/sets/${setId}`);
        
        if (!data.set) {
            return '<div class="text-center py-8"><p class="text-gray-600">Set not found</p></div>';
        }
        
        return `
            <div class="fade-in">
                <div class="mb-8">
                    <button onclick="window.location.hash='sets'" class="mb-4 text-blue-600 hover:text-blue-800">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Sets
                    </button>
                    <h1 class="text-3xl font-bold text-gray-900">${data.set.console_name}</h1>
                    <p class="text-gray-600 mt-2">${data.set.name}</p>
                </div>
                
                <!-- Set Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Total Cards</p>
                        <p class="text-2xl font-bold">${data.set.card_count.toLocaleString()}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Avg Price</p>
                        <p class="text-2xl font-bold">$${data.set.avg_price}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Total Volume</p>
                        <p class="text-2xl font-bold">${data.set.total_volume.toLocaleString()}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Rising Cards</p>
                        <p class="text-2xl font-bold text-green-600">${data.set.rising_count}</p>
                    </div>
                </div>
                
                <!-- Charts -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Average Price History</h2>
                        <div id="setPriceChart" class="chart-container"></div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Volume Trends</h2>
                        <div id="setVolumeChart" class="chart-container"></div>
                    </div>
                </div>
                
                <!-- Top Cards -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold mb-4">Top Cards in Set</h2>
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="border-b">
                                    <th class="text-left py-2" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                    <th class="text-right py-2" title="Current ungraded (loose) market price. Latest sale_price from card_sales where condition = 'ungraded'.">Loose Price</th>
                                    <th class="text-right py-2" title="PSA 10 graded market price. Latest sale_price from card_sales where condition = 'PSA10' or from psa10_price field.">PSA 10</th>
                                    <th class="text-right py-2" title="30-day % price change. Calculation: (latest_price - price_30d_ago) / price_30d_ago * 100.">Change</th>
                                    <th class="text-right py-2" title="Number of recorded sales in the last 90 days from card_sales table for this card.">Volume</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.topCards.map(card => `
                                    <tr class="border-b hover:bg-gray-50 cursor-pointer" onclick="window.location.hash='cards/${card.card_id}'">
                                        <td class="py-2 font-medium">${card.product_name}</td>
                                        <td class="text-right py-2">$${card.loose_price}</td>
                                        <td class="text-right py-2">$${card.psa10_price || 'N/A'}</td>
                                        <td class="text-right py-2">
                                            <span class="${card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}">
                                                ${card.price_change_pct >= 0 ? '+' : ''}${card.price_change_pct}%
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
    }

    async renderTopMovers() {
        return `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">Top Movers</h1>
                <div class="bg-white rounded-lg shadow p-6">
                    <div id="topMoversChart" class="chart-container"></div>
                </div>
            </div>
        `;
    }

    async renderVolatility() {
        return `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">Volatility Analysis</h1>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Volatility Distribution</h2>
                        <div id="volatilityDistChart" class="chart-container"></div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Risk vs Return</h2>
                        <div id="riskReturnChart" class="chart-container"></div>
                    </div>
                </div>
            </div>
        `;
    }

    async renderGradingPremium() {
        return `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">Grading Premium Analysis</h1>
                <div class="bg-white rounded-lg shadow p-6">
                    <div id="gradingPremiumChart" class="chart-container"></div>
                </div>
            </div>
        `;
    }

    async renderSetPerformance() {
        return `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">Set Performance</h1>
                <div class="bg-white rounded-lg shadow p-6">
                    <div id="setPerformanceChart" class="chart-container"></div>
                </div>
            </div>
        `;
    }

    async renderSetLiquidity() {
        return `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">Set Liquidity Analysis</h1>
                <div class="bg-white rounded-lg shadow p-6">
                    <div id="setLiquidityChart" class="chart-container"></div>
                </div>
            </div>
        `;
    }

    async renderSetComparison() {
        return `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">Set Comparison</h1>
                <div class="bg-white rounded-lg shadow p-6">
                    <div id="setComparisonChart" class="chart-container"></div>
                </div>
            </div>
        `;
    }

    renderError(message) {
        return `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <p class="text-gray-600">Error: ${message}</p>
            </div>
        `;
    }

    initializeCharts() {
        // Initialize Highcharts based on current page
        switch(this.currentPage) {
            case 'dashboard':
                this.initializeDashboardCharts();
                break;
            case 'cards':
                // Cards list doesn't need charts
                break;
            case this.currentPage.startsWith('cards/'):
                this.initializeCardDetailCharts();
                break;
            case 'sets':
                // Sets list doesn't need charts
                break;
            case this.currentPage.startsWith('sets/'):
                this.initializeSetDetailCharts();
                break;
        }
    }

    initializeDashboardCharts() {
        // Top Movers Bar Chart
        Highcharts.chart('topMoversChart', {
            chart: { type: 'bar' },
            title: { text: 'Top Price Movers' },
            xAxis: { categories: ['Card A', 'Card B', 'Card C'] },
            yAxis: { title: { text: 'Price Change (%)' } },
            series: [{
                name: 'Change %',
                data: [15.2, -8.5, 12.3],
                colors: ['#10b981', '#ef4444', '#10b981']
            }]
        });

        // Sentiment Pie Chart
        Highcharts.chart('sentimentChart', {
            chart: { type: 'pie' },
            title: { text: 'Market Sentiment' },
            series: [{
                name: 'Cards',
                data: [
                    { name: 'Rising', y: 45, color: '#10b981' },
                    { name: 'Stable', y: 35, color: '#6b7280' },
                    { name: 'Declining', y: 20, color: '#ef4444' }
                ]
            }]
        });
    }

    initializeCardDetailCharts() {
        // Price History Line Chart
        Highcharts.chart('priceHistoryChart', {
            chart: { type: 'line' },
            title: { text: 'Price History' },
            xAxis: { type: 'datetime' },
            yAxis: { title: { text: 'Price ($)' } },
            series: [{
                name: 'Loose Price',
                data: [[Date.now() - 86400000 * 7, 100], [Date.now(), 115]]
            }, {
                name: 'PSA 10',
                data: [[Date.now() - 86400000 * 7, 200], [Date.now(), 250]]
            }]
        });

        // Volume Chart
        Highcharts.chart('volumeChart', {
            chart: { type: 'column' },
            title: { text: 'Trading Volume' },
            xAxis: { type: 'datetime' },
            yAxis: { title: { text: 'Volume' } },
            series: [{
                name: 'Volume',
                data: [[Date.now() - 86400000 * 7, 1000], [Date.now(), 1500]]
            }]
        });
    }

    initializeSetDetailCharts() {
        // Set Price History
        Highcharts.chart('setPriceChart', {
            chart: { type: 'line' },
            title: { text: 'Average Price History' },
            xAxis: { type: 'datetime' },
            yAxis: { title: { text: 'Average Price ($)' } },
            series: [{
                name: 'Avg Price',
                data: [[Date.now() - 86400000 * 30, 50], [Date.now(), 65]]
            }]
        });

        // Set Volume
        Highcharts.chart('setVolumeChart', {
            chart: { type: 'column' },
            title: { text: 'Set Volume Trends' },
            xAxis: { type: 'datetime' },
            yAxis: { title: { text: 'Total Volume' } },
            series: [{
                name: 'Volume',
                data: [[Date.now() - 86400000 * 30, 5000], [Date.now(), 8000]]
            }]
        });
    }

    showLoading() {
        document.getElementById('loading').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loading').classList.remove('show');
    }

    async fetch(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
}

// Initialize the app
const app = new TradingCardAnalytics();
