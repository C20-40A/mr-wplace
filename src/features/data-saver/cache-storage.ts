/**
 * IndexedDB wrapper for persistent tile cache (content script context)
 *
 * NOTE: This is a separate instance from src/inject/cache-storage.ts
 * Both access the same IndexedDB but run in different JS contexts.
 * - inject側: 実際のタイルキャッシュ読み書き (ArrayBuffer形式で保存)
 * - content側 (このファイル): 統計表示用 (getCacheSize, clearCacheのみ使用)
 *
 * Storage structure:
 * - DB: "mr-wplace-cache"
 * - Object Store: "tiles"
 * - Key: "tileX,tileY" (e.g., "0,0")
 * - Value: { arrayBuffer: ArrayBuffer, lastAccessed: number } (inject側で書き込み)
 */

const DB_NAME = "mr-wplace-cache";
const STORE_NAME = "tiles";
const DB_VERSION = 1;

class TileCacheDB {
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("🧑‍🎨 : Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("🧑‍🎨 : IndexedDB initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
          console.log("🧑‍🎨 : Created object store:", STORE_NAME);
        }
      };
    });
  }

  /**
   * Clear all cached tiles
   */
  async clearCache(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log("🧑‍🎨 : Cache cleared");
        resolve();
      };
    });
  }

  /**
   * Get current cache size
   */
  async getCacheSize(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

export const tileCacheDB = new TileCacheDB();
