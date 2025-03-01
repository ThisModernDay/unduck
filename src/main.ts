import { bangs } from "./bang";
import "./global.css";
import config from "./config";
import { theme } from "./themes";

// Icon imports from Lucide
import clipboardIcon from "lucide-static/icons/clipboard.svg";
import clipboardCheckIcon from "lucide-static/icons/clipboard-check.svg";
import trashIcon from "lucide-static/icons/trash-2.svg";
import clockIcon from "lucide-static/icons/clock.svg";
import chevronDownIcon from "lucide-static/icons/chevron-down.svg";
import chevronUpIcon from "lucide-static/icons/chevron-up.svg";
import filterIcon from "lucide-static/icons/filter.svg";
import plusIcon from "lucide-static/icons/plus.svg";
import xIcon from "lucide-static/icons/x.svg";

// Constants
const CUSTOM_BANGS_KEY = "custom-bangs";
const DB_NAME = "search-history-db";
const DB_VERSION = 1;
const STORE_NAME = "searches";

// Type definitions
interface CustomBang {
  t: string;  // trigger
  u: string;  // url template
}

interface SearchRecord {
  id?: number;
  query: string;
  timestamp: number;
  bangUsed?: string;
}

// Database class for managing search history
class SearchHistoryDB {
  private db: IDBDatabase | null = null;
  private isOpen = false;

  constructor() {
    this.open();
  }

  open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db && this.isOpen) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("Error opening database:", event);
        reject(new Error("Could not open database"));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.isOpen = true;
        console.log("Database opened successfully");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
          store.createIndex("timestamp", "timestamp", { unique: false });
          console.log("Object store created");
        }
      };
    });
  }

  async addSearch(query: string, bangUsed?: string): Promise<void> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const record: SearchRecord = {
          query,
          timestamp: Date.now(),
          bangUsed
        };

        const request = store.add(record);

        request.onsuccess = () => {
          console.log("Search added to history");
          resolve();
        };

        request.onerror = (event) => {
          console.error("Error adding search:", event);
          reject(new Error("Failed to add search to history"));
        };
      });
    } catch (error) {
      console.error("Error in addSearch:", error);
    }
  }

  async getSearches(limit = 20): Promise<SearchRecord[]> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index("timestamp");

        const request = index.openCursor(null, "prev");
        const searches: SearchRecord[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor && searches.length < limit) {
            searches.push(cursor.value);
            cursor.continue();
          } else {
            resolve(searches);
          }
        };

        request.onerror = (event) => {
          console.error("Error getting searches:", event);
          reject(new Error("Failed to get search history"));
        };
      });
    } catch (error) {
      console.error("Error in getSearches:", error);
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const request = store.clear();

        request.onsuccess = () => {
          console.log("Search history cleared");
          resolve();
        };

        request.onerror = (event) => {
          console.error("Error clearing history:", event);
          reject(new Error("Failed to clear search history"));
        };
      });
    } catch (error) {
      console.error("Error in clearHistory:", error);
    }
  }

  async deleteSearch(id: number): Promise<void> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const request = store.delete(id);

        request.onsuccess = () => {
          console.log(`Search with ID ${id} deleted`);
          resolve();
        };

        request.onerror = (event) => {
          console.error(`Error deleting search with ID ${id}:`, event);
          reject(new Error(`Failed to delete search with ID ${id}`));
        };
      });
    } catch (error) {
      console.error("Error in deleteSearch:", error);
    }
  }
}

// Initialize the database
const searchHistoryDB = new SearchHistoryDB();

// Get custom bangs from localStorage
function getCustomBangs(): CustomBang[] {
  const stored = localStorage.getItem(CUSTOM_BANGS_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Save custom bangs to localStorage
function saveCustomBangs(customBangs: CustomBang[]): void {
  localStorage.setItem(CUSTOM_BANGS_KEY, JSON.stringify(customBangs));
}

// Add a custom bang
function addCustomBang(trigger: string, urlTemplate: string): void {
  const customBangs = getCustomBangs();
  // Check if trigger already exists
  const existingIndex = customBangs.findIndex(b => b.t.toLowerCase() === trigger.toLowerCase());

  if (existingIndex >= 0) {
    // Update existing bang
    customBangs[existingIndex] = { t: trigger, u: urlTemplate };
  } else {
    // Add new bang
    customBangs.push({ t: trigger, u: urlTemplate });
  }

  saveCustomBangs(customBangs);
}

// Delete a custom bang
function deleteCustomBang(trigger: string): void {
  const customBangs = getCustomBangs();
  const filteredBangs = customBangs.filter(b => b.t.toLowerCase() !== trigger.toLowerCase());
  saveCustomBangs(filteredBangs);
}

// Render custom bangs management UI
function renderCustomBangsManager() {
  const container = document.getElementById('custom-bangs-manager');
  if (!container) return;

  const customBangs = getCustomBangs();

  let html = `
    <div class="mb-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-[#CDD6F4]">Custom Bangs</h2>
        <button id="add-bang-button" class="text-[#A6ADC8] hover:text-[#CDD6F4] p-2 rounded-lg hover:bg-[#9399B2]/30 transition-colors">
          <img src="${plusIcon}" alt="Add Bang" class="w-5 h-5 invert" />
        </button>
      </div>
    </div>

    <div id="add-bang-form" class="hidden mb-4">
      <div class="bg-[#313244]/30 p-4 rounded-lg border border-[#B4BEFE]/20">
        <h3 class="text-[#CDD6F4] font-medium mb-3">Add Custom Bang</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm text-[#A6ADC8] mb-1" for="bang-trigger">Trigger</label>
            <input type="text" id="bang-trigger" class="w-full bg-[#1E1E2E] border border-[#B4BEFE]/20 rounded px-3 py-2 text-[#CDD6F4] focus:outline-none focus:border-[#B4BEFE]" placeholder="e.g. gh">
            <p id="trigger-validation" class="hidden mt-1 text-xs text-red-400"></p>
          </div>
          <div>
            <label class="block text-sm text-[#A6ADC8] mb-1" for="bang-url">URL Template</label>
            <input type="text" id="bang-url" class="w-full bg-[#1E1E2E] border border-[#B4BEFE]/20 rounded px-3 py-2 text-[#CDD6F4] focus:outline-none focus:border-[#B4BEFE]" placeholder="e.g. https://github.com/search?q={{{s}}}">
            <p class="text-xs text-[#A6ADC8] mt-1">Use {{{s}}} as a placeholder for the search term</p>
            <p id="url-validation" class="hidden mt-1 text-xs text-red-400"></p>
          </div>
          <div class="flex gap-2 justify-end">
            <button id="cancel-add-bang" class="px-3 py-1.5 rounded text-[#A6ADC8] hover:text-[#CDD6F4] hover:bg-[#9399B2]/30 transition-colors">Cancel</button>
            <button id="save-bang" class="px-3 py-1.5 rounded bg-[#B4BEFE]/20 text-[#B4BEFE] hover:bg-[#B4BEFE]/30 transition-colors" disabled>Save</button>
          </div>
        </div>
      </div>
    </div>
  `;

  if (customBangs.length === 0) {
    html += `
      <div class="text-center py-6 text-[#A6ADC8]">
        <p>No custom bangs yet</p>
      </div>
    `;
  } else {
    html += `<div class="space-y-2">`;

    for (const bang of customBangs) {
      html += `
        <div class="flex items-center justify-between bg-[#313244]/30 p-3 rounded-lg border border-[#B4BEFE]/20">
          <div>
            <div class="text-[#CDD6F4] font-medium">!${bang.t}</div>
            <div class="text-xs text-[#A6ADC8] mt-1">${bang.u}</div>
          </div>
          <button class="delete-bang text-[#A6ADC8] hover:text-[#CDD6F4] p-1.5 rounded-lg hover:bg-[#9399B2]/30 transition-colors" data-trigger="${bang.t}">
            <img src="${trashIcon}" alt="Delete" class="w-4 h-4 invert" />
          </button>
        </div>
      `;
    }

    html += `</div>`;
  }

  container.innerHTML = html;

  // Add event listeners
  const addBangButton = document.getElementById('add-bang-button');
  const addBangForm = document.getElementById('add-bang-form');
  const cancelAddBang = document.getElementById('cancel-add-bang');
  const saveBang = document.getElementById('save-bang') as HTMLButtonElement;
  const bangTrigger = document.getElementById('bang-trigger') as HTMLInputElement;
  const bangUrl = document.getElementById('bang-url') as HTMLInputElement;
  const triggerValidation = document.getElementById('trigger-validation');
  const urlValidation = document.getElementById('url-validation');

  if (addBangButton && addBangForm) {
    addBangButton.addEventListener('click', () => {
      // Verify bangs array is loaded
      if (bangs && Array.isArray(bangs)) {
        console.log(`Bangs array is loaded with ${bangs.length} items`);
        // Log a few examples to verify content
        if (bangs.length > 0) {
          const examples = bangs.slice(0, 3);
          console.log("Example bangs:", examples);

          // Check if common bangs exist
          const commonBangs = ['g', 'yt', 'gh', 'w'];
          commonBangs.forEach(trigger => {
            const found = bangs.find(b => b.t && b.t.toLowerCase() === trigger.toLowerCase());
            console.log(`Bang "${trigger}" exists: ${found ? 'Yes' : 'No'}`);
          });
        }
      } else {
        console.warn("Bangs array is not properly loaded");
      }

      addBangForm.classList.remove('hidden');
    });
  }

  if (cancelAddBang && addBangForm) {
    cancelAddBang.addEventListener('click', () => {
      addBangForm.classList.add('hidden');
      bangTrigger.value = '';
      bangUrl.value = '';
      // Reset validations
      if (triggerValidation) triggerValidation.classList.add('hidden');
      if (urlValidation) urlValidation.classList.add('hidden');
      if (saveBang) saveBang.disabled = true;
    });
  }

  // Validation function
  function validateForm() {
    let isValid = true;
    const trigger = bangTrigger.value.trim();
    const url = bangUrl.value.trim();
    const customBangs = getCustomBangs();
    const existingCustomBang = customBangs.find(b => b.t.toLowerCase() === trigger.toLowerCase());

    // Check against built-in bangs
    let existingBuiltInBang = null;
    if (bangs && Array.isArray(bangs)) {
      existingBuiltInBang = bangs.find(b => b.t && b.t.toLowerCase() === trigger.toLowerCase());
      console.log(`Checking trigger "${trigger}" against built-in bangs: ${existingBuiltInBang ? 'Found match' : 'No match'}`);
      if (existingBuiltInBang) {
        console.log(`Found built-in bang match: ${JSON.stringify(existingBuiltInBang)}`);
      }
    } else {
      console.warn("Built-in bangs array is not available for validation");
    }

    // Validate trigger
    if (!trigger) {
      triggerValidation!.textContent = "Trigger cannot be empty";
      triggerValidation!.classList.remove('hidden');
      isValid = false;
    } else if (existingCustomBang) {
      triggerValidation!.textContent = "This bang already exists and will be updated";
      triggerValidation!.classList.remove('hidden');
      // This is a warning, not an error
      isValid = true;
    } else if (existingBuiltInBang) {
      triggerValidation!.textContent = "This bang already exists as a built-in bang";
      triggerValidation!.classList.remove('hidden');
      isValid = false;
    } else {
      triggerValidation!.classList.add('hidden');
    }

    // Validate URL
    if (!url) {
      urlValidation!.textContent = "URL template cannot be empty";
      urlValidation!.classList.remove('hidden');
      isValid = false;
    } else if (!url.includes('{{{s}}}')) {
      urlValidation!.textContent = "URL must contain {{{s}}} placeholder";
      urlValidation!.classList.remove('hidden');
      isValid = false;
    } else {
      urlValidation!.classList.add('hidden');
    }

    // Enable/disable save button
    if (saveBang) {
      saveBang.disabled = !isValid;
    }

    return isValid;
  }

  // Add real-time validation
  if (bangTrigger && bangUrl) {
    bangTrigger.addEventListener('input', validateForm);
    bangUrl.addEventListener('input', validateForm);
  }

  if (saveBang && addBangForm && bangTrigger && bangUrl) {
    saveBang.addEventListener('click', () => {
      const trigger = bangTrigger.value.trim();
      const url = bangUrl.value.trim();

      if (validateForm()) {
        addCustomBang(trigger, url);
        addBangForm.classList.add('hidden');
        bangTrigger.value = '';
        bangUrl.value = '';
        renderCustomBangsManager();
      }
    });
  }

  // Add event listeners for delete buttons
  const deleteButtons = document.querySelectorAll('.delete-bang');
  deleteButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const trigger = (e.currentTarget as HTMLElement).dataset.trigger;
      if (trigger) {
        deleteCustomBang(trigger);
        renderCustomBangsManager();
      }
    });
  });
}

// Render search history in the UI
async function renderSearchHistory() {
  const historyContainer = document.getElementById('search-history');
  if (!historyContainer) return;

  try {
    const searches = await searchHistoryDB.getSearches();

    if (searches.length === 0) {
      historyContainer.innerHTML = `
        <div class="text-center py-6 text-[#A6ADC8]">
          <p>No search history yet</p>
        </div>
      `;
      return;
    }

    // Get unique bangs for filtering
    const uniqueBangs = [...new Set(searches.map(s => s.bangUsed).filter(Boolean))];

    // Current filter
    const currentFilter = localStorage.getItem('history-filter') || 'all';
    // Current bang filter
    const currentBangFilter = localStorage.getItem('bang-filter') || 'all';

    // Time filters
    const timeFilters = [
      { id: 'all', label: 'All Time' },
      { id: 'hour', label: 'Last Hour' },
      { id: 'day', label: 'Last Day' },
      { id: 'week', label: 'Last Week' }
    ];

    // Get current time for last updated display
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let html = `
      <div class="mb-4">
        <div class="flex justify-between items-center">
          <div class="flex gap-2 items-center">
            <h2 class="text-xl font-semibold text-[#CDD6F4]">Recent Searches</h2>
            <button id="toggle-history" class="text-[#A6ADC8] hover:text-[#CDD6F4] p-1 rounded-lg hover:bg-[#9399B2]/30 transition-colors">
              <img src="${chevronUpIcon}" alt="Toggle" class="w-5 h-5 invert" id="toggle-icon" />
            </button>
          </div>
          <div class="flex gap-2 items-center">
            <div class="relative" id="filter-dropdown-container">
              <button id="filter-button" class="text-[#A6ADC8] hover:text-[#CDD6F4] p-2 rounded-lg hover:bg-[#9399B2]/30 transition-colors flex items-center gap-1">
                <img src="${filterIcon}" alt="Filter" class="w-5 h-5 invert" />
                <span class="text-sm">${timeFilters.find(f => f.id === currentFilter)?.label || 'Filter'}</span>
              </button>
              <div id="filter-dropdown" class="absolute right-0 mt-2 w-48 bg-[#313244] rounded-lg shadow-lg border border-[#B4BEFE]/20 z-10 hidden">
                <div class="p-2">
                  ${timeFilters.map(filter => `
                    <div class="mb-2">
                      <label class="flex items-center gap-2 text-[#CDD6F4] text-sm">
                        <input type="radio" name="time-filter" value="${filter.id}" ${currentFilter === filter.id ? 'checked' : ''} class="accent-[#B4BEFE]">
                        ${filter.label}
                      </label>
                    </div>
                  `).join('')}
                  <div class="border-t border-[#B4BEFE]/20 my-2 pt-2">
                    <div class="mb-2">
                      <label class="flex items-center gap-2 text-[#CDD6F4] text-sm font-medium">
                        Bang Type
                      </label>
                    </div>
                    <div class="mb-2">
                      <label class="flex items-center gap-2 text-[#CDD6F4] text-sm">
                        <input type="radio" name="bang-filter" value="all" ${currentBangFilter === 'all' ? 'checked' : ''} class="accent-[#B4BEFE]">
                        All bangs
                      </label>
                    </div>
                    ${uniqueBangs.map(bang => `
                      <div class="mb-2">
                        <label class="flex items-center gap-2 text-[#CDD6F4] text-sm">
                          <input type="radio" name="bang-filter" value="${bang}" ${currentBangFilter === bang ? 'checked' : ''} class="accent-[#B4BEFE]">
                          !${bang}
                        </label>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
            <button id="clear-history" class="text-[#A6ADC8] hover:text-[#CDD6F4] p-2 rounded-lg hover:bg-[#9399B2]/30 transition-colors">
              <img src="${trashIcon}" alt="Clear History" class="w-5 h-5 invert" />
            </button>
          </div>
        </div>
        <div class="text-xs text-[#A6ADC8] mt-1">
          Last updated: <span id="last-updated-time">${formattedTime}</span>
          <button id="refresh-history" class="ml-2 text-[#B4BEFE] hover:underline">Refresh</button>
        </div>
      </div>
      <div class="space-y-2" id="search-history-items">
    `;

    // Filter searches based on time
    const hourMs = 60 * 60 * 1000;
    const day = 24 * hourMs;
    const week = 7 * day;

    let filteredSearches = searches;
    if (currentFilter === 'hour') {
      filteredSearches = searches.filter(s => (now.getTime() - s.timestamp) <= hourMs);
    } else if (currentFilter === 'day') {
      filteredSearches = searches.filter(s => (now.getTime() - s.timestamp) <= day);
    } else if (currentFilter === 'week') {
      filteredSearches = searches.filter(s => (now.getTime() - s.timestamp) <= week);
    }

    // Apply bang filter if set
    if (currentBangFilter !== 'all') {
      filteredSearches = filteredSearches.filter(s => s.bangUsed === currentBangFilter);
    }

    // Group searches by day
    const groupedSearches: Record<string, SearchRecord[]> = {};
    filteredSearches.forEach(search => {
      const date = new Date(search.timestamp);
      const dateKey = date.toDateString();

      if (!groupedSearches[dateKey]) {
        groupedSearches[dateKey] = [];
      }

      groupedSearches[dateKey].push(search);
    });

    // Sort dates in reverse chronological order
    const sortedDates = Object.keys(groupedSearches).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    if (filteredSearches.length === 0) {
      html += `
        <div class="text-center py-6 text-[#A6ADC8] flex flex-col items-center">
          <span class="text-3xl font-bold mb-2 text-[#B4BEFE]">!</span>
          <p>No searches found for this filter</p>
        </div>
      `;
    } else {
      for (const dateKey of sortedDates) {
        const searches = groupedSearches[dateKey];
        const date = new Date(dateKey);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateLabel;
        if (date.toDateString() === now.toDateString()) {
          dateLabel = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
          dateLabel = 'Yesterday';
        } else {
          dateLabel = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        }

        html += `
          <div class="mb-3">
            <div class="text-sm text-[#A6ADC8] mb-2">${dateLabel}</div>
            <div class="space-y-2">
        `;

        for (const search of searches) {
          const timeString = new Date(search.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          html += `
            <div class="flex items-center justify-between bg-[#313244]/30 p-3 rounded-lg border border-[#B4BEFE]/20 search-item" data-bang="${search.bangUsed || ''}">
              <div class="flex flex-1 gap-3 items-center cursor-pointer search-item-content hover:bg-[#313244]/80 rounded-lg transition-colors p-1" data-query="${search.query}" data-bang="${search.bangUsed || ''}">
                <div class="text-[#A6ADC8]">
                  <img src="${clockIcon}" alt="Time" class="w-5 h-5 invert" />
                </div>
                <div class="flex-1">
                  <div class="text-[#CDD6F4] flex items-center">
                    <span>${search.query}</span>
                    <span class="ml-2 text-[#A6ADC8] text-xs">(click to search)</span>
                  </div>
                  <div class="text-xs text-[#A6ADC8] flex items-center gap-1 mt-1">
                    <span>at ${timeString}</span>
                    ${search.bangUsed ? `<span class="ml-2 bg-[#B4BEFE]/20 text-[#B4BEFE] px-1.5 py-0.5 rounded text-xs">!${search.bangUsed}</span>` : ''}
                  </div>
                </div>
              </div>
              <button class="delete-search text-[#A6ADC8] hover:text-[#CDD6F4] p-1.5 rounded-lg hover:bg-[#9399B2]/30 transition-colors ml-2" data-id="${search.id}">
                <img src="${trashIcon}" alt="Delete" class="w-4 h-4 invert" />
              </button>
            </div>
          `;
        }

        html += `
            </div>
          </div>
        `;
      }
    }

    html += `</div>`;
    historyContainer.innerHTML = html;

    // Add event listeners for delete buttons
    const deleteButtons = document.querySelectorAll('.delete-search');
    deleteButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const id = Number((e.currentTarget as HTMLElement).dataset.id);
        await searchHistoryDB.deleteSearch(id);
        renderSearchHistory();
      });
    });

    // Add event listeners for clickable search items
    const searchItemContents = document.querySelectorAll('.search-item-content');
    searchItemContents.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const element = e.currentTarget as HTMLElement;
        const query = element.dataset.query;
        const bangUsed = element.dataset.bang;

        if (query) {
          // Generate the search URL using our reusable function
          const searchUrl = generateSearchUrl(query, bangUsed);

          if (searchUrl) {
            // Open in new tab
            console.log(`Opening search in new tab: ${searchUrl}`);
            window.open(searchUrl, '_blank');
          }
        }
      });
    });

    // Add event listener for clear history button
    const clearButton = document.getElementById('clear-history');
    if (clearButton) {
      clearButton.addEventListener('click', async () => {
        // If we're showing all history and all bangs, clear everything
        if (currentFilter === 'all' && currentBangFilter === 'all') {
          await searchHistoryDB.clearHistory();
        } else {
          // Otherwise, only delete the filtered items
          const idsToDelete = filteredSearches.map(s => s.id).filter(id => id !== undefined) as number[];

          // Delete each filtered item individually
          for (const id of idsToDelete) {
            await searchHistoryDB.deleteSearch(id);
          }
        }
        renderSearchHistory();
      });
    }

    // Add event listener for toggle history button
    const toggleButton = document.getElementById('toggle-history');
    const toggleIcon = document.getElementById('toggle-icon');
    const searchHistoryItems = document.getElementById('search-history-items');

    if (toggleButton && toggleIcon && searchHistoryItems) {
      toggleButton.addEventListener('click', () => {
        if (searchHistoryItems.classList.contains('hidden')) {
          searchHistoryItems.classList.remove('hidden');
          (toggleIcon as HTMLImageElement).src = chevronUpIcon;
        } else {
          searchHistoryItems.classList.add('hidden');
          (toggleIcon as HTMLImageElement).src = chevronDownIcon;
        }
      });
    }

    // Add event listener for filter dropdown
    const filterButton = document.getElementById('filter-button');
    const filterDropdown = document.getElementById('filter-dropdown');
    const filterContainer = document.getElementById('filter-dropdown-container');

    if (filterButton && filterDropdown && filterContainer) {
      filterButton.addEventListener('click', (e) => {
        e.stopPropagation();
        filterDropdown.classList.toggle('hidden');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!filterContainer.contains(e.target as Node)) {
          filterDropdown.classList.add('hidden');
        }
      });

      // Add event listeners for time filter radio buttons
      const timeFilterRadios = document.querySelectorAll('input[name="time-filter"]');
      timeFilterRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          const value = (e.target as HTMLInputElement).value;
          localStorage.setItem('history-filter', value);
          renderSearchHistory();
        });
      });

      // Add event listeners for bang filter radio buttons
      const bangFilterRadios = document.querySelectorAll('input[name="bang-filter"]');
      bangFilterRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          const value = (e.target as HTMLInputElement).value;
          localStorage.setItem('bang-filter', value);

          // Apply filter immediately to visible items
          const searchItems = document.querySelectorAll('.search-item');
          searchItems.forEach(item => {
            if (value === 'all') {
              (item as HTMLElement).style.display = 'flex';
            } else {
              const itemBang = (item as HTMLElement).dataset.bang;
              (item as HTMLElement).style.display = (itemBang === value) ? 'flex' : 'none';
            }
          });

          filterDropdown.classList.add('hidden');
        });
      });
    }

    // Add event listener for refresh button
    const refreshButton = document.getElementById('refresh-history');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        renderSearchHistory();
      });
    }
  } catch (error) {
    console.error("Error rendering search history:", error);
    historyContainer.innerHTML = `
      <div class="text-center py-6 text-[#A6ADC8]">
        <p>Error loading search history</p>
      </div>
    `;
  }
}

function noSearchDefaultPageRender() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div class="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[#181825] relative">
      <!-- Main content -->
      <div class="w-full max-w-2xl bg-[#1E1E2E]/80 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-[#313244] text-center">
        <div class="flex justify-center items-center mb-4">
          <h1 class="text-3xl font-bold text-[#CDD6F4]">Und*ck</h1>
        </div>
        <p class="text-[#A6ADC8] mb-6">A faster way to use DuckDuckGo bangs. Add this URL as a custom search engine to your browser. Your searches and custom bangs are stored locally.</p>
        <div class="flex items-center gap-2 bg-[#313244]/50 p-1 rounded-lg border border-[#313244] mb-6">
          <input
            type="text"
            class="flex-1 bg-transparent border-0 px-3 py-2.5 text-[#CDD6F4] focus:outline-none"
            value="${config.baseUrl}/?q=%s"
            readonly
          />
          <button id="copy-button" class="p-2.5 text-[#A6ADC8] hover:text-[#CDD6F4] hover:bg-[#313244]/80 rounded-lg transition-colors copy-button">
            <img src="${clipboardIcon}" alt="Copy" class="w-5 h-5 invert" />
          </button>
        </div>

        <!-- Sidebar toggle buttons -->
        <div class="flex gap-4 justify-center mt-6">
          <button id="open-history-sidebar" class="flex items-center gap-2 px-4 py-2 bg-[#313244]/50 hover:bg-[#313244] text-[#CDD6F4] rounded-lg transition-colors">
            <img src="${clockIcon}" alt="History" class="w-5 h-5 invert" />
            <span>Search History</span>
          </button>
          <button id="open-bangs-sidebar" class="flex items-center gap-2 px-4 py-2 bg-[#313244]/50 hover:bg-[#313244] text-[#CDD6F4] rounded-lg transition-colors">
            <img src="${plusIcon}" alt="Custom Bangs" class="w-5 h-5 invert" />
            <span>Custom Bangs</span>
          </button>
        </div>
      </div>

      <footer class="mt-8 text-center text-sm text-[#A6ADC8]">
        Created by Theo:
        <a href="https://t3.chat" target="_blank" class="hover:text-[#CDD6F4] transition-colors">t3.chat</a>
        •
        <a href="https://x.com/theo" target="_blank" class="hover:text-[#CDD6F4] transition-colors">theo</a>
        •
        <a href="https://github.com/t3dotgg/unduck" target="_blank" class="hover:text-[#CDD6F4] transition-colors">github</a>
        <br />
        Enhanced by Bray:
        <a href="https://x.com/ThisModernDay" target="_blank" class="hover:text-[#CDD6F4] transition-colors">ThisModernDay</a>
        •
        <a href="https://github.com/ThisModernDay/unduck" target="_blank" class="hover:text-[#CDD6F4] transition-colors">github</a>
      </footer>

      <!-- Overlay for when sidebars are open -->
      <div id="sidebar-overlay" class="hidden fixed inset-0 z-10 backdrop-blur-sm bg-black/50"></div>

      <!-- Search History Sidebar -->
      <div id="history-sidebar" class="fixed top-0 right-0 h-full w-full max-w-md bg-[#1E1E2E] border-l border-[#313244] shadow-xl transform translate-x-full transition-transform duration-300 ease-in-out z-20 overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-[#CDD6F4]">Search History</h2>
            <button id="close-history-sidebar" class="text-[#A6ADC8] hover:text-[#CDD6F4] p-2 rounded-lg hover:bg-[#9399B2]/30 transition-colors">
              <img src="${xIcon}" alt="Close" class="w-6 h-6 invert" />
            </button>
          </div>
          <div id="search-history"></div>
        </div>
      </div>

      <!-- Custom Bangs Sidebar -->
      <div id="bangs-sidebar" class="fixed top-0 right-0 h-full w-full max-w-md bg-[#1E1E2E] border-l border-[#313244] shadow-xl transform translate-x-full transition-transform duration-300 ease-in-out z-20 overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-[#CDD6F4]">Custom Bangs</h2>
            <button id="close-bangs-sidebar" class="text-[#A6ADC8] hover:text-[#CDD6F4] p-2 rounded-lg hover:bg-[#9399B2]/30 transition-colors">
              <img src="${xIcon}" alt="Close" class="w-6 h-6 invert" />
            </button>
          </div>
          <div id="custom-bangs-manager"></div>
        </div>
      </div>
    </div>
  `;

  const copyButton = app.querySelector<HTMLButtonElement>("#copy-button")!;
  const copyIcon = copyButton.querySelector("img")!;
  const urlInput = app.querySelector<HTMLInputElement>('input[readonly]')!;

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    copyIcon.src = clipboardCheckIcon;

    setTimeout(() => {
      copyIcon.src = clipboardIcon;
    }, 2000);
  });

  // Sidebar functionality
  const overlay = document.getElementById('sidebar-overlay')!;
  const historySidebar = document.getElementById('history-sidebar')!;
  const bangsSidebar = document.getElementById('bangs-sidebar')!;

  // Open history sidebar
  const openHistorySidebar = document.getElementById('open-history-sidebar')!;
  openHistorySidebar.addEventListener('click', () => {
    historySidebar.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // Refresh history when opening the sidebar
    renderSearchHistory();
  });

  // Open bangs sidebar
  const openBangsSidebar = document.getElementById('open-bangs-sidebar')!;
  openBangsSidebar.addEventListener('click', () => {
    bangsSidebar.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  // Close history sidebar
  const closeHistorySidebar = document.getElementById('close-history-sidebar')!;
  closeHistorySidebar.addEventListener('click', () => {
    historySidebar.classList.add('translate-x-full');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  });

  // Close bangs sidebar
  const closeBangsSidebar = document.getElementById('close-bangs-sidebar')!;
  closeBangsSidebar.addEventListener('click', () => {
    bangsSidebar.classList.add('translate-x-full');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  });

  // Close sidebars when clicking on overlay
  overlay.addEventListener('click', () => {
    historySidebar.classList.add('translate-x-full');
    bangsSidebar.classList.add('translate-x-full');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  });

  // Render search history
  renderSearchHistory();

  // Render custom bangs manager
  renderCustomBangsManager();

  // Add visibility change event listener to update search history when the page becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('Page is now visible, updating search history');
      renderSearchHistory();
    }
  });

  // Add a listener for focus events to update history when returning to the tab
  window.addEventListener('focus', () => {
    console.log('Window regained focus, updating search history');
    renderSearchHistory();
  });
}

const LS_DEFAULT_BANG = localStorage.getItem("default-bang") ?? "g";
const defaultBang = bangs.find((b) => b.t.toLowerCase() === LS_DEFAULT_BANG.toLowerCase());

// Function to generate a search URL based on query and bang
function generateSearchUrl(query: string, bangTrigger?: string): string | null {
  if (!query) {
    return null;
  }

  // If a bang trigger is provided, try to find it
  if (bangTrigger) {
    // Check custom bangs first
    const customBangs = getCustomBangs();
    const customBang = customBangs.find(b => b.t.toLowerCase() === bangTrigger.toLowerCase());

    if (customBang) {
      console.log(`Using custom bang: ${customBang.t} -> ${customBang.u}`);
      return customBang.u.replace("{{{s}}}", encodeURIComponent(query).replace(/%2F/g, "/"));
    }

    // Then check available bangs
    if (bangs && Array.isArray(bangs)) {
      const bang = bangs.find(b => b.t && b.t.toLowerCase() === bangTrigger.toLowerCase());
      if (bang) {
        console.log(`Using built-in bang: ${bang.t} -> ${bang.u}`);
        return bang.u.replace("{{{s}}}", encodeURIComponent(query).replace(/%2F/g, "/"));
      }
    }
  }

  // Default to the default bang if no bang is specified or bang not found
  if (bangs && Array.isArray(bangs) && defaultBang) {
    console.log(`Using default bang: ${defaultBang.t} -> ${defaultBang.u}`);
    return defaultBang.u.replace("{{{s}}}", encodeURIComponent(query).replace(/%2F/g, "/"));
  } else {
    // Fallback to Google if defaultBang is not available
    console.log("No default bang available, using Google fallback");
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
}

function getBangredirectUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("q")?.trim();

  if (!query) {
    return null;
  }

  // Debug logging for bangs array
  console.log(`Bangs array available: ${bangs && Array.isArray(bangs)}`);
  console.log(`Bangs array length: ${bangs ? bangs.length : 0}`);
  if (bangs && bangs.length > 0) {
    console.log(`First bang example: ${JSON.stringify(bangs[0])}`);
  }

  // Check if query contains a bang (anywhere in the string)
  const bangRegex = /!(\S+)/;
  const bangMatch = query.match(bangRegex);

  if (bangMatch) {
    const bangTrigger = bangMatch[1].toLowerCase();
    // Get the search term by removing the bang from the query
    const searchTerm = query.replace(bangMatch[0], '').trim();

    console.log(`Bang trigger: "${bangTrigger}", Search term: "${searchTerm}"`);

    // Check for a search URL using the extracted bang and search term
    const searchUrl = generateSearchUrl(searchTerm, bangTrigger);

    if (searchUrl) {
      // Add to search history
      searchHistoryDB.addSearch(searchTerm, bangTrigger).catch(err => console.error("Error adding to history:", err));
      return searchUrl;
    }
  }

  // No bang found, use the entire query with the default bang
  const searchUrl = generateSearchUrl(query);

  if (searchUrl) {
    // Add to search history with the default bang
    const bangUsed = defaultBang ? defaultBang.t : "g";
    searchHistoryDB.addSearch(query, bangUsed).catch(err => console.error("Error adding to history:", err));
    return searchUrl;
  }

  return null;
}

// Function to verify client-side redirects are working
function verifyClientSideRedirect(url: string): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !window.location) {
    console.error("Not in a browser environment, client-side redirects won't work");
    return false;
  }

  // Check if the URL is valid
  try {
    new URL(url);
  } catch (e) {
    console.error("Invalid URL for redirect:", url);
    return false;
  }

  // Check if we have permission to navigate
  if (window.location.origin === 'null') {
    console.warn("Running in a restricted context, redirects may be blocked");
  }

  // Log that we're doing a client-side redirect
  console.log("Performing client-side redirect to:", url);
  console.log("Redirect timestamp:", new Date().toISOString());

  return true;
}

function doRedirect() {
  try {
    const searchUrl = getBangredirectUrl();
    if (!searchUrl) {
      // No query or redirect URL, show the default page
      noSearchDefaultPageRender();
      return;
    }

    // Add debugging information to console
    console.log(`Redirecting to: ${searchUrl}`);

    // Verify that client-side redirects are possible
    if (!verifyClientSideRedirect(searchUrl)) {
      console.error("Client-side redirect verification failed, showing default page instead");
      noSearchDefaultPageRender();
      return;
    }

    // CLIENT-SIDE ONLY REDIRECTS
    // All redirects happen locally in the browser without server involvement

    // Try to redirect using window.location.replace (preferred method - doesn't add to browser history)
    try {
      console.log("Attempting redirect with window.location.replace");
      window.location.replace(searchUrl);

      // Set a timeout to check if redirect didn't happen (may not be reliable in all browsers)
      setTimeout(() => {
        console.log("Redirect may not have completed, trying alternative method");
        window.location.href = searchUrl;
      }, 1000);
    } catch (error) {
      console.error("Error with window.location.replace:", error);

      // Fallback to window.location.href if replace fails
      try {
        console.log("Attempting redirect with window.location.href");
        window.location.href = searchUrl;
      } catch (error2) {
        console.error("Error with window.location.href:", error2);

        // Last resort: create and click a link
        console.log("Attempting redirect with programmatic link click");
        const link = document.createElement('a');
        link.href = searchUrl;
        link.target = '_self';
        document.body.appendChild(link);
        link.click();

        // Clean up the DOM
        setTimeout(() => document.body.removeChild(link), 100);
      }
    }
  } catch (error) {
    console.error("Error in doRedirect:", error);
    // Show the default page if there's an error
    noSearchDefaultPageRender();
  }
}

// Apply theme to the document
document.documentElement.className = theme.colors.background;

// Start the application
doRedirect();
