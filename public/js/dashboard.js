// Dashboard Page JavaScript
class Dashboard {
    constructor() {
        this.init();
    }

    async init() {
        this.showLoading();
        try {
            await this.loadDashboard();
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showError(error.message);
        }
        this.hideLoading();
    }

    async loadDashboard() {
        const data = await this.fetch('/api/dashboard');
        console.log('Dashboard data received:', data);
        console.log('Top Movers count:', data.topMovers?.length);
        console.log('Metrics:', data.metrics);
        
        const html = `
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
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-xl font-semibold">Top Movers</h2>
                            <a href="/cards/top-movers" class="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                                View All <i class="fas fa-arrow-right ml-1"></i>
                            </a>
                        </div>
                        <div class="overflow-x-auto -mx-6 px-6">
                            <table class="min-w-full" style="min-width: 600px;">
                                <thead>
                                    <tr class="border-b">
                                        <th class="text-left py-2 px-2 whitespace-nowrap" style="min-width: 200px;" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                        <th class="text-right py-2 px-2 whitespace-nowrap" style="min-width: 100px;" title="30-day % price change. Calculation: (latest_price - price_30d_ago) / price_30d_ago * 100.">Change</th>
                                        <th class="text-right py-2 px-2 whitespace-nowrap" style="min-width: 100px;" title="Current ungraded market price. Latest sale_price from card_sales where condition = 'ungraded'.">Price</th>
                                        <th class="text-right py-2 px-2 whitespace-nowrap" style="min-width: 100px;" title="Number of recorded sales in the last 90 days from card_sales table.">Volume</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.topMovers.map(card => `
                                        <tr class="border-b hover:bg-gray-50">
                                            <td class="py-2 px-2">
                                                <div>
                                                    <div class="font-medium whitespace-nowrap">${card.product_name}</div>
                                                    <div class="text-sm text-gray-600 whitespace-nowrap">${card.console_name}</div>
                                                </div>
                                            </td>
                                            <td class="text-right py-2 px-2 whitespace-nowrap">
                                                <span class="${card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                                                    ${card.price_change_pct >= 0 ? '+' : ''}${card.price_change_pct}%
                                                </span>
                                            </td>
                                            <td class="text-right py-2 px-2 whitespace-nowrap">$${card.loose_price}</td>
                                            <td class="text-right py-2 px-2 whitespace-nowrap">${card.sales_volume.toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-xl font-semibold">Top Sets by Volume</h2>
                            <a href="/sets/top-volume" class="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                                View All <i class="fas fa-arrow-right ml-1"></i>
                            </a>
                        </div>
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
        
        document.getElementById('content').innerHTML = html;
        
        // Initialize charts
        setTimeout(() => this.initializeCharts(data), 100);
    }

    initializeCharts(data) {
        console.log('Initializing charts...');
        console.log('topMoversChart element:', document.getElementById('topMoversChart'));
        console.log('sentimentChart element:', document.getElementById('sentimentChart'));
        
        // Top Movers Bar Chart
        if (data.topMovers && data.topMovers.length > 0) {
            console.log('Rendering Top Movers chart with', data.topMovers.length, 'items');
            try {
                const chartData = data.topMovers.slice(0, 10).map(c => {
                    const pct = parseFloat(c.price_change_pct);
                    console.log('Card:', c.product_name.substring(0, 20), 'Change:', pct);
                    return {
                        y: pct,
                        color: pct >= 0 ? '#10b981' : '#ef4444'
                    };
                });
                
                Highcharts.chart('topMoversChart', {
                    chart: { type: 'bar', height: 400 },
                    title: { text: null },
                    xAxis: { 
                        categories: data.topMovers.slice(0, 10).map(c => c.product_name.substring(0, 30)),
                        labels: { style: { fontSize: '11px' } }
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
                        data: chartData
                    }]
                });
            } catch (error) {
                console.error('Error rendering Top Movers chart:', error);
                document.getElementById('topMoversChart').innerHTML = '<p class="text-red-500 text-center py-8">Error rendering chart</p>';
            }
        } else {
            document.getElementById('topMoversChart').innerHTML = '<p class="text-gray-500 text-center py-8">No price movement data available</p>';
        }

        // Sentiment Pie Chart
        const risingCards = parseInt(data.metrics.rising_cards) || 0;
        const stableCards = parseInt(data.metrics.stable_cards) || 0;
        const decliningCards = parseInt(data.metrics.declining_cards) || 0;
        const totalCards = risingCards + stableCards + decliningCards;
        
        console.log('Sentiment data - Rising:', risingCards, 'Stable:', stableCards, 'Declining:', decliningCards);
        
        if (totalCards > 0) {
            try {
                Highcharts.chart('sentimentChart', {
                    chart: { type: 'pie', height: 400 },
                    title: { text: null },
                    plotOptions: {
                        pie: {
                            dataLabels: {
                                enabled: true,
                                format: '{point.name}: {point.percentage:.1f}%'
                            }
                        }
                    },
                    series: [{
                        name: 'Cards',
                        data: [
                            { name: 'Rising', y: risingCards, color: '#10b981' },
                            { name: 'Stable', y: stableCards, color: '#6b7280' },
                            { name: 'Declining', y: decliningCards, color: '#ef4444' }
                        ]
                    }]
                });
            } catch (error) {
                console.error('Error rendering Sentiment chart:', error);
                document.getElementById('sentimentChart').innerHTML = '<p class="text-red-500 text-center py-8">Error rendering chart</p>';
            }
        } else {
            document.getElementById('sentimentChart').innerHTML = '<p class="text-gray-500 text-center py-8">No sentiment data available</p>';
        }
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

// Initialize dashboard
new Dashboard();
