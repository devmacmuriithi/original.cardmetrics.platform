// Market Intelligence Dashboard JavaScript

let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

async function loadDashboard() {
    try {
        const response = await fetch('/api/intelligence/dashboard');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        renderKPIs(data.kpis);
        renderCharts(data.charts);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('kpiCards').innerHTML = `
            <div class="col-span-4 bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <i class="fas fa-exclamation-triangle text-3xl text-red-600 mb-4"></i>
                <p class="text-red-800">Error loading dashboard data. Please try again.</p>
            </div>
        `;
    }
}

function renderKPIs(kpis) {
    const kpiHTML = `
        <div class="kpi-card bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium opacity-90">Total Cards</h3>
                <i class="fas fa-layer-group text-2xl opacity-75"></i>
            </div>
            <p class="text-3xl font-bold">${parseInt(kpis.total_cards).toLocaleString()}</p>
            <p class="text-sm opacity-75 mt-2">${parseInt(kpis.total_players).toLocaleString()} players • ${parseInt(kpis.total_parallels).toLocaleString()} parallels</p>
        </div>

        <div class="kpi-card bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium opacity-90">Avg Gem Rate</h3>
                <i class="fas fa-certificate text-2xl opacity-75"></i>
            </div>
            <p class="text-3xl font-bold">${kpis.avg_gem_rate}%</p>
            <p class="text-sm opacity-75 mt-2">Average PSA 10 rate across all cards</p>
        </div>

        <div class="kpi-card bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium opacity-90">Avg Premium</h3>
                <i class="fas fa-chart-line text-2xl opacity-75"></i>
            </div>
            <p class="text-3xl font-bold">${kpis.avg_premium}x</p>
            <p class="text-sm opacity-75 mt-2">PSA 10 vs Raw price multiplier</p>
        </div>

        <div class="kpi-card bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium opacity-90">Total Sales Volume</h3>
                <i class="fas fa-shopping-cart text-2xl opacity-75"></i>
            </div>
            <p class="text-3xl font-bold">${parseInt(kpis.total_sales).toLocaleString()}</p>
            <p class="text-sm opacity-75 mt-2">Cumulative market transactions</p>
        </div>

        <div class="kpi-card bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium opacity-90">Avg Raw Price</h3>
                <i class="fas fa-dollar-sign text-2xl opacity-75"></i>
            </div>
            <p class="text-3xl font-bold">$${kpis.avg_raw_price}</p>
            <p class="text-sm opacity-75 mt-2">Average ungraded card price</p>
        </div>

        <div class="kpi-card bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium opacity-90">Avg PSA 10 Price</h3>
                <i class="fas fa-gem text-2xl opacity-75"></i>
            </div>
            <p class="text-3xl font-bold">$${kpis.avg_psa10_price}</p>
            <p class="text-sm opacity-75 mt-2">Average graded gem price</p>
        </div>

        <div class="kpi-card bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium opacity-90">Value Increase</h3>
                <i class="fas fa-arrow-up text-2xl opacity-75"></i>
            </div>
            <p class="text-3xl font-bold">$${(kpis.avg_psa10_price - kpis.avg_raw_price).toFixed(2)}</p>
            <p class="text-sm opacity-75 mt-2">Avg profit potential per card</p>
        </div>

        <div class="kpi-card rounded-lg shadow-lg p-6 text-white" style="background: linear-gradient(to bottom right, #14b8a6, #0d9488);">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium opacity-90">ROI Potential</h3>
                <i class="fas fa-percentage text-2xl opacity-75"></i>
            </div>
            <p class="text-3xl font-bold">${((kpis.avg_psa10_price / kpis.avg_raw_price - 1) * 100).toFixed(0)}%</p>
            <p class="text-sm opacity-75 mt-2">Average return on investment</p>
        </div>
    `;
    
    document.getElementById('kpiCards').innerHTML = kpiHTML;
}

function renderCharts(data) {
    // Chart 1: Opportunity Types (Doughnut)
    charts.opportunityTypes = new Chart(document.getElementById('opportunityTypesChart'), {
        type: 'doughnut',
        data: {
            labels: data.opportunityTypes.map(d => d.opportunity_type),
            datasets: [{
                data: data.opportunityTypes.map(d => d.count),
                backgroundColor: ['#fbbf24', '#10b981', '#8b5cf6', '#3b82f6', '#6b7280']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Chart 2: Alert Priority (Pie)
    charts.alertPriority = new Chart(document.getElementById('alertPriorityChart'), {
        type: 'pie',
        data: {
            labels: data.alertPriority.map(d => d.priority),
            datasets: [{
                data: data.alertPriority.map(d => d.count),
                backgroundColor: ['#dc2626', '#ea580c', '#f59e0b', '#10b981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Chart 3: Gem Rate Distribution (Bar)
    charts.gemRate = new Chart(document.getElementById('gemRateChart'), {
        type: 'bar',
        data: {
            labels: data.gemRateDistribution.map(d => d.gem_rate_range),
            datasets: [{
                label: 'Number of Cards',
                data: data.gemRateDistribution.map(d => d.count),
                backgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Chart 4: Premium Distribution (Bar)
    charts.premium = new Chart(document.getElementById('premiumChart'), {
        type: 'bar',
        data: {
            labels: data.premiumDistribution.map(d => d.premium_range),
            datasets: [{
                label: 'Number of Cards',
                data: data.premiumDistribution.map(d => d.count),
                backgroundColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Chart 5: Top Players (Horizontal Bar)
    charts.topPlayers = new Chart(document.getElementById('topPlayersChart'), {
        type: 'bar',
        data: {
            labels: data.topPlayers.map(d => d.player_name),
            datasets: [{
                label: 'Cards Graded',
                data: data.topPlayers.map(d => d.total_cards_graded),
                backgroundColor: '#8b5cf6'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });

    // Chart 6: Market Efficiency (Doughnut)
    charts.efficiency = new Chart(document.getElementById('efficiencyChart'), {
        type: 'doughnut',
        data: {
            labels: data.efficiencyBreakdown.map(d => d.pricing_efficiency),
            datasets: [{
                data: data.efficiencyBreakdown.map(d => d.count),
                backgroundColor: ['#3b82f6', '#ef4444', '#10b981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Chart 7: Investment Score (Bar)
    charts.score = new Chart(document.getElementById('scoreChart'), {
        type: 'bar',
        data: {
            labels: data.scoreDistribution.map(d => d.score_range),
            datasets: [{
                label: 'Number of Opportunities',
                data: data.scoreDistribution.map(d => d.count),
                backgroundColor: '#fbbf24'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Chart 8: Grading Difficulty (Polar Area)
    charts.difficulty = new Chart(document.getElementById('difficultyChart'), {
        type: 'polarArea',
        data: {
            labels: data.difficultyDistribution.map(d => d.grading_difficulty),
            datasets: [{
                data: data.difficultyDistribution.map(d => d.count),
                backgroundColor: ['#dc2626', '#ea580c', '#f59e0b', '#3b82f6', '#10b981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Chart 9: Top Parallels (Horizontal Bar)
    charts.parallels = new Chart(document.getElementById('parallelsChart'), {
        type: 'bar',
        data: {
            labels: data.topParallels.map(d => d.parallel),
            datasets: [{
                label: 'Avg Gem Rate %',
                data: data.topParallels.map(d => d.avg_gem_rate),
                backgroundColor: '#06b6d4'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true, max: 100 }
            }
        }
    });

    // Chart 10: Price Distribution (Bar)
    charts.price = new Chart(document.getElementById('priceChart'), {
        type: 'bar',
        data: {
            labels: data.priceDistribution.map(d => d.price_range),
            datasets: [{
                label: 'Number of Cards',
                data: data.priceDistribution.map(d => d.count),
                backgroundColor: '#ec4899'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Chart 11: Expected Value Distribution (Bar)
    charts.ev = new Chart(document.getElementById('evChart'), {
        type: 'bar',
        data: {
            labels: data.evDistribution.map(d => d.ev_range),
            datasets: [{
                label: 'Number of Cards',
                data: data.evDistribution.map(d => d.count),
                backgroundColor: '#14b8a6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
