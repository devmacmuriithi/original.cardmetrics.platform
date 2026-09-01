async function loadSetIndex() {
  await window.indexDashboard.loadIndexDashboard('/api/indices/set');
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.indexFilters?.attachIndexFilterHandlers) {
    window.indexFilters.attachIndexFilterHandlers(loadSetIndex);
  }
  loadSetIndex();
});
