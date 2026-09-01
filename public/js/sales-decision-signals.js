const formatDecisionValue = (value, suffix = '%') => {
  if (value == null || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  return `${Number(value).toFixed(1)}${suffix}`;
};

const decisionValueClass = (value) => {
  if (value == null || Number.isNaN(Number(value))) {
    return 'text-gray-500';
  }
  if (value > 5) return 'text-emerald-600';
  if (value < -5) return 'text-red-600';
  return 'text-gray-700';
};

const riskBadgeClass = (flag) => {
  if (flag === 'Overheated') return 'bg-red-100 text-red-700';
  if (flag === 'Cooling') return 'bg-blue-100 text-blue-700';
  return 'bg-emerald-100 text-emerald-700';
};

function renderDecisionSignals(signals) {
  if (!signals) return;
  const container = document.getElementById('decisionSignals');
  if (!container) return;

  container.innerHTML = `
    <div class="bg-white rounded-lg shadow p-4">
      <p class="text-xs uppercase tracking-wide text-gray-500">Momentum 7D</p>
      <p class="text-2xl font-bold ${decisionValueClass(signals.momentum7d)}">${formatDecisionValue(signals.momentum7d)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <p class="text-xs uppercase tracking-wide text-gray-500">Momentum 30D</p>
      <p class="text-2xl font-bold ${decisionValueClass(signals.momentum30d)}">${formatDecisionValue(signals.momentum30d)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <p class="text-xs uppercase tracking-wide text-gray-500">Momentum 90D</p>
      <p class="text-2xl font-bold ${decisionValueClass(signals.momentum90d)}">${formatDecisionValue(signals.momentum90d)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <p class="text-xs uppercase tracking-wide text-gray-500">Liquidity Score</p>
      <p class="text-2xl font-bold text-indigo-600">${Number(signals.liquidityScore || 0).toFixed(1)}</p>
      <p class="text-xs text-gray-400 mt-1">Volume shift 30D: ${formatDecisionValue(signals.volumeShift30d)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <p class="text-xs uppercase tracking-wide text-gray-500">Grade Premium Shift</p>
      <p class="text-2xl font-bold ${decisionValueClass(signals.gradePremiumShift)}">${formatDecisionValue(signals.gradePremiumShift)}</p>
      <p class="text-xs text-gray-400 mt-1">PSA10/Raw: ${Number(signals.gradePremium30 || 0).toFixed(2)}x</p>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <p class="text-xs uppercase tracking-wide text-gray-500">Auction Premium Shift</p>
      <p class="text-2xl font-bold ${decisionValueClass(signals.auctionPremiumShift)}">${formatDecisionValue(signals.auctionPremiumShift)}</p>
      <p class="text-xs text-gray-400 mt-1">Auction vs BIN: ${formatDecisionValue(signals.auctionPremium30)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <p class="text-xs uppercase tracking-wide text-gray-500">Market Heat</p>
      <p class="text-2xl font-bold text-orange-600">${Number(signals.marketHeatScore || 0).toFixed(1)}</p>
      <p class="text-xs text-gray-400 mt-1">Supply pressure: ${formatDecisionValue(signals.supplyPressure)}</p>
    </div>
    <div class="bg-white rounded-lg shadow p-4 flex flex-col justify-between">
      <p class="text-xs uppercase tracking-wide text-gray-500">Risk Flag</p>
      <span class="mt-3 inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold ${riskBadgeClass(signals.riskFlag)}">${signals.riskFlag || 'Stable'}</span>
    </div>
  `;
}

window.renderDecisionSignals = renderDecisionSignals;
