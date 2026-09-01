// Autocomplete Component
// Reusable autocomplete functionality for search inputs

class Autocomplete {
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.apiEndpoint = options.apiEndpoint;
        this.onSelect = options.onSelect || (() => {});
        this.minChars = options.minChars || 2;
        this.debounceMs = options.debounceMs || 300;
        this.maxResults = options.maxResults || 10;
        
        this.debounceTimer = null;
        this.resultsContainer = null;
        this.currentFocus = -1;
        
        this.init();
    }
    
    init() {
        // Create results container
        this.resultsContainer = document.createElement('div');
        this.resultsContainer.className = 'autocomplete-results absolute z-50 w-full bg-white border border-gray-300 rounded-b-lg shadow-lg max-h-60 overflow-y-auto hidden';
        this.resultsContainer.style.top = this.input.offsetHeight + 'px';
        
        // Position container
        const wrapper = document.createElement('div');
        wrapper.className = 'relative';
        this.input.parentNode.insertBefore(wrapper, this.input);
        wrapper.appendChild(this.input);
        wrapper.appendChild(this.resultsContainer);
        
        // Event listeners
        this.input.addEventListener('input', (e) => this.handleInput(e));
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.input.addEventListener('focus', (e) => {
            if (this.input.value.length >= this.minChars) {
                this.handleInput(e);
            }
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                this.hideResults();
            }
        });
    }
    
    handleInput(e) {
        const value = e.target.value.trim();
        
        clearTimeout(this.debounceTimer);
        
        if (value.length < this.minChars) {
            this.hideResults();
            return;
        }
        
        this.debounceTimer = setTimeout(() => {
            this.fetchSuggestions(value);
        }, this.debounceMs);
    }
    
    async fetchSuggestions(query) {
        try {
            const response = await fetch(`${this.apiEndpoint}?q=${encodeURIComponent(query)}&limit=${this.maxResults}`);
            if (!response.ok) throw new Error('Failed to fetch suggestions');
            
            const suggestions = await response.json();
            this.displayResults(suggestions);
        } catch (error) {
            console.error('Autocomplete error:', error);
            this.hideResults();
        }
    }
    
    displayResults(suggestions) {
        this.resultsContainer.innerHTML = '';
        this.currentFocus = -1;
        
        if (!suggestions || suggestions.length === 0) {
            this.hideResults();
            return;
        }
        
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item px-4 py-2 cursor-pointer hover:bg-blue-50 text-sm text-gray-900';
            item.textContent = suggestion;
            item.dataset.index = index;
            
            item.addEventListener('click', () => {
                this.selectItem(suggestion);
            });
            
            this.resultsContainer.appendChild(item);
        });
        
        this.showResults();
    }
    
    handleKeydown(e) {
        const items = this.resultsContainer.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.currentFocus++;
            this.setActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.currentFocus--;
            this.setActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.currentFocus > -1 && items[this.currentFocus]) {
                items[this.currentFocus].click();
            }
        } else if (e.key === 'Escape') {
            this.hideResults();
        }
    }
    
    setActive(items) {
        if (!items || items.length === 0) return;
        
        // Remove active class from all
        items.forEach(item => item.classList.remove('bg-blue-100'));
        
        // Wrap around
        if (this.currentFocus >= items.length) this.currentFocus = 0;
        if (this.currentFocus < 0) this.currentFocus = items.length - 1;
        
        // Add active class
        items[this.currentFocus].classList.add('bg-blue-100');
        items[this.currentFocus].scrollIntoView({ block: 'nearest' });
    }
    
    selectItem(value) {
        this.input.value = value;
        this.hideResults();
        this.onSelect(value);
    }
    
    showResults() {
        this.resultsContainer.classList.remove('hidden');
    }
    
    hideResults() {
        this.resultsContainer.classList.add('hidden');
        this.currentFocus = -1;
    }
    
    destroy() {
        if (this.resultsContainer) {
            this.resultsContainer.remove();
        }
        clearTimeout(this.debounceTimer);
    }
}

// Helper function to initialize autocomplete
function initAutocomplete(inputId, apiEndpoint, onSelectCallback) {
    const input = document.getElementById(inputId);
    if (!input) {
        console.warn(`Input element ${inputId} not found`);
        return null;
    }
    
    return new Autocomplete(input, {
        apiEndpoint: apiEndpoint,
        onSelect: onSelectCallback,
        minChars: 2,
        debounceMs: 300,
        maxResults: 10
    });
}
