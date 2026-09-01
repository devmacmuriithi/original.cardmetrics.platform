// Market Intelligence Dashboard JavaScript

let currentTab = 'opportunities';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    switchTab('opportunities');
});

// Load overview statistics
async function loadStats() {
    try {
        const response = await fetch('/api/intelligence/stats');
        const stats = await response.json();
        
        const statsHTML = `
            <div class="stat-card bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Total Cards</p>
                        <p class="text-3xl font-bold text-gray-900">${stats.total_cards?.toLocaleString() || 0}</p>
                        <p class="text-xs text-gray-500 mt-1">${stats.total_players?.toLocaleString() || 0} players</p>
                    </div>
                    <div class="p-3 bg-blue-100 rounded-full">
                        <i class="fas fa-layer-group text-2xl text-blue-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="stat-card bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">High Value Opportunities</p>
                        <p class="text-3xl font-bold text-yellow-600">${stats.high_value_opportunities?.toLocaleString() || 0}</p>
                        <p class="text-xs text-gray-500 mt-1">Score ≥ 50</p>
                    </div>
                    <div class="p-3 bg-yellow-100 rounded-full">
                        <i class="fas fa-bullseye text-2xl text-yellow-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="stat-card bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Active Alerts</p>
                        <p class="text-3xl font-bold text-red-600">${stats.total_alerts?.toLocaleString() || 0}</p>
                        <p class="text-xs text-gray-500 mt-1">${stats.critical_alerts || 0} critical</p>
                    </div>
                    <div class="p-3 bg-red-100 rounded-full">
                        <i class="fas fa-bell text-2xl text-red-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="stat-card bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Avg PSA 10 Premium</p>
                        <p class="text-3xl font-bold text-green-600">${((stats.avg_psa10_price / stats.avg_loose_price) || 0).toFixed(1)}x</p>
                        <p class="text-xs text-gray-500 mt-1">$${stats.avg_loose_price?.toFixed(2) || 0} → $${stats.avg_psa10_price?.toFixed(2) || 0}</p>
                    </div>
                    <div class="p-3 bg-green-100 rounded-full">
                        <i class="fas fa-certificate text-2xl text-green-600"></i>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('stats-overview').innerHTML = statsHTML;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Switch between tabs
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    // Find and activate the clicked button
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        const btnText = btn.textContent.toLowerCase();
        if (btnText.includes(tab)) {
            btn.classList.add('active', 'border-blue-500', 'text-blue-600');
            btn.classList.remove('border-transparent', 'text-gray-500');
        }
    });
    
    // Load tab content
    switch(tab) {
        case 'opportunities':
            loadOpportunities();
            break;
        case 'grading':
            loadGradingIntelligence();
            break;
        case 'efficiency':
            loadMarketEfficiency();
            break;
        case 'players':
            loadPlayerProfiles();
            break;
        case 'alerts':
            loadAlerts();
            break;
    }
}

// Load Investment Opportunities
async function loadOpportunities() {
    try {
        const response = await fetch('/api/intelligence/opportunities?limit=50');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const opportunities = await response.json();
        
        if (!Array.isArray(opportunities)) {
            throw new Error('Invalid response format');
        }
        
        let html = `
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h2 class="text-xl font-bold text-gray-900">Top Investment Opportunities</h2>
                    <p class="text-sm text-gray-600 mt-1">Ranked by grading difficulty, premium, and momentum</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Ranking by composite investment score (highest opportunity first).">Rank</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Card category: Base, Parallel, Insert, or Auto. Pulled from card_type field.">Type</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Composite investment score (0-100). Step 1: Calculate grade upside (PSA10 - raw price). Step 2: Weight by gem rate probability. Step 3: Adjust for momentum and liquidity. Step 4: Normalize to 0-100.">Score</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Current ungraded (raw) market price. Latest sale_price from card_sales where condition = 'ungraded'.">Raw Price</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="PSA 10 graded market price. Latest sale_price from card_sales where condition = 'PSA10' or from psa10_price field.">PSA 10</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Grading premium multiple. Calculation: PSA10_price / raw_price. Shows how many times more a graded card is worth.">Premium</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Gem rate percentage. Step 1: Count PSA 10 submissions from population data. Step 2: Divide by total submissions. Step 3: Higher % = better grading odds.">Gem Rate</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="7-day price momentum %. Step 1: Calculate 7d % change. Step 2: Weight by sales volume. Step 3: Normalize to show directional strength.">Momentum</th>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="External links to eBay, PSA Pop Report, and card detail page.">Links</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
        `;
        
        opportunities.forEach((opp, index) => {
            const typeClass = opp.opportunity_type.toLowerCase().replace(/\s+/g, '-');
            const typeColor = {
                'grading-arbitrage': 'bg-yellow-100 text-yellow-800',
                'rising-star': 'bg-green-100 text-green-800',
                'undervalued-gem': 'bg-purple-100 text-purple-800',
                'improving-quality': 'bg-blue-100 text-blue-800',
                'standard-opportunity': 'bg-gray-100 text-gray-800'
            }[typeClass] || 'bg-gray-100 text-gray-800';
            
            const riskColor = {
                'High Risk': 'text-red-600',
                'Medium Risk': 'text-yellow-600',
                'Low Risk': 'text-green-600'
            }[opp.risk_level] || 'text-gray-600';
            
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${index + 1}</td>
                    <td class="px-6 py-4">
                        <div class="text-sm font-medium text-gray-900">${opp.player_name}</div>
                        <div class="text-sm text-gray-500">${opp.parallel} #${opp.card_number}</div>
                        <div class="text-xs text-gray-400 ${riskColor}">${opp.risk_level}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-semibold rounded ${typeColor}">
                            ${opp.opportunity_type}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <span class="text-lg font-bold text-blue-600">${opp.investment_score}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">$${opp.loose_price}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">$${opp.bgs_10_price}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <span class="text-sm font-semibold text-green-600">${opp.grade_premium_multiplier}x</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <span class="text-sm ${opp.gem_rate_pct < 20 ? 'text-red-600 font-semibold' : 'text-gray-900'}">${opp.gem_rate_pct}%</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <span class="text-sm ${opp.momentum_pct > 0 ? 'text-green-600' : 'text-red-600'}">${opp.momentum_pct > 0 ? '+' : ''}${opp.momentum_pct}%</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                        <a href="${opp.gemrate_url}" target="_blank" class="text-blue-600 hover:text-blue-800 mx-1" title="GemRate">
                            <i class="fas fa-chart-bar"></i>
                        </a>
                        <a href="${opp.cardladder_all_graded_url}" target="_blank" class="text-green-600 hover:text-green-800 mx-1" title="CardLadder">
                            <i class="fas fa-dollar-sign"></i>
                        </a>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('tab-content').innerHTML = html;
    } catch (error) {
        console.error('Error loading opportunities:', error);
        document.getElementById('tab-content').innerHTML = '<div class="text-red-600">Error loading data</div>';
    }
}

// Load Grading Intelligence
async function loadGradingIntelligence() {
    try {
        const response = await fetch('/api/intelligence/grading?limit=100');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const cards = await response.json();
        
        if (!Array.isArray(cards)) {
            throw new Error('Invalid response format');
        }
        
        let html = `
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h2 class="text-xl font-bold text-gray-900">Grading Intelligence</h2>
                    <p class="text-sm text-gray-600 mt-1">Expected value analysis for grading candidates</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Grading difficulty classification. Based on gem rate: Easy (>70%), Moderate (40-70%), Difficult (20-40%), Very Difficult (<20%).">Difficulty</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Gem rate percentage. Step 1: Count PSA 10 submissions. Step 2: Divide by total submissions. Step 3: Higher % = better grading odds.">Gem Rate</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Expected value after grading. Step 1: (Gem_rate * PSA10_price) + ((1 - Gem_rate) * PSA9_price). Step 2: Subtract grading cost (~$20).">Expected Value</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Profit if card gems (gets PSA 10). Calculation: PSA10_price - raw_price - grading_cost. Shows upside in best-case scenario.">If Gem Profit</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Investment recommendation. Strong Buy = high expected value + high gem rate; Hold = marginal; Avoid = low gem rate or negative expected value.">Recommendation</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Price trend over last 30 days. Rising = price up >5%, Stable = +/-5%, Declining = down >5%.">Trend</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Total PSA-graded population. Sum of all PSA submissions for this card from population report data.">Population</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
        `;
        
        cards.forEach(card => {
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
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        $${card.net_profit_if_gem}
                    </td>
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
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        ${card.graded_past_month} / month
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('tab-content').innerHTML = html;
    } catch (error) {
        console.error('Error loading grading intelligence:', error);
    }
}

// Load Market Efficiency
async function loadMarketEfficiency() {
    try {
        const response = await fetch('/api/intelligence/market-efficiency?limit=100');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const cards = await response.json();
        
        if (!Array.isArray(cards)) {
            throw new Error('Invalid response format');
        }
        
        let html = `
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h2 class="text-xl font-bold text-gray-900">Market Efficiency Analysis</h2>
                    <p class="text-sm text-gray-600 mt-1">Price efficiency vs expected premiums based on gem rates</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Card name and player. Pulled from product_name in the cards table.">Card</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Gem rate percentage. Step 1: Count PSA 10 submissions. Step 2: Divide by total submissions. Step 3: Higher % = better grading odds.">Gem Rate</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Actual grading premium observed. Calculation: PSA10_price / raw_price. Shows real market multiplier.">Actual Premium</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Expected premium based on gem rate. Step 1: Lookup typical premium for this gem rate tier. Step 2: Compare to actual. Shows if market is over/under-pricing.">Expected</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Premium variance. Calculation: Actual_premium - Expected_premium. Positive = market paying more than expected (sell signal). Negative = undervalued (buy signal).">Variance</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Premium efficiency rating. High = actual premium exceeds expected given gem rate; Low = underperforming.">Efficiency</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Trade signal based on variance. Overpriced = actual > expected (consider selling). Underpriced = actual < expected (consider buying). Fair = near expected.">Signal</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Liquidity level. High = frequent sales and good volume; Medium = moderate; Low = rare sales or thin market.">Liquidity</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
        `;
        
        cards.forEach(card => {
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
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('tab-content').innerHTML = html;
    } catch (error) {
        console.error('Error loading market efficiency:', error);
    }
}

// Load Player Profiles
async function loadPlayerProfiles() {
    try {
        const response = await fetch('/api/intelligence/player-profiles?limit=50');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const players = await response.json();
        
        if (!Array.isArray(players)) {
            throw new Error('Invalid response format');
        }
        
        let html = `
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h2 class="text-xl font-bold text-gray-900">Player Grading Profiles</h2>
                    <p class="text-sm text-gray-600 mt-1">Player-level grading statistics across all parallels</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Player name. Pulled from player_name field across all cards for this player.">Player</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Number of parallel card variations tracked for this player. Count of distinct card_type entries.">Parallels</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Total PSA-graded cards for this player across all variations. Sum of population counts from PSA data.">Total Graded</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Average gem rate across all player cards. Step 1: Sum PSA 10 counts. Step 2: Divide by total graded. Step 3: Average across all card variations.">Avg Gem Rate</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Overall grading difficulty for this player's cards. Based on avg gem rate: Easy (>70%), Moderate (40-70%), Difficult (20-40%), Very Difficult (<20%).">Difficulty</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" title="Average grading premium across player cards. Calculation: AVG(PSA10_price / raw_price) across all variations.">Avg Premium</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Market tier based on average card price. Budget (<$20), Mid ($20-$100), Premium ($100-$500), Ultra (>$500).">Market Tier</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="Investment rating. Step 1: Score avg premium + avg gem rate + momentum. Step 2: Adjust for market tier liquidity. Step 3: A = excellent, B = good, C = average, D = poor.">Investment Rating</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
        `;
        
        players.forEach(player => {
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
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('tab-content').innerHTML = html;
    } catch (error) {
        console.error('Error loading player profiles:', error);
    }
}

// Load Opportunity Alerts
async function loadAlerts() {
    try {
        const response = await fetch('/api/intelligence/alerts?limit=100');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const alerts = await response.json();
        
        if (!Array.isArray(alerts)) {
            throw new Error('Invalid response format');
        }
        
        let html = `
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h2 class="text-xl font-bold text-gray-900">Opportunity Alerts</h2>
                    <p class="text-sm text-gray-600 mt-1">Real-time signals based on momentum, pricing, and grading activity</p>
                </div>
                <div class="p-6 space-y-4">
        `;
        
        alerts.forEach(alert => {
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
                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-2">
                                <span class="px-3 py-1 text-xs font-bold text-white rounded ${priorityClass}">
                                    ${alert.priority}
                                </span>
                                <span class="flex items-center text-sm font-semibold text-gray-900">
                                    <i class="fas ${alertIcon} mr-2"></i>
                                    ${alert.alert_type}
                                </span>
                            </div>
                            <div class="mb-3">
                                <div class="text-lg font-bold text-gray-900">${alert.player_name}</div>
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
        
        html += `
                </div>
            </div>
        `;
        
        document.getElementById('tab-content').innerHTML = html;
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}
