// Set Detail Page with 5-Domain Intelligence Dashboard
let setData = null;
let historyData = null;

document.addEventListener('DOMContentLoaded', () => {
  const setId = getSetIdFromUrl();
  if (setId) {
    loadSetDetail(setId);
  } else {
    showError('Invalid set ID');
  }
});

function getSetIdFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/set-detail\/(\d+)/);
  return match ? match[1] : null;
}

async function loadSetDetail(setId) {
  try {
    const response = await fetch(`/api/sets/${setId}`);
    if (!response.ok) throw new Error('Failed to load set');
    
    const data = await response.json();
    setData = data.set;
    historyData = data.history || [];
    
    renderSetDetail();
    hideLoading();
  } catch (error) {
    console.error('Error loading set:', error);
    showError('Failed to load set details. Please try again.');
    hideLoading();
  }
}

function renderSetDetail() {
  if (!setData) return;
  
  // Header
  document.getElementById('setName').textContent = setData.set_name || 'Unknown Set';
  document.getElementById('setYear').textContent = setData.year || '';
  
  // Key Metrics Summary
  renderKeyMetrics();
  
  // 1. Price Intelligence
  renderPriceIntelligence();
  
  // 2. Liquidity Intelligence
  renderLiquidityIntelligence();
  
  // 3. Grade Intelligence
  renderGradeIntelligence();
  
  // 4. Opportunity Score
  renderOpportunityScore();
  
  // 5. Risk Metrics
  renderRiskMetrics();
  
  // Charts
  renderCharts();
}

function renderKeyMetrics() {
  const container = document.getElementById('keyMetrics');
  if (!container) return;
  
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow p-6" title="Average transaction price across cards in this set.">
      <p class="text-sm text-gray-600">Avg Price</p>
      <p class="text-2xl font-bold text-gray-900">$${formatNumber(setData.avg_price)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6" title="Total number of tracked cards that belong to this set.">
      <p class="text-sm text-gray-600">Total Cards</p>
      <p class="text-2xl font-bold text-purple-700">${formatNumber(setData.total_cards, 0)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6" title="Percentage price change across the set over the past 30 days.">
      <p class="text-sm text-gray-600">30d Change</p>
      <p class="text-2xl font-bold ${getChangeColor(setData.price_change_30d)}">
        ${formatPercent(setData.price_change_30d)}%
      </p>
    </div>
    <div class="bg-white rounded-lg shadow p-6" title="Directional state inferred from set-level trend data (Rising, Stable, or Declining).">
      <p class="text-sm text-gray-600">Trend State</p>
      <p class="text-lg font-bold">${setData.trend_state || 'N/A'}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6" title="Composite opportunity score (0-100) for this set based on valuation, momentum, liquidity, and volatility.">
      <p class="text-sm text-gray-600">Opportunity</p>
      <p class="text-2xl font-bold text-green-600">${Math.round(setData.opportunity_score || 0)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-6" title="Observed sales activity across cards in this set.">
      <p class="text-sm text-gray-600">Sales Volume</p>
      <p class="text-2xl font-bold text-blue-600">${formatNumber(setData.sales_volume, 0)}</p>
    </div>
  `;
}

function renderPriceIntelligence() {
  document.getElementById('trend7d').textContent = formatPercent(setData.trend_slope_7d) + '%';
  document.getElementById('trend7d').className = `text-2xl font-bold ${getChangeColor(setData.trend_slope_7d)}`;
  
  document.getElementById('trend30d').textContent = formatPercent(setData.trend_slope_30d) + '%';
  document.getElementById('trend30d').className = `text-2xl font-bold ${getChangeColor(setData.trend_slope_30d)}`;
  
  document.getElementById('trend90d').textContent = formatPercent(setData.trend_slope_90d) + '%';
  document.getElementById('trend90d').className = `text-2xl font-bold ${getChangeColor(setData.trend_slope_90d)}`;
  
  const regime = setData.volatility_regime || 'Unknown';
  document.getElementById('volatilityRegime').textContent = regime;
  document.getElementById('volatilityRegime').className = `text-lg font-bold ${getVolatilityColor(regime)}`;
  
  document.getElementById('fairValueDev').textContent = formatPercent(setData.fair_value_deviation_pct) + '%';
  document.getElementById('fairValueDev').className = `text-2xl font-bold ${getChangeColor(-1 * setData.fair_value_deviation_pct)}`;
  
  const range = `$${formatNumber(setData.low_30d)} - $${formatNumber(setData.high_30d)}`;
  document.getElementById('priceRange30d').textContent = range;
}

function renderLiquidityIntelligence() {
  const days = Number(setData.days_to_liquidity) || 0;
  document.getElementById('daysToLiquidity').textContent = days > 100 ? '100+' : formatNumber(days, 1);
  document.getElementById('daysToLiquidity').className = `text-2xl font-bold ${days < 30 ? 'text-green-600' : days < 60 ? 'text-yellow-600' : 'text-red-600'}`;
  
  document.getElementById('weeklySales').textContent = formatNumber(setData.weekly_sales_velocity, 1);
  
  const liquidityPct = Math.round((setData.liquidity_score || 0) * 100);
  document.getElementById('liquidityScore').textContent = liquidityPct + '%';
  document.getElementById('liquidityScore').className = `text-2xl font-bold ${liquidityPct >= 70 ? 'text-green-600' : liquidityPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`;
  
  document.getElementById('spreadProxy').textContent = formatPercent(setData.spread_proxy_pct) + '%';
}

function renderGradeIntelligence() {
  document.getElementById('psa10Premium').textContent = formatPercent(setData.psa10_premium_pct) + '%';
  document.getElementById('psa10Premium').className = `text-2xl font-bold ${setData.psa10_premium_pct > 100 ? 'text-green-600' : 'text-gray-900'}`;
  
  const ev = Number(setData.grading_expected_value) || 0;
  document.getElementById('gradingEV').textContent = '$' + formatNumber(ev);
  document.getElementById('gradingEV').className = `text-2xl font-bold ${ev > 0 ? 'text-green-600' : 'text-red-600'}`;
  
  document.getElementById('rawPrice').textContent = '$' + formatNumber(setData.avg_price);
  document.getElementById('psa10Price').textContent = '$' + formatNumber(setData.psa10_avg_price);
}

function renderOpportunityScore() {
  const score = Math.round(setData.opportunity_score || 0);
  
  // Update gauge
  document.getElementById('opportunityScoreValue').textContent = score;
  const circle = document.getElementById('opportunityCircle');
  const circumference = 502.4;
  const offset = circumference - (score / 100) * circumference;
  circle.style.strokeDashoffset = offset;
  
  // Color based on score
  let color = '#10b981'; // green
  if (score < 30) color = '#ef4444'; // red
  else if (score < 50) color = '#f59e0b'; // yellow
  else if (score < 70) color = '#3b82f6'; // blue
  circle.style.stroke = color;
  
  // Label
  let label = 'Excellent Opportunity';
  if (score < 30) label = 'Low Opportunity';
  else if (score < 50) label = 'Moderate Opportunity';
  else if (score < 70) label = 'Good Opportunity';
  document.getElementById('opportunityLabel').textContent = label;
  
  // Breakdown (approximate based on formula)
  const underval = Math.min(30, Math.max(0, -1 * (setData.fair_value_deviation_pct || 0)));
  const momentum = Math.min(25, Math.max(0, (setData.momentum || 0) * 100));
  const liquidity = (setData.liquidity_score || 0) * 25;
  const volatility = Math.min(20, Math.max(0, 20 - ((setData.price_stddev_30d || 0) / (setData.avg_price_30d || 1) * 100)));
  
  updateScoreBar('undervalScore', 'undervalBar', underval, 30);
  updateScoreBar('momentumScore', 'momentumBar', momentum, 25);
  updateScoreBar('liquidityScoreBreakdown', 'liquidityBar', liquidity, 25);
  updateScoreBar('volatilityScore', 'volatilityBar', volatility, 20);
}

function updateScoreBar(scoreId, barId, value, max) {
  document.getElementById(scoreId).textContent = Math.round(value);
  document.getElementById(barId).style.width = ((value / max) * 100) + '%';
}

function renderRiskMetrics() {
  document.getElementById('drawdownRisk').textContent = formatPercent(setData.drawdown_risk_pct) + '%';
  document.getElementById('drawdownRisk').className = `text-2xl font-bold ${setData.drawdown_risk_pct > 20 ? 'text-red-600' : setData.drawdown_risk_pct > 10 ? 'text-yellow-600' : 'text-green-600'}`;
  
  const trendRisk = setData.trend_break_risk || 'Unknown';
  document.getElementById('trendBreakRisk').textContent = trendRisk;
  document.getElementById('trendBreakRisk').className = `text-lg font-bold ${trendRisk === 'High' ? 'text-red-600' : trendRisk === 'Medium' ? 'text-yellow-600' : 'text-green-600'}`;
  
  const confidence = setData.data_confidence_score || 0;
  document.getElementById('dataConfidence').textContent = confidence;
  document.getElementById('dataConfidence').className = `text-2xl font-bold ${confidence >= 80 ? 'text-green-600' : confidence >= 60 ? 'text-yellow-600' : 'text-red-600'}`;
  
  const eligible = setData.execution_eligible ? 'Yes' : 'No';
  document.getElementById('executionEligible').textContent = eligible;
  document.getElementById('executionEligible').className = `text-lg font-bold ${setData.execution_eligible ? 'text-green-600' : 'text-red-600'}`;
}

function renderCharts() {
  if (!historyData || historyData.length === 0) return;
  
  const labels = historyData.map(h => new Date(h.date).toLocaleDateString());
  
  // Price History Chart
  new Chart(document.getElementById('priceHistoryChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg Price',
          data: historyData.map(h => Number(h.avg_price) || null),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3
        },
        {
          label: '30d Average',
          data: historyData.map(h => Number(h.avg_price_30d) || null),
          borderColor: '#10b981',
          borderDash: [5, 5],
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: { beginAtZero: false, title: { display: true, text: 'Price ($)' } }
      }
    }
  });
  
  // Premium History Chart
  new Chart(document.getElementById('premiumHistoryChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'PSA 10 Premium %',
        data: historyData.map(h => {
          const avg = Number(h.avg_price) || 0;
          const psa10 = Number(h.psa10_avg_price) || 0;
          return avg > 0 && psa10 > 0 ? ((psa10 - avg) / avg * 100) : null;
        }),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Premium (%)' } }
      }
    }
  });
  
  // Momentum Chart
  const momentumCanvas = document.getElementById('momentumChart');
  momentumCanvas.height = 320;
  new Chart(momentumCanvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Momentum',
        data: labels.map((label, idx) => ({
          x: label,
          y: (Number(historyData[idx]?.momentum) || 0) * 100
        })),
        showLine: true,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.25
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: true,
      animation: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        x: {
          type: 'category'
        },
        y: {
          suggestedMin: -50,
          suggestedMax: 50,
          title: { display: true, text: 'Momentum (%)' }
        }
      }
    }
  });
  
  // Liquidity Chart
  const liquidityCanvas = document.getElementById('liquidityChart');
  liquidityCanvas.height = 320;
  new Chart(liquidityCanvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Liquidity Score',
        data: labels.map((label, idx) => ({
          x: label,
          y: (Number(historyData[idx]?.liquidity_score) || 0) * 100
        })),
        showLine: true,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.25
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: true,
      animation: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        x: {
          type: 'category'
        },
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          title: { display: true, text: 'Score (%)' }
        }
      }
    }
  });
}

function getChangeColor(value) {
  const num = Number(value) || 0;
  if (num > 0) return 'text-green-600';
  if (num < 0) return 'text-red-600';
  return 'text-gray-600';
}

function getVolatilityColor(regime) {
  if (regime.includes('Low')) return 'text-green-600';
  if (regime.includes('Medium')) return 'text-yellow-600';
  if (regime.includes('High')) return 'text-red-600';
  return 'text-gray-600';
}

function formatNumber(value, decimals = 2) {
  const num = Number(value);
  if (isNaN(num)) return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPercent(value, decimals = 1) {
  const num = Number(value);
  if (isNaN(num)) return 'N/A';
  const sign = num > 0 ? '+' : '';
  return sign + num.toFixed(decimals);
}

function showError(message) {
  document.getElementById('setName').textContent = 'Error';
  document.getElementById('setYear').textContent = message;
}

function hideLoading() {
  document.getElementById('loading')?.style.setProperty('display', 'none');
}
