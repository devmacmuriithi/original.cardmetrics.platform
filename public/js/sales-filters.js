function getSalesFilters() {
  return {
    startDate: document.getElementById('filterStartDate')?.value || '',
    endDate: document.getElementById('filterEndDate')?.value || '',
    platform: document.getElementById('filterPlatform')?.value || '',
    listingType: document.getElementById('filterListingType')?.value || '',
    condition: document.getElementById('filterCondition')?.value || '',
    minPrice: document.getElementById('filterMinPrice')?.value || '',
    maxPrice: document.getElementById('filterMaxPrice')?.value || '',
    minRating: document.getElementById('filterMinRating')?.value || ''
  };
}

function buildSalesQueryString() {
  const filters = getSalesFilters();
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value != null) {
      params.append(key, value);
    }
  });
  return params.toString();
}

function resetSalesFilters() {
  const ids = [
    'filterStartDate',
    'filterEndDate',
    'filterPlatform',
    'filterListingType',
    'filterCondition',
    'filterMinPrice',
    'filterMaxPrice',
    'filterMinRating'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
    }
  });
}

function attachSalesFilterHandlers(onApply) {
  const applyButton = document.getElementById('applySalesFilters');
  const resetButton = document.getElementById('resetSalesFilters');

  if (applyButton) {
    applyButton.addEventListener('click', () => onApply());
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      resetSalesFilters();
      onApply();
    });
  }

  const inputs = document.querySelectorAll('#salesFilters input, #salesFilters select');
  inputs.forEach(input => {
    input.addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        onApply();
      }
    });
  });
}

window.salesFilters = {
  getSalesFilters,
  buildSalesQueryString,
  resetSalesFilters,
  attachSalesFilterHandlers
};
