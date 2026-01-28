/**
 * Cross-browser API wrapper for Chrome and Firefox
 *
 * Firefox: uses `browser` namespace with Promises
 * Chrome: uses `chrome` namespace with callbacks (converted to Promises)
 */

// Browser detection
const isFirefox = typeof browser !== "undefined";
const browserAPI = isFirefox ? browser : chrome;

// Storage API - 完全互換
export const storage = {
  /**
   * Get values for specified keys
   * @param keys - Key(s) to retrieve. Do NOT pass null (use getKeys() + get() instead)
   */
  get: async (keys: string | string[]): Promise<Record<string, any>> => {
    return await browserAPI.storage.local.get(keys);
  },

  /**
   * Get all keys in storage (without loading values)
   * Use this instead of get(null) for memory efficiency
   */
  getKeys: async (): Promise<string[]> => {
    // Chrome 130+ and Firefox 130+ support getKeys()
    if (typeof browserAPI.storage.local.getKeys === "function") {
      return await browserAPI.storage.local.getKeys();
    }
    // Fallback for older browsers: get(null) then extract keys
    const all = await browserAPI.storage.local.get(null);
    return Object.keys(all);
  },

  set: async (items: Record<string, any>): Promise<void> => {
    await browserAPI.storage.local.set(items);
  },

  remove: async (keys: string | string[]): Promise<void> => {
    await browserAPI.storage.local.remove(keys);
  },
};

// Runtime API - 完全互換
export const runtime = {
  getURL: (path: string): string => {
    return browserAPI.runtime.getURL(path);
  },

  sendMessage: async (message: any): Promise<any> => {
    return await browserAPI.runtime.sendMessage(message);
  },

  onMessage: browserAPI.runtime.onMessage,

  get lastError() {
    return browserAPI.runtime.lastError;
  },
};

// Tabs API - 完全互換
export const tabs = {
  query: async (
    queryInfo: chrome.tabs.QueryInfo
  ): Promise<chrome.tabs.Tab[]> => {
    return await browserAPI.tabs.query(queryInfo);
  },

  sendMessage: async (tabId: number, message: any): Promise<any> => {
    return await browserAPI.tabs.sendMessage(tabId, message);
  },

  reload: async (tabId: number): Promise<void> => {
    await browserAPI.tabs.reload(tabId);
  },
};

// Note: alarms と notifications は service worker 専用のため
// service_worker.js で直接 chrome.alarms / chrome.notifications を使用

// ブラウザ情報のexport
const browserInfo = { isFirefox, isChrome: !isFirefox };

console.log("🧑‍🎨 : Browser API initialized", browserInfo);
