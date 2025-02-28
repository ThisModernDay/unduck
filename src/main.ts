import { bangs } from "./bang";
import "./global.css";
import config from "./config";
import { theme } from "./themes";

// Icon imports from Lucide
import clipboardIcon from "lucide-static/icons/clipboard.svg";
import clipboardCheckIcon from "lucide-static/icons/clipboard-check.svg";
import clockIcon from "lucide-static/icons/clock.svg";
import chevronDownIcon from "lucide-static/icons/chevron-down.svg";
import filterIcon from "lucide-static/icons/filter.svg";
import trashIcon from "lucide-static/icons/trash-2.svg";
import xIcon from "lucide-static/icons/x.svg";
import plusIcon from "lucide-static/icons/plus.svg";
import chartIcon from "lucide-static/icons/bar-chart-2.svg";

const DB_NAME = "unduck";
const DB_VERSION = 2;
const STORE_NAME = "searchHistory";
const STATS_STORE_NAME = "statistics";
const LS_DEFAULT_BANG = localStorage.getItem("default-bang") ?? "g";
const defaultBang = bangs.find((b) => b.t === LS_DEFAULT_BANG);

type TimeFilter = "all" | "week" | "24h" | "1h";

interface HistoryItem {
  id?: number;
  query: string;
  timestamp: number;
}

interface CustomBang {
  t: string;  // trigger
  u: string;  // url template
}

interface BangStat {
  bang: string;
  count: number;
  lastUsed: number;
}

// Add custom bangs management
const CUSTOM_BANGS_KEY = "custom-bangs";

function getCustomBangs(): CustomBang[] {
  const stored = localStorage.getItem(CUSTOM_BANGS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveCustomBangs(customBangs: CustomBang[]) {
  localStorage.setItem(CUSTOM_BANGS_KEY, JSON.stringify(customBangs));
}

function validateBangTrigger(trigger: string): { isValid: boolean; error?: string } {
  if (!trigger) return { isValid: true }; // Empty is valid while typing
  if (!/^[a-z0-9]+$/i.test(trigger)) {
    return { isValid: false, error: "Bang trigger can only contain letters and numbers" };
  }

  // Check for conflicts with built-in bangs and custom bangs
  const customBangs = getCustomBangs();
  const allBangs = [...bangs, ...customBangs];
  if (allBangs.some(b => b.t.toLowerCase() === trigger.toLowerCase())) {
    return { isValid: false, error: "Bang trigger already exists" };
  }

  return { isValid: true };
}

function validateBangUrl(url: string): { isValid: boolean; error?: string } {
  if (!url) return { isValid: true }; // Empty is valid while typing
  if (!url.includes("{{{s}}}")) {
    return { isValid: false, error: "URL template must contain {{{s}}} placeholder" };
  }

  try {
    new URL(url.replace("{{{s}}}", "test"));
    return { isValid: true };
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }
}

class SearchHistoryDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create search history store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp");
        }

        // Create statistics store if it doesn't exist
        if (!db.objectStoreNames.contains(STATS_STORE_NAME)) {
          const statsStore = db.createObjectStore(STATS_STORE_NAME, {
            keyPath: "bang"
          });
          statsStore.createIndex("count", "count");
          statsStore.createIndex("lastUsed", "lastUsed");
        }
      };
    });
  }

  async addSearch(query: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      // First get all items to check for duplicates
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const items = getAllRequest.result;
        const existingItem = items.find(item => item.query === query);

        if (existingItem) {
          // Update timestamp of existing item
          const updateRequest = store.put({
            ...existingItem,
            timestamp: Date.now()
          });
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          // Add new item
          const addRequest = store.add({
            query,
            timestamp: Date.now()
          });

          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        }
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSearchHistory(filter: TimeFilter = "all"): Promise<HistoryItem[]> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const now = Date.now();
        const items = getAllRequest.result
          .sort((a, b) => b.timestamp - a.timestamp)
          .filter(item => {
            const age = now - item.timestamp;
            switch (filter) {
              case "1h":
                return age < 3600000; // 1 hour in ms
              case "24h":
                return age < 86400000; // 24 hours in ms
              case "week":
                return age < 604800000; // 1 week in ms
              default:
                return true;
            }
          });
        resolve(items);
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearHistory(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearHistoryByTimeframe(timeframe: TimeFilter): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const now = Date.now();
        const items = getAllRequest.result.filter(item => {
          const age = now - item.timestamp;
          switch (timeframe) {
            case "1h":
              return age >= 3600000; // Keep items older than 1 hour
            case "24h":
              return age >= 86400000; // Keep items older than 24 hours
            case "week":
              return age >= 604800000; // Keep items older than 1 week
            case "all":
              return false; // Delete all items
            default:
              return true;
          }
        });

        // Clear the store
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          if (timeframe === "all") {
            resolve();
            return;
          }

          // If not clearing all, add back the items we want to keep
          const promises = items.map(item =>
            new Promise<void>((res, rej) => {
              const addRequest = store.add(item);
              addRequest.onsuccess = () => res();
              addRequest.onerror = () => rej(addRequest.error);
            })
          );

          Promise.all(promises)
            .then(() => resolve())
            .catch(error => reject(error));
        };
        clearRequest.onerror = () => reject(clearRequest.error);
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async trackBangUsage(bangTrigger: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STATS_STORE_NAME, "readwrite");
      const store = tx.objectStore(STATS_STORE_NAME);

      // Get current stats for this bang if they exist
      const getRequest = store.get(bangTrigger);

      getRequest.onsuccess = () => {
        const existingStat = getRequest.result as BangStat | undefined;
        const now = Date.now();

        if (existingStat) {
          // Update existing stat
          const updateRequest = store.put({
            ...existingStat,
            count: existingStat.count + 1,
            lastUsed: now
          });

          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          // Create new stat
          const addRequest = store.add({
            bang: bangTrigger,
            count: 1,
            lastUsed: now
          });

          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getTopBangs(limit: number = 10): Promise<BangStat[]> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STATS_STORE_NAME, "readonly");
      const store = tx.objectStore(STATS_STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const stats = getAllRequest.result as BangStat[];
        // Sort by count (descending) and take the top 'limit' items
        const topBangs = stats
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);

        resolve(topBangs);
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getRecentBangs(limit: number = 5): Promise<BangStat[]> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STATS_STORE_NAME, "readonly");
      const store = tx.objectStore(STATS_STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const stats = getAllRequest.result as BangStat[];
        // Sort by last used (descending) and take the top 'limit' items
        const recentBangs = stats
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, limit);

        resolve(recentBangs);
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getTotalSearchCount(): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };

      countRequest.onerror = () => reject(countRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearStats(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STATS_STORE_NAME, "readwrite");
      const store = tx.objectStore(STATS_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const db = new SearchHistoryDB();

// Initialize DB and start the application
async function initializeApp() {
  await db.init().catch(error => {
    console.error("Failed to initialize database:", error);
  });

  // Apply theme to the document
  document.documentElement.className = theme.colors.background;

  // Start the application
  void doRedirect();
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // If it's today
  if (date.toDateString() === today.toDateString()) {
    return `Today at ${timeStr}`;
  }
  // If it's yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${timeStr}`;
  }
  // Otherwise show full date and time
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ' at ' + timeStr;
}

async function renderSearchHistory(filter: TimeFilter = "1h"): Promise<string> {
  const history = await db.getSearchHistory(filter);

  const currentToggle = document.querySelector<HTMLButtonElement>(".history-toggle");
  const isExpanded = currentToggle ? currentToggle.getAttribute("aria-expanded") === "true" : true;

  const historyItems = history.length > 0
    ? history
      .map(item => `
        <button class="w-full flex items-start p-3.5 bg-[#313244]/30 hover:bg-[#45475A]/50 rounded-xl border border-[#B4BEFE]/20 text-[#CDD6F4] hover:translate-x-1 transition-all" data-query="${item.query}">
          <div class="w-full">
            <span class="text-left text-xs text-[#A6ADC8] font-medium">${formatDate(item.timestamp)}</span>
            <div class="flex items-center gap-3 mt-1.5">
              <img src="${clockIcon}" alt="History" class="w-4 h-4 opacity-80 invert" />
              <span class="truncate">${item.query}</span>
            </div>
          </div>
        </button>
      `)
      .join('')
    : `<div class="p-4 text-center text-[#A6ADC8] italic bg-[#313244]/30 rounded-xl border border-[#B4BEFE]/20 my-2">No recent searches</div>`;

  const filterOptions = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Past 24 Hours' },
    { value: 'week', label: 'Past Week' },
    { value: 'all', label: 'All History' }
  ];

  return `
    <div class="mt-8 w-full text-left rounded-xl overflow-hidden bg-[#1E1E2E]/20 border border-[#B4BEFE]/20">
      <div class="flex items-center justify-between p-4 bg-[#313244]/40 transition-colors">
        <div class="flex gap-4 items-center">
          <button class="history-toggle flex items-center gap-2 text-[#CDD6F4]/90 hover:opacity-80 transition-opacity" aria-expanded="${isExpanded}">
            <h2 class="text-base font-semibold text-[#CDD6F4] m-0">Recent Searches</h2>
            <img src="${chevronDownIcon}" alt="Toggle history" class="w-[18px] h-[18px] opacity-80 invert transition-transform duration-200"
              style="transform: rotate(${isExpanded ? '180deg' : '0deg'})" />
          </button>
          <div class="flex gap-2 items-center pl-4 ml-2 border-l border-[#45475A]">
            <img src="${filterIcon}" alt="Filter" class="w-4 h-4 opacity-70 invert" />
            <select class="history-filter bg-[#313244]/30 text-sm text-[#CDD6F4] hover:text-[#CDD6F4] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B4BEFE]/30 rounded-lg px-2 py-1 border border-[#B4BEFE]/20 appearance-none" aria-label="Filter history" style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23CDD6F4\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"/></svg>'); background-repeat: no-repeat; background-position: right 8px center; padding-right: 24px;">
              ${filterOptions.map(option => `
                <option value="${option.value}" ${option.value === filter ? 'selected' : ''} class="bg-[#1E1E2E] text-[#CDD6F4]">
                  ${option.label}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <button id="stats-button" class="stats-button p-2 text-[#A6ADC8] hover:text-[#CDD6F4] hover:bg-[#9399B2]/30 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" aria-label="Usage Statistics">
            <img src="${chartIcon}" alt="Stats" class="w-[18px] h-[18px] opacity-80 invert" />
          </button>
          <button id="settings-button" class="settings-button p-2 text-[#A6ADC8] hover:text-[#CDD6F4] hover:bg-[#9399B2]/30 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
            <span class="text-xl font-bold leading-none">!</span>
          </button>
          <button id="clear-history-button" class="clear-history-button p-2 text-[#A6ADC8] hover:text-[#CDD6F4] hover:bg-[#9399B2]/30 rounded-lg transition-colors">
            <img src="${trashIcon}" alt="Clear" class="w-[18px] h-[18px] opacity-80 invert" />
          </button>
        </div>
      </div>
      <div class="history-items p-3 max-h-[400px] overflow-y-auto scrollbar-thin space-y-2"
        style="display: ${isExpanded ? 'block' : 'none'}">
        ${historyItems}
      </div>
    </div>
  `;
}

function renderCustomBangsList(): string {
  const customBangs = getCustomBangs();

  if (customBangs.length === 0) {
    return `<p class="text-[#A6ADC8] text-center py-4 italic">No custom bangs added yet</p>`;
  }

  return `
    <div class="grid gap-2.5">
      ${customBangs.map(bang => `
        <div class="flex items-center justify-between p-3.5 bg-[#313244]/30 hover:bg-[#45475A]/50 rounded-xl border border-[#B4BEFE]/20 gap-4 min-w-0 transition-colors">
          <div class="flex-1 min-w-0 flex flex-col gap-1.5">
            <strong class="block text-sm text-[#CDD6F4] font-medium">!${bang.t}</strong>
            <span class="block text-xs text-[#A6ADC8] truncate">${bang.u}</span>
          </div>
          <button class="delete-bang p-2 text-[#A6ADC8] hover:text-[#F38BA8] hover:bg-[#F38BA8]/10 rounded-lg transition-colors flex-shrink-0" data-trigger="${bang.t}">
            <img src="${trashIcon}" alt="Delete" class="w-4 h-4 opacity-80 invert" />
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

// Replace the addTooltip function with this much simpler implementation
function addTooltip(element: HTMLElement, text: string) {
  // Add tooltip directly in HTML using data attributes
  element.setAttribute('data-tooltip', text);
  element.classList.add('tooltip-trigger');
}

async function noSearchDefaultPageRender() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const historyHtml = await renderSearchHistory("1h");
  const statsModalHtml = await renderStatsModal();

  app.innerHTML = `
    <div class="fixed inset-0 z-50 w-screen h-screen pointer-events-none">
      <div class="flex hidden fixed inset-0 z-50 justify-center items-center backdrop-blur-md pointer-events-auto bg-[#181825]/90" id="clearHistoryModal">
        <div class="w-[90%] max-w-md bg-[#1E1E2E] rounded-xl border ${theme.colors.border} shadow-2xl transform transition-all">
          <div class="flex justify-between items-center p-5 border-b border-[#313244]">
            <h3 class="text-lg font-semibold ${theme.colors.text}">Clear History</h3>
            <button class="p-2 ${theme.colors.textSecondary} hover:${theme.colors.text} ${theme.colors.buttonHover} rounded-lg transition-colors close-modal">
              <img src="${xIcon}" alt="Close" class="w-5 h-5 invert" />
            </button>
          </div>
          <div class="p-5">
            <p class="${theme.colors.textSecondary} mb-5">Choose which history to clear:</p>
            <div class="grid gap-2.5">
              <button class="text-left p-3.5 bg-[#313244]/30 hover:bg-[#45475A]/50 rounded-xl border-[#B4BEFE]/20 ${theme.colors.text} hover:translate-x-1 transition-all clear-option" data-timeframe="1h">Last Hour</button>
              <button class="text-left p-3.5 bg-[#313244]/30 hover:bg-[#45475A]/50 rounded-xl border-[#B4BEFE]/20 ${theme.colors.text} hover:translate-x-1 transition-all clear-option" data-timeframe="24h">Past 24 Hours</button>
              <button class="text-left p-3.5 bg-[#313244]/30 hover:bg-[#45475A]/50 rounded-xl border-[#B4BEFE]/20 ${theme.colors.text} hover:translate-x-1 transition-all clear-option" data-timeframe="week">Past Week</button>
              <button class="text-left p-3.5 bg-[#313244]/30 hover:bg-[#45475A]/50 rounded-xl border-[#B4BEFE]/20 ${theme.colors.text} hover:translate-x-1 transition-all clear-option" data-timeframe="all">All History</button>
            </div>
          </div>
        </div>
      </div>
      <div class="flex hidden fixed inset-0 z-50 justify-center items-center backdrop-blur-md pointer-events-auto bg-[#181825]/90" id="customBangsModal">
        <div class="w-[90%] max-w-md bg-[#1E1E2E] rounded-xl border ${theme.colors.border} shadow-2xl transform transition-all">
          <div class="flex justify-between items-center p-5 border-b border-[#313244]">
            <h3 class="text-lg font-semibold ${theme.colors.text}">Custom Bangs</h3>
            <button class="p-2 ${theme.colors.textSecondary} hover:${theme.colors.text} ${theme.colors.buttonHover} rounded-lg transition-colors close-modal">
              <img src="${xIcon}" alt="Close" class="w-5 h-5 invert" />
            </button>
          </div>
          <div class="p-5">
            <div class="pb-5 mb-6 border-b border-[#313244]">
              ${renderCustomBangsList()}
            </div>
            <form class="space-y-5 add-bang-form">
              <div class="space-y-1.5 relative">
                <label for="bangTrigger" class="block text-sm ${theme.colors.textSecondary}">Bang Trigger (without !)</label>
                <input type="text" id="bangTrigger" placeholder="e.g., gh" required
                  class="w-full bg-[#313244]/50 border-[#B4BEFE]/20 rounded-xl px-4 py-3 ${theme.colors.text} placeholder-[#6C7086] focus:outline-none focus:ring-2 focus:ring-[#B4BEFE]/30 focus:border-transparent" />
                <div class="absolute right-0 left-0 -bottom-5 text-xs text-[#F38BA8] opacity-0 transition-all"></div>
              </div>
              <div class="space-y-1.5 relative">
                <label for="bangUrl" class="block text-sm ${theme.colors.textSecondary}">URL Template</label>
                <input type="text" id="bangUrl" placeholder="https://example.com/search?q={{{s}}}" required
                  class="w-full bg-[#313244]/50 border-[#B4BEFE]/20 rounded-xl px-4 py-3 ${theme.colors.text} placeholder-[#6C7086] focus:outline-none focus:ring-2 focus:ring-[#B4BEFE]/30 focus:border-transparent" />
                <small class="block text-xs ${theme.colors.textSecondary} mt-1">Use {{{s}}} where the search term should go</small>
                <div class="absolute right-0 left-0 -bottom-5 text-xs text-[#F38BA8] opacity-0 transition-all"></div>
              </div>
              <button type="submit" class="add-bang-button w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#313244]/50 hover:bg-[#45475A]/50 rounded-xl border-[#B4BEFE]/20 ${theme.colors.text} transition-colors">
                <img src="${plusIcon}" alt="" class="w-4 h-4 invert" />
                Add Custom Bang
              </button>
            </form>
          </div>
        </div>
      </div>
      <div class="flex hidden fixed inset-0 z-50 justify-center items-center backdrop-blur-md pointer-events-auto bg-[#181825]/90" id="statsModal">
        ${statsModalHtml}
      </div>
    </div>
    <div class="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-[#1E1E2E] via-[#181825] to-[#313244]">
      <div class="w-full max-w-2xl bg-[#313244]/40 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-[#B4BEFE]/20 text-center">
        <div class="flex justify-center items-center mb-4">
          <h1 class="text-3xl font-bold text-[#CDD6F4]">Und*ck</h1>
        </div>
        <p class="text-[#A6ADC8] mb-6">A faster way to use <a href="https://duckduckgo.com/bang.html" target="_blank" class="text-[#A6ADC8] hover:text-[#CDD6F4] transition-colors">DuckDuckGo bangs</a>. Add this URL as a custom search engine to your browser. Your searches and custom bangs are stored locally.</p>
        <div class="flex items-center gap-2 bg-[#313244]/30 p-1 rounded-lg border border-[#B4BEFE]/20">
          <input
            type="text"
            class="flex-1 bg-transparent border-0 px-3 py-2.5 text-[#CDD6F4] focus:outline-none"
            value="${config.baseUrl}/?q=%s"
            readonly
          />
          <button id="copy-button" class="p-2.5 text-[#A6ADC8] hover:text-[#CDD6F4] hover:bg-[#9399B2]/30 rounded-lg transition-colors copy-button">
            <img src="${clipboardIcon}" alt="Copy" class="w-5 h-5 invert" />
          </button>
        </div>
        ${historyHtml}
      </div>
      <footer class="absolute bottom-4 text-center text-sm text-[#A6ADC8]">
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
    </div>
  `;

  const copyButton = app.querySelector<HTMLButtonElement>("#copy-button")!;
  const copyIcon = copyButton.querySelector("img")!;
  const urlInput = app.querySelector<HTMLInputElement>('input[readonly]')!;

  // Add tooltip to copy button
  addTooltip(copyButton, "Copy URL");

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    copyIcon.src = clipboardCheckIcon;

    setTimeout(() => {
      copyIcon.src = clipboardIcon;
    }, 2000);
  });

  // Attach all event listeners after rendering
  attachHistoryEventListeners();
}

function attachHistoryEventListeners() {
  const app = document.querySelector<HTMLDivElement>("#app")!;

  // Add click handlers for history items
  const historyItems = app.querySelectorAll<HTMLButtonElement>("[data-query]");
  historyItems.forEach(item => {
    const newItem = item.cloneNode(true) as HTMLButtonElement;
    item.parentNode?.replaceChild(newItem, item);

    newItem.addEventListener("click", () => {
      const query = newItem.dataset.query;
      if (query) {
        window.location.href = `?q=${encodeURIComponent(query)}`;
      }
    });
  });

  // Add toggle functionality for history section
  const historyToggle = app.querySelector<HTMLButtonElement>(".history-toggle");
  const historyContent = app.querySelector<HTMLDivElement>(".history-items");

  if (historyToggle && historyContent) {
    const newHistoryToggle = historyToggle.cloneNode(true) as HTMLButtonElement;
    historyToggle.parentNode?.replaceChild(newHistoryToggle, historyToggle);

    newHistoryToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isExpanded = newHistoryToggle.getAttribute("aria-expanded") === "true";
      const newExpandedState = !isExpanded;

      newHistoryToggle.setAttribute("aria-expanded", newExpandedState.toString());
      historyContent.style.display = newExpandedState ? 'block' : 'none';

      const newToggleIcon = newHistoryToggle.querySelector<HTMLImageElement>("img");
      if (newToggleIcon) {
        newToggleIcon.style.transform = `rotate(${newExpandedState ? '180deg' : '0deg'})`;
      }
    });
  }

  // Add event listener for the stats button
  const statsButton = app.querySelector<HTMLButtonElement>("#stats-button");
  const statsModal = app.querySelector<HTMLDivElement>("#statsModal");

  if (statsButton && statsModal) {
    // Add tooltip to stats button
    addTooltip(statsButton, "Usage Statistics");

    statsButton.addEventListener("click", () => {
      statsModal.classList.remove("hidden");
      statsModal.classList.add("flex");
    });
  }

  // Add event listener for the settings button (custom bangs)
  const settingsButton = app.querySelector<HTMLButtonElement>("#settings-button");
  const customBangsModal = app.querySelector<HTMLDivElement>("#customBangsModal");

  if (settingsButton && customBangsModal) {
    // Add tooltip to settings button
    addTooltip(settingsButton, "Custom Bangs");

    settingsButton.addEventListener("click", () => {
      customBangsModal.classList.remove("hidden");
      customBangsModal.classList.add("flex");
    });
  }

  // Add event listener for the clear history button
  const clearHistoryButton = app.querySelector<HTMLButtonElement>("#clear-history-button");
  const clearHistoryModal = app.querySelector<HTMLDivElement>("#clearHistoryModal");

  if (clearHistoryButton && clearHistoryModal) {
    // Add tooltip to clear history button
    addTooltip(clearHistoryButton, "Clear History");

    clearHistoryButton.addEventListener("click", () => {
      clearHistoryModal.classList.remove("hidden");
      clearHistoryModal.classList.add("flex");
    });
  }

  // Add event listeners for the close modal buttons
  const closeModalButtons = app.querySelectorAll<HTMLButtonElement>(".close-modal");
  closeModalButtons.forEach(button => {
    button.addEventListener("click", () => {
      const modal = button.closest(".fixed.inset-0.z-50");
      if (modal) {
        modal.classList.remove("flex");
        modal.classList.add("hidden");
      }
    });
  });

  // Add event listeners for the clear history options
  const clearOptions = app.querySelectorAll<HTMLButtonElement>(".clear-option");
  clearOptions.forEach(option => {
    option.addEventListener("click", async () => {
      const timeframe = option.getAttribute("data-timeframe") as TimeFilter;
      if (timeframe) {
        await db.clearHistoryByTimeframe(timeframe);

        // Update the history display
        const historyContainer = app.querySelector<HTMLDivElement>(".history-items");
        if (historyContainer) {
          const currentFilter = app.querySelector<HTMLSelectElement>(".history-filter")?.value as TimeFilter || "1h";
          const newHistoryHtml = await renderSearchHistory(currentFilter);

          // Extract just the history items from the HTML
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = newHistoryHtml;
          const newItems = tempDiv.querySelector(".history-items")?.innerHTML || "";

          historyContainer.innerHTML = newItems;
        }

        // Close the modal
        const modal = option.closest(".fixed.inset-0.z-50");
        if (modal) {
          modal.classList.remove("flex");
          modal.classList.add("hidden");
        }
      }
    });
  });

  // Add event listener for the clear stats button
  const clearStatsButton = app.querySelector<HTMLButtonElement>("#clear-stats-button");
  if (clearStatsButton) {
    clearStatsButton.addEventListener("click", async () => {
      await db.clearStats();

      // Update the stats modal with fresh data
      const statsModal = app.querySelector<HTMLDivElement>("#statsModal");
      if (statsModal) {
        const newStatsModalHtml = await renderStatsModal();
        statsModal.innerHTML = newStatsModalHtml;

        // Reattach event listeners for the close button and clear stats button
        const closeButton = statsModal.querySelector<HTMLButtonElement>(".close-modal");
        if (closeButton) {
          closeButton.addEventListener("click", () => {
            statsModal.classList.remove("flex");
            statsModal.classList.add("hidden");
          });
        }

        const newClearStatsButton = statsModal.querySelector<HTMLButtonElement>("#clear-stats-button");
        if (newClearStatsButton) {
          newClearStatsButton.addEventListener("click", async () => {
            await db.clearStats();
            const refreshedStatsModalHtml = await renderStatsModal();
            statsModal.innerHTML = refreshedStatsModalHtml;
          });
        }
      }
    });
  }

  // Add event listener for the history filter dropdown
  const historyFilter = app.querySelector<HTMLSelectElement>(".history-filter");
  if (historyFilter) {
    historyFilter.addEventListener("change", async () => {
      const filter = historyFilter.value as TimeFilter;
      const historyContainer = app.querySelector<HTMLDivElement>(".history-items");

      if (historyContainer) {
        const newHistoryHtml = await renderSearchHistory(filter);

        // Extract just the history items from the HTML
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = newHistoryHtml;
        const newItems = tempDiv.querySelector(".history-items")?.innerHTML || "";

        historyContainer.innerHTML = newItems;

        // Reattach event listeners to the new history items
        const newHistoryItems = historyContainer.querySelectorAll<HTMLButtonElement>("[data-query]");
        newHistoryItems.forEach(item => {
          item.addEventListener("click", () => {
            const query = item.dataset.query;
            if (query) {
              window.location.href = `?q=${encodeURIComponent(query)}`;
            }
          });
        });
      }
    });
  }

  // Add event listener for the add bang form
  const addBangForm = app.querySelector<HTMLFormElement>(".add-bang-form");
  if (addBangForm) {
    addBangForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const bangTriggerInput = addBangForm.querySelector<HTMLInputElement>("#bangTrigger");
      const bangUrlInput = addBangForm.querySelector<HTMLInputElement>("#bangUrl");

      if (bangTriggerInput && bangUrlInput) {
        const trigger = bangTriggerInput.value.trim();
        const url = bangUrlInput.value.trim();

        // Validate inputs
        const triggerValidation = validateBangTrigger(trigger);
        const urlValidation = validateBangUrl(url);

        const triggerError = addBangForm.querySelector<HTMLDivElement>("#bangTrigger + div");
        const urlError = addBangForm.querySelector<HTMLDivElement>("#bangUrl + small + div");

        // Reset error states
        if (triggerError) {
          triggerError.textContent = "";
          triggerError.style.opacity = "0";
        }

        if (urlError) {
          urlError.textContent = "";
          urlError.style.opacity = "0";
        }

        // Show errors if validation fails
        if (!triggerValidation.isValid && triggerError) {
          triggerError.textContent = triggerValidation.error || "Invalid trigger";
          triggerError.style.opacity = "1";
          return;
        }

        if (!urlValidation.isValid && urlError) {
          urlError.textContent = urlValidation.error || "Invalid URL";
          urlError.style.opacity = "1";
          return;
        }

        // Add the custom bang
        const customBangs = getCustomBangs();
        customBangs.push({ t: trigger, u: url });
        saveCustomBangs(customBangs);

        // Update the custom bangs list
        const customBangsList = app.querySelector<HTMLDivElement>(".pb-5.mb-6.border-b.border-\\[\\#313244\\]");
        if (customBangsList) {
          customBangsList.innerHTML = renderCustomBangsList();

          // Reattach delete event listeners
          attachDeleteBangListeners();
        }

        // Reset the form
        bangTriggerInput.value = "";
        bangUrlInput.value = "";
      }
    });
  }

  // Attach delete bang event listeners
  attachDeleteBangListeners();
}

// Helper function to attach delete bang event listeners
function attachDeleteBangListeners() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const deleteBangButtons = app.querySelectorAll<HTMLButtonElement>(".delete-bang");

  deleteBangButtons.forEach(button => {
    button.addEventListener("click", () => {
      const trigger = button.getAttribute("data-trigger");
      if (trigger) {
        // Remove the bang from custom bangs
        const customBangs = getCustomBangs();
        const updatedBangs = customBangs.filter(b => b.t !== trigger);
        saveCustomBangs(updatedBangs);

        // Update the custom bangs list
        const customBangsList = app.querySelector<HTMLDivElement>(".pb-5.mb-6.border-b.border-\\[\\#313244\\]");
        if (customBangsList) {
          customBangsList.innerHTML = renderCustomBangsList();

          // Reattach delete event listeners
          attachDeleteBangListeners();
        }
      }
    });
  });
}

// Implementation of doRedirect function
function doRedirect() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("q");

  if (query) {
    // Add to search history
    void db.addSearch(query);

    // Check if it's a bang
    if (query.startsWith("!")) {
      const bangTrigger = query.substring(1).split(" ")[0];
      const searchTerm = query.substring(bangTrigger.length + 1).trim();

      // Track bang usage
      void db.trackBangUsage(bangTrigger);

      // Check custom bangs first
      const customBangs = getCustomBangs();
      const customBang = customBangs.find(b => b.t === bangTrigger);

      if (customBang) {
        window.location.href = customBang.u.replace("{{{s}}}", encodeURIComponent(searchTerm));
        return;
      }

      // Then check built-in bangs
      const bang = bangs.find(b => b.t === bangTrigger);
      if (bang) {
        window.location.href = bang.u.replace("{{{s}}}", encodeURIComponent(searchTerm));
        return;
      }
    }

    // Default to the default bang if no bang is specified or bang not found
    if (defaultBang) {
      // Track default bang usage
      void db.trackBangUsage(defaultBang.t);
      window.location.href = defaultBang.u.replace("{{{s}}}", encodeURIComponent(query));
      return;
    }
  } else {
    // No query, show the default page
    void noSearchDefaultPageRender();
  }
}

async function renderStatsModal(): Promise<string> {
  // Get statistics data
  const topBangs = await db.getTopBangs(5);
  const recentBangs = await db.getRecentBangs(5);
  const totalSearches = await db.getTotalSearchCount();

  // Format the top bangs list
  const topBangsList = topBangs.length > 0
    ? topBangs.map((stat, index) => `
        <div class="flex items-center justify-between p-3 ${index !== topBangs.length - 1 ? 'border-b border-[#313244]' : ''}">
          <div class="flex items-center gap-2">
            <span class="text-[#B4BEFE] font-medium">${index + 1}.</span>
            <span class="text-[#CDD6F4]">!${stat.bang}</span>
          </div>
          <span class="text-[#A6ADC8] text-sm">${stat.count} uses</span>
        </div>
      `).join('')
    : `<div class="p-4 text-center text-[#A6ADC8] italic">No bang statistics yet</div>`;

  // Format the recent bangs list
  const recentBangsList = recentBangs.length > 0
    ? recentBangs.map((stat, index) => `
        <div class="flex items-center justify-between p-3 ${index !== recentBangs.length - 1 ? 'border-b border-[#313244]' : ''}">
          <span class="text-[#CDD6F4]">!${stat.bang}</span>
          <span class="text-[#A6ADC8] text-sm">${formatDate(stat.lastUsed)}</span>
        </div>
      `).join('')
    : `<div class="p-4 text-center text-[#A6ADC8] italic">No recent bangs</div>`;

  return `
    <div class="w-[90%] max-w-md bg-[#1E1E2E] rounded-xl border ${theme.colors.border} shadow-2xl transform transition-all">
      <div class="flex justify-between items-center p-5 border-b border-[#313244]">
        <h3 class="text-lg font-semibold ${theme.colors.text}">Usage Statistics</h3>
        <button class="p-2 ${theme.colors.textSecondary} hover:${theme.colors.text} ${theme.colors.buttonHover} rounded-lg transition-colors close-modal">
          <img src="${xIcon}" alt="Close" class="w-5 h-5 invert" />
        </button>
      </div>
      <div class="p-5">
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-[#313244]/30 p-4 rounded-xl border border-[#B4BEFE]/20 text-center">
            <div class="text-2xl font-bold text-[#CDD6F4]">${totalSearches}</div>
            <div class="text-sm text-[#A6ADC8]">Total Searches</div>
          </div>
          <div class="bg-[#313244]/30 p-4 rounded-xl border border-[#B4BEFE]/20 text-center">
            <div class="text-2xl font-bold text-[#CDD6F4]">${topBangs.length}</div>
            <div class="text-sm text-[#A6ADC8]">Unique Bangs</div>
          </div>
        </div>

        <div class="mb-6">
          <h4 class="text-base font-semibold text-[#CDD6F4] mb-3">Most Used Bangs</h4>
          <div class="bg-[#313244]/30 rounded-xl border border-[#B4BEFE]/20 overflow-hidden">
            ${topBangsList}
          </div>
        </div>

        <div class="mb-6">
          <h4 class="text-base font-semibold text-[#CDD6F4] mb-3">Recently Used Bangs</h4>
          <div class="bg-[#313244]/30 rounded-xl border border-[#B4BEFE]/20 overflow-hidden">
            ${recentBangsList}
          </div>
        </div>

        <button id="clear-stats-button" class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#313244]/50 hover:bg-[#45475A]/50 rounded-xl border border-[#B4BEFE]/20 ${theme.colors.text} transition-colors">
          <img src="${trashIcon}" alt="" class="w-4 h-4 invert" />
          Clear Statistics
        </button>
      </div>
    </div>
  `;
}

// Initialize the application
initializeApp();