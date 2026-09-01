function getIndexFilters() {
  return {
    startDate: document.getElementById('indexStartDate')?.value || '',
    endDate: document.getElementById('indexEndDate')?.value || '',
    platform: document.getElementById('indexPlatform')?.value || '',
    listingType: document.getElementById('indexListingType')?.value || '',
    condition: document.getElementById('indexCondition')?.value || '',
    minPrice: document.getElementById('indexMinPrice')?.value || '',
    maxPrice: document.getElementById('indexMaxPrice')?.value || '',
    minRating: document.getElementById('indexMinRating')?.value || '',
    setName: document.getElementById('indexSetName')?.value || '',
    playerName: document.getElementById('indexPlayerName')?.value || '',
    sport: document.getElementById('indexSport')?.value || '',
    yearFrom: document.getElementById('indexYearFrom')?.value || '',
    yearTo: document.getElementById('indexYearTo')?.value || ''
  };
}

function buildIndexQueryString() {
  const filters = getIndexFilters();
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value != null) {
      params.append(key, value);
    }
  });
  return params.toString();
}

function resetIndexFilters() {
  const ids = [
    'indexStartDate',
    'indexEndDate',
    'indexPlatform',
    'indexListingType',
    'indexCondition',
    'indexMinPrice',
    'indexMaxPrice',
    'indexMinRating',
    'indexSetName',
    'indexPlayerName',
    'indexSport',
    'indexYearFrom',
    'indexYearTo'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
    }
  });
}

function attachIndexFilterHandlers(onApply) {
  const applyButton = document.getElementById('applyIndexFilters');
  const resetButton = document.getElementById('resetIndexFilters');

  if (applyButton) {
    applyButton.addEventListener('click', () => onApply());
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      resetIndexFilters();
      onApply();
    });
  }

  const inputs = document.querySelectorAll('#indexFilters input, #indexFilters select');
  inputs.forEach(input => {
    input.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        onApply();
      }
    });
  });
}

window.indexFilters = {
  getIndexFilters,
  buildIndexQueryString,
  resetIndexFilters,
  attachIndexFilterHandlers
};
