function resolveContainer(containerOrId) {
  if (!containerOrId) return null;
  if (typeof containerOrId === 'string') return document.getElementById(containerOrId);
  return containerOrId;
}

function renderLoadingState(containerOrId, message = 'Loading analytics...') {
  const container = resolveContainer(containerOrId);
  if (!container) return;

  container.innerHTML = `
    <div class="p-8 text-center text-gray-500">
      <i class="fas fa-circle-notch fa-spin text-3xl mb-4"></i>
      <p class="text-sm">${message}</p>
    </div>
  `;
}

function renderEmptyState(containerOrId, message = 'No data found for the current filters.') {
  const container = resolveContainer(containerOrId);
  if (!container) return;

  container.innerHTML = `
    <div class="p-8 text-center text-gray-500">
      <i class="fas fa-search text-3xl mb-4"></i>
      <p>${message}</p>
    </div>
  `;
}

function renderErrorState(containerOrId, message = 'Unable to load data.', retryFunctionName = '') {
  const container = resolveContainer(containerOrId);
  if (!container) return;

  const retryButton = retryFunctionName
    ? `<button onclick="${retryFunctionName}()" class="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">\n         <i class="fas fa-redo mr-2"></i>Retry\n       </button>`
    : '';

  container.innerHTML = `
    <div class="p-8 text-center text-red-600">
      <i class="fas fa-exclamation-triangle text-3xl mb-4"></i>
      <p>${message}</p>
      ${retryButton}
    </div>
  `;
}

window.uiStates = {
  renderLoadingState,
  renderEmptyState,
  renderErrorState
};
