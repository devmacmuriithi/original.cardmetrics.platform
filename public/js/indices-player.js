async function loadPlayerIndex() {
  await window.indexDashboard.loadIndexDashboard('/api/indices/player');
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.indexFilters?.attachIndexFilterHandlers) {
    window.indexFilters.attachIndexFilterHandlers(loadPlayerIndex);
  }
  loadPlayerIndex();
});
