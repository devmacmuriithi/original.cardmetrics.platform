// Sets Analytics Page JavaScript
class SetsPage {
    constructor() {
        this.currentView = this.getViewFromPath();
        this.init();
    }

    getViewFromPath() {
        const path = window.location.pathname;
        if (path === '/sets/performance') return 'performance';
        if (path === '/sets/liquidity') return 'liquidity';
        if (path.startsWith('/sets/detail/')) return 'detail';
        return 'list';
    }

    async init() {
        this.showLoading();
        try {
            switch(this.currentView) {
                case 'list':
                    await this.renderSetsList();
                    break;
                case 'performance':
                    await this.renderSetPerformance();
                    break;
                case 'liquidity':
                    await this.renderSetLiquidity();
                    break;
                case 'detail':
                    const setId = window.location.pathname.split('/').pop();
                    await this.renderSetDetail(setId);
                    break;
            }
        } catch (error) {
            console.error('Error loading sets page:', error);
            this.showError(error.message);
        }
        this.hideLoading();
    }

    async renderSetsList() {
        const sets = await this.fetch('/api/sets?limit=50');
        
        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Sets Analytics</h1>
                    <p class="text-gray-600 mt-2">Analyze performance across different card sets</p>
                </div>
                
                <!-- Sets Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${sets.map(set => `
                        <a href="/sets/detail/${set.id}" class="bg-white rounded-lg shadow hover:shadow-lg transition">
                            <div class="p-6">
                                <h3 class="font-semibold text-gray-900 mb-2">${set.console_name}</h3>
                                
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p class="text-sm text-gray-600">Cards</p>
                                        <p class="text-lg font-bold">${set.card_count ? set.card_count.toLocaleString() : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p class="text-sm text-gray-600">Avg Price</p>
                                        <p class="text-lg font-bold">$${set.avg_price || 'N/A'}</p>
                                    </div>
                                </div>
                                
                                <div class="space-y-2 text-sm">
                                    <div class="flex justify-between">
                                        <span>Price Range:</span>
                                        <span>$${set.min_price || 'N/A'} - $${set.max_price || 'N/A'}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span>Total Volume:</span>
                                        <span>${set.total_volume ? set.total_volume.toLocaleString() : 'N/A'}</span>
                                    </div>
                                </div>
                                
                                <div class="mt-4 pt-4 border-t">
                                    <div class="flex justify-between text-sm">
                                        <span class="text-green-600">↑ ${set.rising_count || 0}</span>
                                        <span class="text-red-600">↓ ${set.declining_count || 0}</span>
                                        <span class="text-gray-600">→ ${set.stable_count || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('content').innerHTML = html;
    }

    async renderSetPerformance() {
        const sets = await this.fetch('/api/sets?limit=200');

        if (!sets || sets.length === 0) {
            document.getElementById('content').innerHTML = `
                <div class="text-center py-10 text-gray-500">
                    <i class="fas fa-database text-3xl mb-3"></i>
                    <p>No set performance data available.</p>
                </div>
            `;
            return;
        }

        const rankedByAvgPrice = [...sets]
            .filter(s => s.avg_price != null)
            .sort((a, b) => b.avg_price - a.avg_price)
            .slice(0, 15);

        const rankedByVolume = [...sets]
            .filter(s => s.total_volume != null)
            .sort((a, b) => b.total_volume - a.total_volume)
            .slice(0, 15);

        const topPriced = rankedByAvgPrice[0];
        const topVolume = rankedByVolume[0];
        const totalCards = sets.reduce((sum, s) => sum + (Number(s.card_count) || 0), 0);
        const avgSetPrice = sets.length > 0
            ? (sets.reduce((sum, s) => sum + (Number(s.avg_price) || 0), 0) / sets.length)
            : 0;

        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Set Performance</h1>
                    <p class="text-gray-600 mt-2">Live set-level pricing, breadth, and trend health from latest dataset</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-5">
                        <p class="text-sm text-gray-500">Tracked Sets</p>
                        <p class="text-3xl font-bold text-gray-900 mt-1">${sets.length.toLocaleString()}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-5">
                        <p class="text-sm text-gray-500">Cards Across Sets</p>
                        <p class="text-3xl font-bold text-gray-900 mt-1">${totalCards.toLocaleString()}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-5">
                        <p class="text-sm text-gray-500">Avg Set Price</p>
                        <p class="text-3xl font-bold text-blue-700 mt-1">$${avgSetPrice.toFixed(2)}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-5">
                        <p class="text-sm text-gray-500">Top Set (Avg Price)</p>
                        <p class="text-lg font-semibold text-gray-900 mt-1 truncate" title="${topPriced?.console_name || 'N/A'}">${topPriced?.console_name || 'N/A'}</p>
                        <p class="text-sm text-gray-600">$${topPriced?.avg_price || 0}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top Sets by Average Price</h2>
                        <div id="setPerformanceChart" class="chart-container"></div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top Sets by Total Volume</h2>
                        <div id="setVolumeLeadersChart" class="chart-container"></div>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold mb-4">Performance Leaderboard</h2>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Card set name (e.g., 2025 Topps Baseball). Pulled from console_name in card_sets table.">Set</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Total number of cards tracked in this set. Count of rows in cards table linked by console_id.">Cards</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Average ungraded price across all cards in this set. Calculation: SUM(loose_price) / COUNT(cards) where loose_price > 0.">Avg Price</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Price range within the set. Calculation: MAX(loose_price) - MIN(loose_price) among cards in the set.">Price Range</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Total sales volume across all cards in this set. Sum of sales_volume from cards table linked to this set.">Volume</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Trend health score (0-100). Step 1: Calculate % of cards Rising vs Declining. Step 2: Weight by volume. Step 3: Rising majority = high score; Declining majority = low score.">Trend Health</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${rankedByAvgPrice.map(set => {
                                    const rising = Number(set.rising_count) || 0;
                                    const declining = Number(set.declining_count) || 0;
                                    const stable = Number(set.stable_count) || 0;
                                    const totalTrend = rising + declining + stable;
                                    const trendHealth = totalTrend > 0 ? ((rising / totalTrend) * 100) : 0;
                                    return `
                                        <tr class="hover:bg-gray-50 cursor-pointer" onclick="window.location.href='/sets/detail/${set.id}'">
                                            <td class="px-4 py-3">
                                                <div class="text-sm font-medium text-gray-900">${set.console_name}</div>
                                            </td>
                                            <td class="px-4 py-3 text-right text-sm text-gray-800">${(Number(set.card_count) || 0).toLocaleString()}</td>
                                            <td class="px-4 py-3 text-right text-sm font-semibold text-blue-700">$${set.avg_price || 0}</td>
                                            <td class="px-4 py-3 text-right text-sm text-gray-700">$${set.min_price || 0} - $${set.max_price || 0}</td>
                                            <td class="px-4 py-3 text-right text-sm font-semibold text-purple-700">${(Number(set.total_volume) || 0).toLocaleString()}</td>
                                            <td class="px-4 py-3 text-right text-sm ${trendHealth >= 50 ? 'text-green-600' : trendHealth >= 30 ? 'text-yellow-600' : 'text-red-600'}">${trendHealth.toFixed(1)}%</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('content').innerHTML = html;

        setTimeout(() => {
            Highcharts.chart('setPerformanceChart', {
                chart: { type: 'bar', height: 520 },
                title: { text: null },
                xAxis: {
                    categories: rankedByAvgPrice.map(s => s.console_name.length > 42 ? `${s.console_name.slice(0, 42)}...` : s.console_name),
                    labels: { style: { fontSize: '10px' } }
                },
                yAxis: { title: { text: 'Average Price ($)' } },
                legend: { enabled: false },
                series: [{
                    name: 'Avg Price',
                    data: rankedByAvgPrice.map(s => Number(s.avg_price) || 0),
                    color: '#2563eb'
                }]
            });

            Highcharts.chart('setVolumeLeadersChart', {
                chart: { type: 'column', height: 520 },
                title: { text: null },
                xAxis: {
                    categories: rankedByVolume.map(s => s.console_name.length > 28 ? `${s.console_name.slice(0, 28)}...` : s.console_name),
                    labels: { rotation: -35, style: { fontSize: '10px' } }
                },
                yAxis: { title: { text: 'Total Volume' } },
                legend: { enabled: false },
                series: [{
                    name: 'Volume',
                    data: rankedByVolume.map(s => Number(s.total_volume) || 0),
                    color: '#7c3aed'
                }]
            });
        }, 100);
    }

    async renderSetLiquidity() {
        const sets = await this.fetch('/api/sets?limit=250');

        if (!sets || sets.length === 0) {
            document.getElementById('content').innerHTML = `
                <div class="text-center py-10 text-gray-500">
                    <i class="fas fa-water text-3xl mb-3"></i>
                    <p>No set liquidity data available.</p>
                </div>
            `;
            return;
        }

        const enriched = sets.map(set => {
            const cardCount = Number(set.card_count) || 0;
            const totalVolume = Number(set.total_volume) || 0;
            const avgPrice = Number(set.avg_price) || 0;
            const velocity = cardCount > 0 ? totalVolume / cardCount : 0;
            const dollarLiquidity = totalVolume * avgPrice;
            return {
                ...set,
                cardCount,
                totalVolume,
                avgPrice,
                velocity,
                dollarLiquidity,
                liquidityTier: velocity > 120 ? 'High' : velocity > 40 ? 'Medium' : 'Low'
            };
        });

        const topLiquidity = [...enriched]
            .sort((a, b) => b.dollarLiquidity - a.dollarLiquidity)
            .slice(0, 20);

        const tierCounts = { High: 0, Medium: 0, Low: 0 };
        enriched.forEach(s => {
            tierCounts[s.liquidityTier] = (tierCounts[s.liquidityTier] || 0) + 1;
        });

        const totalDollarLiquidity = enriched.reduce((sum, s) => sum + s.dollarLiquidity, 0);
        const avgVelocity = enriched.length > 0
            ? enriched.reduce((sum, s) => sum + s.velocity, 0) / enriched.length
            : 0;

        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Set Liquidity Analysis</h1>
                    <p class="text-gray-600 mt-2">Live liquidity depth, velocity, and tradability signals by set</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-5">
                        <p class="text-sm text-gray-500">Total $ Liquidity</p>
                        <p class="text-2xl font-bold text-gray-900 mt-1">$${totalDollarLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-5">
                        <p class="text-sm text-gray-500">Avg Velocity (Vol/Card)</p>
                        <p class="text-2xl font-bold text-blue-700 mt-1">${avgVelocity.toFixed(1)}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-5">
                        <p class="text-sm text-gray-500">High Liquidity Sets</p>
                        <p class="text-2xl font-bold text-green-700 mt-1">${tierCounts.High}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-5">
                        <p class="text-sm text-gray-500">Coverage</p>
                        <p class="text-2xl font-bold text-gray-900 mt-1">${enriched.length.toLocaleString()} sets</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Liquidity Tier Distribution</h2>
                        <div id="setLiquidityTierChart" class="chart-container"></div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Top Sets by Dollar Liquidity</h2>
                        <div id="setLiquidityChart" class="chart-container"></div>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold mb-4">Liquidity Leaderboard</h2>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Card set name. Pulled from console_name in card_sets table.">Set</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Total number of sales transactions across all cards in this set in the last 90 days.">Volume</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Average ungraded price across all cards in this set. Calculation: SUM(loose_price) / COUNT(cards) where loose_price > 0.">Avg Price</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Dollar liquidity. Calculation: Total sales volume * Avg sale price. Represents total dollars traded in this set over the last 90 days.">Dollar Liquidity</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Sales velocity (turnover rate). Step 1: Count total sales in last 90 days. Step 2: Divide by number of cards in set. Step 3: Higher = cards sell more frequently.">Velocity</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Market tier classification. Based on avg price: Budget (<$20), Mid ($20-$100), Premium ($100-$500), Ultra (>$500).">Tier</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${topLiquidity.map(set => `
                                    <tr class="hover:bg-gray-50 cursor-pointer" onclick="window.location.href='/sets/detail/${set.id}'">
                                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${set.console_name}</td>
                                        <td class="px-4 py-3 text-right text-sm text-gray-800">${set.totalVolume.toLocaleString()}</td>
                                        <td class="px-4 py-3 text-right text-sm text-gray-800">$${set.avgPrice.toFixed(2)}</td>
                                        <td class="px-4 py-3 text-right text-sm font-semibold text-purple-700">$${set.dollarLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td class="px-4 py-3 text-right text-sm text-gray-800">${set.velocity.toFixed(1)}</td>
                                        <td class="px-4 py-3 text-sm">
                                            <span class="px-2 py-1 rounded-full text-xs font-semibold ${
                                                set.liquidityTier === 'High' ? 'bg-green-100 text-green-800' :
                                                set.liquidityTier === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }">${set.liquidityTier}</span>
                                        </td>
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
            Highcharts.chart('setLiquidityTierChart', {
                chart: { type: 'pie', height: 520 },
                title: { text: null },
                plotOptions: {
                    pie: {
                        innerSize: '45%',
                        dataLabels: { enabled: true, format: '{point.name}: {point.y}' }
                    }
                },
                series: [{
                    name: 'Sets',
                    data: [
                        { name: 'High', y: tierCounts.High, color: '#16a34a' },
                        { name: 'Medium', y: tierCounts.Medium, color: '#d97706' },
                        { name: 'Low', y: tierCounts.Low, color: '#6b7280' }
                    ]
                }]
            });

            Highcharts.chart('setLiquidityChart', {
                chart: { type: 'bar', height: 520 },
                title: { text: null },
                xAxis: {
                    categories: topLiquidity.slice(0, 15).map(s => s.console_name.length > 42 ? `${s.console_name.slice(0, 42)}...` : s.console_name),
                    labels: { style: { fontSize: '10px' } }
                },
                yAxis: { title: { text: 'Dollar Liquidity ($)' } },
                legend: { enabled: false },
                series: [{
                    name: 'Dollar Liquidity',
                    data: topLiquidity.slice(0, 15).map(s => s.dollarLiquidity),
                    color: '#7c3aed'
                }]
            });
        }, 100);
    }

    async renderSetDetail(setId) {
        const data = await this.fetch(`/api/sets/${setId}`);
        
        if (!data.set) {
            this.showError('Set not found');
            return;
        }

        const setCardCount = Number(data.set.card_count) || 0;
        const totalVolume = Number(data.set.total_volume) || 0;
        const avgPrice = Number(data.set.avg_price) || 0;
        const risingCount = Number(data.set.rising_count) || 0;
        const decliningCount = Number(data.set.declining_count) || 0;
        const stableCount = Number(data.set.stable_count) || 0;
        const trendTotal = risingCount + decliningCount + stableCount;
        const risingRatio = trendTotal > 0 ? (risingCount / trendTotal) * 100 : 0;
        const volumePerCard = setCardCount > 0 ? totalVolume / setCardCount : 0;
        
        const html = `
            <div class="fade-in">
                <div class="mb-8">
                    <a href="/sets" class="mb-4 inline-block text-blue-600 hover:text-blue-800">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Sets
                    </a>
                    <h1 class="text-3xl font-bold text-gray-900">${data.set.console_name}</h1>
                    <p class="text-gray-600 mt-2">${data.set.name || ''}</p>
                </div>
                
                <!-- Set Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Total Cards</p>
                        <p class="text-2xl font-bold">${setCardCount.toLocaleString()}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Avg Price</p>
                        <p class="text-2xl font-bold">$${avgPrice.toFixed(2)}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Total Volume</p>
                        <p class="text-2xl font-bold">${totalVolume.toLocaleString()}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Rising Cards</p>
                        <p class="text-2xl font-bold text-green-600">${risingCount}</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Rising Ratio</p>
                        <p class="text-2xl font-bold text-indigo-700">${risingRatio.toFixed(1)}%</p>
                        <p class="text-xs text-gray-500 mt-1">vs ${decliningCount} declining</p>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <p class="text-sm text-gray-600">Volume / Card</p>
                        <p class="text-2xl font-bold text-purple-700">${volumePerCard.toFixed(1)}</p>
                        <p class="text-xs text-gray-500 mt-1">Liquidity depth</p>
                    </div>
                </div>
                
                <!-- Charts -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Average Price History</h2>
                        <div class="chart-container"><canvas id="setPriceChart"></canvas></div>
                    </div>
                    
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Volume Trends</h2>
                        <div class="chart-container"><canvas id="setVolumeChart"></canvas></div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Market Breadth (Rising %)</h2>
                        <div class="chart-container"><canvas id="setBreadthChart"></canvas></div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">Cards Tracked Over Time</h2>
                        <div class="chart-container"><canvas id="setCardCountChart"></canvas></div>
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
                                ${data.topCards && data.topCards.length > 0 ? data.topCards.map(card => `
                                    <tr class="border-b hover:bg-gray-50 cursor-pointer" onclick="window.location.href='/cards/detail/${card.card_id}'">
                                        <td class="py-2 font-medium">${card.product_name}</td>
                                        <td class="text-right py-2">$${card.loose_price || 'N/A'}</td>
                                        <td class="text-right py-2">$${card.psa10_price || 'N/A'}</td>
                                        <td class="text-right py-2">
                                            <span class="${card.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}">
                                                ${card.price_change_pct ? (card.price_change_pct >= 0 ? '+' : '') + card.price_change_pct + '%' : 'N/A'}
                                            </span>
                                        </td>
                                        <td class="text-right py-2">${card.sales_volume ? card.sales_volume.toLocaleString() : 'N/A'}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" class="text-center py-4 text-gray-500">No cards found</td></tr>'}
                            </tbody>
                        </table>
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
            const avgPriceSeries = data.history.map(h => Number(h.avg_price) || 0);
            const volumeSeries = data.history.map(h => Number(h.total_volume) || 0);
            const cardCountSeries = data.history.map(h => Number(h.card_count) || 0);
            const breadthSeries = data.history.map(h => {
                const total = Number(h.card_count) || 0;
                const rising = Number(h.rising_count) || 0;
                return total > 0 ? Number(((rising / total) * 100).toFixed(2)) : 0;
            });

            new Chart(document.getElementById('setPriceChart'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Avg Price',
                        data: avgPriceSeries,
                        borderColor: '#1d4ed8',
                        backgroundColor: 'rgba(29, 78, 216, 0.15)',
                        tension: 0.25
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Price ($)' } } }
                }
            });

            new Chart(document.getElementById('setVolumeChart'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Total Volume',
                        data: volumeSeries,
                        backgroundColor: 'rgba(124, 58, 237, 0.65)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Volume' } } }
                }
            });

            new Chart(document.getElementById('setBreadthChart'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Rising %',
                        data: breadthSeries,
                        borderColor: '#059669',
                        backgroundColor: 'rgba(5, 150, 105, 0.2)',
                        tension: 0.25
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: { display: true, text: 'Rising Share (%)' }
                        }
                    }
                }
            });

            new Chart(document.getElementById('setCardCountChart'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Cards Tracked',
                        data: cardCountSeries,
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.18)',
                        tension: 0.2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Card Count' } } }
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

// Initialize sets page
new SetsPage();
