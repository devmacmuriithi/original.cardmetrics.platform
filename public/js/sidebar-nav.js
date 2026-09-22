// Centralized Sidebar Navigation
// This ensures consistent navigation across all pages

function renderSidebar(activePage = '') {
  const sidebarHTML = `
    <div class="p-6">
        <div class="flex items-center space-x-3 mb-8">
            <i class="fas fa-chart-line text-2xl text-blue-400"></i>
            <h1 class="text-xl font-bold">Card Analytics</h1>
        </div>
        
        <nav class="space-y-2">
            <a href="/" class="sidebar-link block px-4 py-3 rounded-lg ${activePage === 'dashboard' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                <i class="fas fa-tachometer-alt w-5"></i>
                <span>Dashboard</span>
            </a>
            <a href="/sale-feed" class="sidebar-link block px-4 py-3 rounded-lg ${activePage === 'sale-feed' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                <i class="fas fa-tags w-5 text-orange-400"></i>
                <span>Sale Feed</span>
            </a>
            
            <div class="pt-4">
                <h3 class="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider">Market Intelligence</h3>
                <div class="mt-2 space-y-1">
                    <a href="/opportunities" class="sidebar-link block px-4 py-2 rounded ${activePage === 'opportunities' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-bullseye w-5 text-yellow-400"></i>
                        <span>Investment Opportunities</span>
                    </a>
                    <a href="/grading" class="sidebar-link block px-4 py-2 rounded ${activePage === 'grading' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-certificate w-5 text-green-400"></i>
                        <span>Grading Intelligence</span>
                    </a>
                    <a href="/market-efficiency" class="sidebar-link block px-4 py-2 rounded ${activePage === 'market-efficiency' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-balance-scale w-5 text-purple-400"></i>
                        <span>Market Efficiency</span>
                    </a>
                    <a href="/player-profiles" class="sidebar-link block px-4 py-2 rounded ${activePage === 'player-profiles' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-user-chart w-5 text-blue-400"></i>
                        <span>Player Profiles</span>
                    </a>
                    <a href="/alerts" class="sidebar-link block px-4 py-2 rounded ${activePage === 'alerts' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-bell w-5 text-red-400"></i>
                        <span>Opportunity Alerts</span>
                    </a>
                    <a href="/intelligence-dashboard" class="sidebar-link block px-4 py-2 rounded ${activePage === 'intelligence-dashboard' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-chart-pie w-5 text-cyan-400"></i>
                        <span>Intelligence Dashboard</span>
                    </a>
                </div>
            </div>


            <div class="pt-4">
                <h3 class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sets</h3>
                <div class="mt-2 space-y-1">
                    <a href="/sets" class="sidebar-link block px-4 py-2 rounded ${activePage === 'sets' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-layer-group w-5"></i>
                        <span>Sets Analytics</span>
                    </a>
                </div>
            </div>
            
            <div class="pt-4">
                <h3 class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cards</h3>
                <div class="mt-2 space-y-1">
                    <a href="/cards" class="sidebar-link block px-4 py-2 rounded ${activePage === 'cards' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-th-large w-5"></i>
                        <span>Cards Analytics</span>
                    </a>
                    <a href="/cards/top-movers" class="sidebar-link block px-4 py-2 rounded ${activePage === 'cards-top-movers' ? 'bg-gray-800' : 'hover:bg-gray-800'} flex items-center space-x-3">
                        <i class="fas fa-fire w-5 text-red-400"></i>
                        <span>Top Movers</span>
                    </a>
                </div>
            </div>


            <div class="pt-6 mt-4 border-t border-gray-800">
                <a href="/logout" class="sidebar-link block px-4 py-2.5 rounded-lg hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 flex items-center space-x-3 transition">
                    <i class="fas fa-sign-out-alt w-5"></i>
                    <span>Sign Out</span>
                </a>
            </div>
        </nav>
    </div>
  `;

  const sidebarElement = document.querySelector('aside');
  if (sidebarElement) {
    sidebarElement.innerHTML = sidebarHTML;
  }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const activePage = document.body.getAttribute('data-page') || '';
  console.log('Sidebar initializing for page:', activePage);
  renderSidebar(activePage);
  console.log('Sidebar rendered');
});

// Export for manual use if needed
window.renderSidebar = renderSidebar;
