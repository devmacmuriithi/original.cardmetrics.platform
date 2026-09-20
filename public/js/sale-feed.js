let currentData = [];
let totalRecords = 0;
let currentPage = 1;
const recordsPerPage = 100;
let sortColumn = 'imported_at';
let sortDirection = 'desc';

document.addEventListener('DOMContentLoaded', () => {
    loadData(1);

    const searchInput = document.getElementById('searchText');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyFilters();
        });
    }
});

async function loadData(page = 1) {
    try {
        const search = document.getElementById('searchText').value.trim();
        const platform = document.getElementById('platform').value.trim();
        const listingType = document.getElementById('listingType').value.trim();

        const offset = (page - 1) * recordsPerPage;
        const params = new URLSearchParams({
            limit: recordsPerPage,
            offset
        });

        if (search) params.append('search', search);
        if (platform) params.append('platform', platform);
        if (listingType) params.append('listingType', listingType);

        const response = await fetch(`/api/sale-feed?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        currentData = result.data || [];
        totalRecords = result.total || 0;
        currentPage = page;

        renderTable();
        renderPagination();
    } catch (error) {
        console.error('Error loading sale feed:', error);
        document.getElementById('dataContainer').innerHTML = `
            <div class="p-6 text-center text-red-600">
                <i class="fas fa-exclamation-triangle text-3xl mb-4"></i>
                <p>Error loading sale feed. Please try again.</p>
            </div>`;
    }
}

function applyFilters() {
    currentPage = 1;
    loadData(1);
}

function resetFilters() {
    document.getElementById('searchText').value = '';
    document.getElementById('platform').value = '';
    document.getElementById('listingType').value = '';
    currentPage = 1;
    loadData(1);
}

function renderTable() {
    const start = totalRecords === 0 ? 0 : (currentPage - 1) * recordsPerPage + 1;
    const end = Math.min(currentPage * recordsPerPage, totalRecords);
    document.getElementById('resultCount').textContent = `${start}-${end} of ${totalRecords}`;

    if (currentData.length === 0) {
        document.getElementById('dataContainer').innerHTML = `
            <div class="p-6 text-center text-gray-500">
                <i class="fas fa-search text-3xl mb-4"></i>
                <p>No sale feed records found.</p>
            </div>`;
        return;
    }

    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('listing_title')" title="Card listing title as captured from the sales platform (e.g., eBay, COMC, PWCC).">
                            Listing <i class="fas ${getSortIcon('listing_title')} ml-1"></i>
                        </th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('platform')" title="Sales platform where transaction occurred. Examples: eBay, COMC, PWCC, MySlabs, Goldin.">
                            Platform <i class="fas ${getSortIcon('platform')} ml-1"></i>
                        </th>
                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('sale_price')" title="Final sale price (hammer price) recorded from the transaction. Excludes shipping and fees unless noted.">
                            Sale Price <i class="fas ${getSortIcon('sale_price')} ml-1"></i>
                        </th>
                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('shipping_cost')" title="Shipping cost charged by seller. Step 1: Captured from listing or transaction data. Step 2: Added to total cost calculations. Note: May not include tax or platform fees yet.">
                            Shipping <i class="fas ${getSortIcon('shipping_cost')} ml-1"></i>
                        </th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('listing_type')" title="Listing type: Auction (bid-based) or BIN (Buy It Now, fixed price).">
                            Type <i class="fas ${getSortIcon('listing_type')} ml-1"></i>
                        </th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('condition')" title="Card condition as reported in the sale. Examples: Ungraded, PSA 10, PSA 9, BGS 9.5, SGC 10.">
                            Condition <i class="fas ${getSortIcon('condition')} ml-1"></i>
                        </th>
                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('seller_rating')" title="Seller feedback rating when available. Pulled from platform seller data (e.g., eBay feedback %).">
                            Seller Rating <i class="fas ${getSortIcon('seller_rating')} ml-1"></i>
                        </th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onclick="sortBy('imported_at')" title="Date and time when this sale record was imported into the system. Shows data freshness.">
                            Imported <i class="fas ${getSortIcon('imported_at')} ml-1"></i>
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">`;

    currentData.forEach(item => {
        const imageThumb = item.image_url ? `<img src="${item.image_url}" alt="Card" class="w-10 h-14 object-cover rounded shadow-sm flex-shrink-0 mr-3 border border-gray-200">` : `<div class="w-10 h-14 bg-gray-100 rounded flex-shrink-0 mr-3 border border-gray-200 flex items-center justify-center text-gray-400 text-xs"><i class="fas fa-image"></i></div>`;
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">
                    <div class="flex items-center">
                        ${imageThumb}
                        <div>
                            <div class="text-sm font-medium text-gray-900 leading-snug">${item.listing_title || 'N/A'}</div>
                            <div class="text-xs text-gray-500 mt-0.5">ID: ${item.platform_listing_id || '-'}</div>
                            ${item.platform_url ? `<a href="${item.platform_url}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-600 hover:text-blue-800 font-medium inline-block mt-0.5"><i class="fas fa-external-link-alt mr-1"></i>View Listing</a>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700 capitalize">${item.platform || 'N/A'}</td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-gray-900">${item.sale_price != null ? `$${Number(item.sale_price).toFixed(2)}` : 'N/A'}</td>
                <td class="px-4 py-3 text-right text-sm text-gray-700">${item.shipping_cost != null ? `$${Number(item.shipping_cost).toFixed(2)}` : '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.listing_type === 'Auction' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}">
                        ${item.listing_type || 'BIN'}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        ${item.condition || 'Ungraded'}
                    </span>
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-700">${item.seller_rating != null ? item.seller_rating : '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${item.sale_date ? new Date(item.sale_date).toLocaleDateString() : (item.imported_at ? new Date(item.imported_at).toLocaleDateString() : '-')}</td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    document.getElementById('dataContainer').innerHTML = html;
}

function renderPagination() {
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    if (totalPages <= 1) return;

    let paginationHTML = '<div class="flex justify-center items-center space-x-2 mt-6 pb-6">';

    paginationHTML += `
        <button onclick="loadData(${currentPage - 1})"
                ${currentPage === 1 ? 'disabled' : ''}
                class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
            <i class="fas fa-chevron-left"></i> Previous
        </button>`;

    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="loadData(${i})"
                    class="px-4 py-2 rounded ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}">
                ${i}
            </button>`;
    }

    paginationHTML += `
        <button onclick="loadData(${currentPage + 1})"
                ${currentPage === totalPages ? 'disabled' : ''}
                class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
            Next <i class="fas fa-chevron-right"></i>
        </button>`;

    paginationHTML += '</div>';

    const container = document.getElementById('dataContainer');
    container.innerHTML += paginationHTML;
}

function getSortIcon(column) {
    if (sortColumn !== column) return 'fa-sort text-gray-400';
    return sortDirection === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600';
}

function sortBy(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = column === 'listing_title' || column === 'platform' || column === 'listing_type' || column === 'condition' ? 'asc' : 'desc';
    }

    currentData.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
        if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;

        if (typeof aVal === 'string' && !isNaN(aVal)) aVal = parseFloat(aVal);
        if (typeof bVal === 'string' && !isNaN(bVal)) bVal = parseFloat(bVal);

        if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    renderTable();
}
