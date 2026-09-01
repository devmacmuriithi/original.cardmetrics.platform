async function loadMarketIndex() {
  await window.indexDashboard.loadIndexDashboard('/api/indices/market');
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.indexFilters?.attachIndexFilterHandlers) {
    window.indexFilters.attachIndexFilterHandlers(loadMarketIndex);
  }
  loadMarketIndex();
});
