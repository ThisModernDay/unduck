import { bangs } from "./bang";
import "./global.css";
import config from "./config";
import clipboardIcon from "lucide-static/icons/clipboard.svg";
import clipboardCheckIcon from "lucide-static/icons/clipboard-check.svg";
import clockIcon from "lucide-static/icons/clock.svg";
import chevronDownIcon from "lucide-static/icons/chevron-down.svg";
import filterIcon from "lucide-static/icons/filter.svg";
import trashIcon from "lucide-static/icons/trash-2.svg";
import xIcon from "lucide-static/icons/x.svg";
import plusIcon from "lucide-static/icons/plus.svg";
import alertCircleIcon from "lucide-static/icons/alert-circle.svg";

const DB_NAME = "unduck";
const DB_VERSION = 1;
const STORE_NAME = "searchHistory";
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp");
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
}

const db = new SearchHistoryDB();

// Initialize DB and start the application
async function initializeApp() {
  await db.init().catch(error => {
    console.error("Failed to initialize database:", error);
  });

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

  // Get current expanded state from existing toggle if it exists
  const currentToggle = document.querySelector<HTMLButtonElement>(".history-toggle");
  const isExpanded = currentToggle ? currentToggle.getAttribute("aria-expanded") === "true" : true;

  const historyItems = history.length > 0
    ? history
      .map(item => `
        <button class="history-item" data-query="${item.query}">
          <div class="history-item-content">
            <span class="history-timestamp">${formatDate(item.timestamp)}</span>
            <div class="history-main">
              <img src="${clockIcon}" alt="History" class="history-icon" />
              <span class="history-query">${item.query}</span>
            </div>
          </div>
        </button>
      `)
      .join('')
    : '<div class="empty-history">No recent searches</div>';

  const filterOptions = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Past 24 Hours' },
    { value: 'week', label: 'Past Week' },
    { value: 'all', label: 'All History' }
  ];

  return `
    <div class="search-history">
      <div class="history-header">
        <div class="history-header-left">
          <button class="history-toggle" aria-expanded="${isExpanded}">
            <h2>Recent Searches</h2>
            <img src="${chevronDownIcon}" alt="Toggle history" class="toggle-icon" style="transform: rotate(${isExpanded ? '180deg' : '0deg'})" />
          </button>
          <div class="filter-container">
            <img src="${filterIcon}" alt="Filter" class="filter-icon" />
            <select class="history-filter" aria-label="Filter history">
              ${filterOptions.map(option => `
                <option value="${option.value}" ${option.value === filter ? 'selected' : ''}>
                  ${option.label}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="history-actions">
          <button class="settings-button" data-tooltip="Manage custom bangs" aria-label="Manage custom bangs">
            <img src="${alertCircleIcon}" alt="Custom Bangs" class="settings-icon" />
          </button>
          <button class="clear-history-button" data-tooltip="Clear history" aria-label="Clear history">
            <img src="${trashIcon}" alt="Clear" class="clear-icon" />
          </button>
        </div>
      </div>
      <div class="history-items" style="display: ${isExpanded ? 'block' : 'none'}">
        ${historyItems}
      </div>
    </div>
  `;
}

function renderCustomBangsList(): string {
  const customBangs = getCustomBangs();
  if (customBangs.length === 0) {
    return '<p class="no-bangs">No custom bangs added yet</p>';
  }

  return `
    <div class="bangs-list">
      ${customBangs.map(bang => `
        <div class="bang-item">
          <div class="bang-info">
            <strong>!${bang.t}</strong>
            <span class="bang-url">${bang.u}</span>
          </div>
          <button class="delete-bang" data-tooltip="Delete bang" data-trigger="${bang.t}">
            <img src="${trashIcon}" alt="Delete" />
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

async function noSearchDefaultPageRender() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const historyHtml = await renderSearchHistory("1h");

  app.innerHTML = `
    <div class="modals-container">
      <div class="modal" id="clearHistoryModal" hidden>
        <div class="modal-content">
          <div class="modal-header">
            <h3>Clear History</h3>
            <button class="close-modal">
              <img src="${xIcon}" alt="Close" />
            </button>
          </div>
          <div class="modal-body">
            <p>Choose which history to clear:</p>
            <div class="clear-options">
              <button class="clear-option" data-timeframe="1h">Last Hour</button>
              <button class="clear-option" data-timeframe="24h">Past 24 Hours</button>
              <button class="clear-option" data-timeframe="week">Past Week</button>
              <button class="clear-option" data-timeframe="all">All History</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal" id="customBangsModal" hidden>
        <div class="modal-content">
          <div class="modal-header">
            <h3>Custom Bangs</h3>
            <button class="close-modal">
              <img src="${xIcon}" alt="Close" />
            </button>
          </div>
          <div class="modal-body">
            <div class="custom-bangs-list">
              ${renderCustomBangsList()}
            </div>
            <form class="add-bang-form">
              <div class="form-group">
                <label for="bangTrigger">Bang Trigger (without !)</label>
                <input type="text" id="bangTrigger" placeholder="e.g., gh" required />
              </div>
              <div class="form-group">
                <label for="bangUrl">URL Template</label>
                <input type="text" id="bangUrl" placeholder="https://example.com/search?q={{{s}}}" required />
                <small>Use {{{s}}} where the search term should go</small>
              </div>
              <button type="submit" class="add-bang-button">
                <img src="${plusIcon}" alt="" />
                Add Custom Bang
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
    <div class="page-container">
      <div class="content-container">
        <h1>Und*ck</h1>
        <p>A faster way to use <a href="https://duckduckgo.com/bang.html" target="_blank">DuckDuckGo bangs</a>. Add this URL as a custom search engine to your browser. Your searches and custom bangs are stored locally.</p>
        <div class="url-container">
          <input
            type="text"
            class="url-input"
            value="${config.baseUrl}/?q=%s"
            readonly
          />
          <button class="copy-button" data-tooltip="Copy URL">
            <img src="${clipboardIcon}" alt="Copy" />
          </button>
        </div>
        ${historyHtml}
      </div>
      <footer class="footer">
        Created by Theo:
        <a href="https://t3.chat" target="_blank">t3.chat</a>
        •
        <a href="https://x.com/theo" target="_blank">theo</a>
        •
        <a href="https://github.com/t3dotgg/unduck" target="_blank">github</a>
        <br />
        Enhanced by Bray:
        <a href="https://x.com/ThisModernDay" target="_blank">ThisModernDay</a>
        •
        <a href="https://github.com/ThisModernDay/unduck" target="_blank">github</a>
      </footer>
    </div>
  `;

  const copyButton = app.querySelector<HTMLButtonElement>(".copy-button")!;
  const copyIcon = copyButton.querySelector("img")!;
  const urlInput = app.querySelector<HTMLInputElement>(".url-input")!;

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
  const historyItems = app.querySelectorAll<HTMLButtonElement>(".history-item");
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
  const toggleIcon = app.querySelector<HTMLImageElement>(".toggle-icon");

  if (historyToggle && historyContent && toggleIcon) {
    const newHistoryToggle = historyToggle.cloneNode(true) as HTMLButtonElement;
    historyToggle.parentNode?.replaceChild(newHistoryToggle, historyToggle);

    newHistoryToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isExpanded = newHistoryToggle.getAttribute("aria-expanded") === "true";
      const newExpandedState = !isExpanded;

      newHistoryToggle.setAttribute("aria-expanded", newExpandedState.toString());
      historyContent.style.display = newExpandedState ? 'block' : 'none';

      const newToggleIcon = newHistoryToggle.querySelector<HTMLImageElement>(".toggle-icon");
      if (newToggleIcon) {
        newToggleIcon.style.transform = `rotate(${newExpandedState ? '180deg' : '0deg'})`;
      }
    });
  }

  // Add filter change handler
  const historyFilter = app.querySelector<HTMLSelectElement>(".history-filter");
  const historyContainer = app.querySelector<HTMLDivElement>(".search-history");

  if (historyFilter && historyContainer) {
    const newHistoryFilter = historyFilter.cloneNode(true) as HTMLSelectElement;
    historyFilter.parentNode?.replaceChild(newHistoryFilter, historyFilter);

    newHistoryFilter.addEventListener("change", async (e) => {
      e.stopPropagation();
      const filter = (e.target as HTMLSelectElement).value as TimeFilter;
      const newHistoryHtml = await renderSearchHistory(filter);
      historyContainer.outerHTML = newHistoryHtml;
      attachHistoryEventListeners();
    });
  }

  // Add clear history button functionality
  const clearButton = app.querySelector<HTMLButtonElement>(".clear-history-button");
  const modal = app.querySelector<HTMLDivElement>("#clearHistoryModal");
  const closeModal = modal?.querySelector<HTMLButtonElement>(".close-modal");
  const clearOptions = modal?.querySelectorAll<HTMLButtonElement>(".clear-option");

  if (clearButton && modal) {
    const newClearButton = clearButton.cloneNode(true) as HTMLButtonElement;
    clearButton.parentNode?.replaceChild(newClearButton, clearButton);

    newClearButton.addEventListener("click", () => {
      modal.hidden = false;
    });
  }

  if (closeModal && modal) {
    const newCloseModal = closeModal.cloneNode(true) as HTMLButtonElement;
    closeModal.parentNode?.replaceChild(newCloseModal, closeModal);

    newCloseModal.addEventListener("click", () => {
      modal.hidden = true;
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.hidden = true;
      }
    });
  }

  if (clearOptions) {
    clearOptions.forEach(option => {
      const newOption = option.cloneNode(true) as HTMLButtonElement;
      option.parentNode?.replaceChild(newOption, option);

      newOption.addEventListener("click", async () => {
        const timeframe = newOption.dataset.timeframe as TimeFilter;
        await db.clearHistoryByTimeframe(timeframe);

        const historyContainer = app.querySelector<HTMLDivElement>(".search-history");
        if (historyContainer) {
          const currentFilter = app.querySelector<HTMLSelectElement>(".history-filter")?.value as TimeFilter ?? "1h";
          const newHistoryHtml = await renderSearchHistory(currentFilter);
          historyContainer.outerHTML = newHistoryHtml;
          attachHistoryEventListeners();
        }

        if (modal) {
          modal.hidden = true;
        }
      });
    });
  }

  // Add settings button functionality
  const settingsButton = app.querySelector<HTMLButtonElement>(".settings-button");
  const customBangsModal = app.querySelector<HTMLDivElement>("#customBangsModal");
  const closeCustomBangsModal = customBangsModal?.querySelector<HTMLButtonElement>(".close-modal");
  const addBangForm = customBangsModal?.querySelector<HTMLFormElement>(".add-bang-form");
  const bangTriggerInput = customBangsModal?.querySelector<HTMLInputElement>("#bangTrigger");
  const bangUrlInput = customBangsModal?.querySelector<HTMLInputElement>("#bangUrl");
  const addBangButton = customBangsModal?.querySelector<HTMLButtonElement>(".add-bang-button");

  if (bangTriggerInput) {
    const validationMessage = document.createElement("div");
    validationMessage.className = "validation-message";
    bangTriggerInput.parentElement?.appendChild(validationMessage);

    bangTriggerInput.addEventListener("input", () => {
      const trigger = bangTriggerInput.value.trim();
      const validation = validateBangTrigger(trigger);

      validationMessage.textContent = validation.error || "";
      validationMessage.className = `validation-message ${validation.isValid ? "" : "error"}`;

      // Update button state
      if (addBangButton) {
        const urlValidation = validateBangUrl(bangUrlInput?.value.trim() || "");
        addBangButton.disabled = !validation.isValid || !urlValidation.isValid;
      }
    });
  }

  if (bangUrlInput) {
    const validationMessage = document.createElement("div");
    validationMessage.className = "validation-message";
    bangUrlInput.parentElement?.appendChild(validationMessage);

    bangUrlInput.addEventListener("input", () => {
      const url = bangUrlInput.value.trim();
      const validation = validateBangUrl(url);

      validationMessage.textContent = validation.error || "";
      validationMessage.className = `validation-message ${validation.isValid ? "" : "error"}`;

      // Update button state
      if (addBangButton) {
        const triggerValidation = validateBangTrigger(bangTriggerInput?.value.trim() || "");
        addBangButton.disabled = !validation.isValid || !triggerValidation.isValid;
      }
    });
  }

  if (settingsButton && customBangsModal) {
    settingsButton.addEventListener("click", () => {
      customBangsModal.hidden = false;
      // Clear validation messages when opening modal
      customBangsModal.querySelectorAll(".validation-message").forEach(el => {
        el.textContent = "";
        el.className = "validation-message";
      });
      // Reset form and button state
      if (addBangForm) {
        addBangForm.reset();
        if (addBangButton) addBangButton.disabled = false;
      }
    });
  }

  if (closeCustomBangsModal && customBangsModal) {
    closeCustomBangsModal.addEventListener("click", () => {
      customBangsModal.hidden = true;
    });

    customBangsModal.addEventListener("click", (e) => {
      if (e.target === customBangsModal) {
        customBangsModal.hidden = true;
      }
    });
  }

  if (addBangForm) {
    addBangForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const trigger = (addBangForm.querySelector("#bangTrigger") as HTMLInputElement).value.trim();
      const url = (addBangForm.querySelector("#bangUrl") as HTMLInputElement).value.trim();

      // Don't allow empty submissions
      if (!trigger || !url) {
        return;
      }

      const triggerValidation = validateBangTrigger(trigger);
      const urlValidation = validateBangUrl(url);

      if (!triggerValidation.isValid || !urlValidation.isValid) {
        return;
      }

      const customBangs = getCustomBangs();
      customBangs.push({ t: trigger, u: url });
      saveCustomBangs(customBangs);

      // Update the list and reset form
      const listContainer = customBangsModal?.querySelector(".custom-bangs-list");
      if (listContainer && customBangsModal) {
        listContainer.innerHTML = renderCustomBangsList();
        // Reattach delete button listeners
        attachDeleteButtonListeners(customBangsModal);
      }
      addBangForm.reset();

      // Clear validation messages
      customBangsModal?.querySelectorAll(".validation-message").forEach(el => {
        el.textContent = "";
        el.className = "validation-message";
      });

      // Reset button state
      if (addBangButton) addBangButton.disabled = false;
    });
  }

  // Add delete bang functionality
  function attachDeleteButtonListeners(modal: HTMLElement) {
    const deleteButtons = modal.querySelectorAll<HTMLButtonElement>(".delete-bang");
    deleteButtons.forEach(button => {
      const newButton = button.cloneNode(true) as HTMLButtonElement;
      button.parentNode?.replaceChild(newButton, button);

      newButton.addEventListener("click", () => {
        const trigger = newButton.dataset.trigger;
        if (!trigger) return;

        const customBangs = getCustomBangs().filter(b => b.t !== trigger);
        saveCustomBangs(customBangs);

        // Update the list
        const listContainer = modal?.querySelector(".custom-bangs-list");
        if (listContainer) {
          listContainer.innerHTML = renderCustomBangsList();
          // Reattach delete button listeners
          attachDeleteButtonListeners(modal);
        }
      });
    });
  }

  // Initial attachment of delete button listeners
  if (customBangsModal) {
    attachDeleteButtonListeners(customBangsModal);
  }
}

async function getBangredirectUrl() {
  const url = new URL(window.location.href);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    void noSearchDefaultPageRender();
    return null;
  }

  const match = query.match(/!(\S+)/i);
  const bangCandidate = match?.[1]?.toLowerCase();

  // Check both built-in and custom bangs
  const customBangs = getCustomBangs();
  const selectedBang = [...bangs, ...customBangs].find((b) => b.t.toLowerCase() === bangCandidate) ?? defaultBang;

  const cleanQuery = query.replace(/!\S+\s*/i, "").trim();

  const searchUrl = selectedBang?.u.replace(
    "{{{s}}}",
    encodeURIComponent(cleanQuery).replace(/%2F/g, "/")
  );
  if (!searchUrl) return null;

  // Update search history before redirecting
  await db.addSearch(query);

  return searchUrl;
}

async function doRedirect() {
  try {
    const searchUrl = await getBangredirectUrl();
    if (!searchUrl) return;

    // Redirect immediately after history is updated
    window.location.replace(searchUrl);
  } catch (error) {
    console.error("Error during redirect:", error);
  }
}

// Initialize the application
initializeApp();
