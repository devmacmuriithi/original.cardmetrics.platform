async function loadGradeIndex() {
  await window.indexDashboard.loadIndexDashboard('/api/indices/grade');
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.indexFilters?.attachIndexFilterHandlers) {
    window.indexFilters.attachIndexFilterHandlers(loadGradeIndex);
  }
  loadGradeIndex();
});
