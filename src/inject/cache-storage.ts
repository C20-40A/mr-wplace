/**
 * IndexedDB wrapper for persistent tile cache (inject context)
 *
 * Storage structure:
 * - DB: "mr-wplace-cache"
 * - Object Store: "tiles"
 * - Key: "tileX,tileY" (e.g., "0,0")
 * - Value: { blob: Blob, lastAccessed: number }
 */

const DB_NAME = "mr-wplace-cache";
const STORE_NAME = "tiles";
const DB_VERSION = 1;

interface CachedTile {
  arrayBuffer: ArrayBuffer; // Store as ArrayBuffer instead of Blob for IndexedDB persistence
  lastAccessed: number;
}

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
   * Get cached tile
   */
  async getCachedTile(key: string): Promise<Blob | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cached = request.result as CachedTile | undefined;
        if (cached) {
          // Convert ArrayBuffer back to Blob
          const blob = new Blob([cached.arrayBuffer], { type: "image/png" });
          // Update last accessed time
          store.put({ arrayBuffer: cached.arrayBuffer, lastAccessed: Date.now() }, key);
          resolve(blob);
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Set cached tile with LRU eviction
   */
  async setCachedTile(key: string, blob: Blob, maxSize: number): Promise<void> {
    await this.init();
    if (!this.db) return;

    // Convert Blob to ArrayBuffer for reliable IndexedDB storage
    const arrayBuffer = await blob.arrayBuffer();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      // Add new tile
      const addRequest = store.put(
        { arrayBuffer, lastAccessed: Date.now() } as CachedTile,
        key
      );

      addRequest.onerror = () => reject(addRequest.error);
      addRequest.onsuccess = async () => {
        // Check cache size and evict if necessary
        await this.evictIfNeeded(maxSize);
        resolve();
      };
    });
  }

  /**
   * Evict old tiles if cache size exceeds limit
   */
  private async evictIfNeeded(maxSize: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const keys = request.result as IDBValidKey[];
        const currentSize = keys.length;

        if (currentSize <= maxSize) {
          resolve();
          return;
        }

        // Get all entries with timestamps
        const entries: Array<{ key: IDBValidKey; lastAccessed: number }> = [];
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const values = getAllRequest.result as CachedTile[];
          values.forEach((value, index) => {
            entries.push({ key: keys[index], lastAccessed: value.lastAccessed });
          });

          // Sort by lastAccessed (oldest first)
          entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

          // Delete oldest entries
          const deleteCount = currentSize - maxSize;
          const deleteTransaction = this.db!.transaction(STORE_NAME, "readwrite");
          const deleteStore = deleteTransaction.objectStore(STORE_NAME);

          for (let i = 0; i < deleteCount; i++) {
            deleteStore.delete(entries[i].key);
          }

          deleteTransaction.oncomplete = () => {
            console.log(`🧑‍🎨 : Evicted ${deleteCount} old tiles from cache`);
            resolve();
          };

          deleteTransaction.onerror = () => reject(deleteTransaction.error);
        };

        getAllRequest.onerror = () => reject(getAllRequest.error);
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

  /**
   * Delete specific tile
   */
  async deleteTile(key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const tileCacheDB = new TileCacheDB();

/**
 * Invalidate cache for a specific tile
 * Removes from both memory cache and IndexedDB
 */
export const invalidateTileCache = async (cacheKey: string): Promise<void> => {
  const dataSaver = window.mrWplaceDataSaver;
  if (!dataSaver) {
    console.warn("🧑‍🎨 : dataSaver not initialized");
    return;
  }

  // Remove from memory cache
  if (dataSaver.tileCache.has(cacheKey)) {
    dataSaver.tileCache.delete(cacheKey);
    console.log("🧑‍🎨 : Removed tile from memory cache:", cacheKey);
  }

  // Remove from IndexedDB
  if (dataSaver.tileCacheDB) {
    try {
      await dataSaver.tileCacheDB.deleteTile(cacheKey);
      console.log("🧑‍🎨 : Removed tile from IndexedDB:", cacheKey);
    } catch (error) {
      console.warn("🧑‍🎨 : Failed to remove tile from IndexedDB:", error);
    }
  }
};
