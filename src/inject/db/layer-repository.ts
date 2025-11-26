/**
 * LayerRepository - Phase 2.2: Repository & Data Layer
 *
 * This repository abstracts layer data access with automatic fast/fallback path switching:
 * - Fast path: Get tiles from optimized_tiles (State B)
 * - Fallback path: Extract tiles from legacy_blobs (State A)
 * - Automatic Worker migration request when using fallback
 */

import {
  type LayerMetadata,
  type LegacyBlobData,
  type OptimizedTileData,
  type LayerStatistics,
  STORES
} from './schema';

export class LayerRepository {
  private db: IDBDatabase;
  private tileCache: Map<string, ImageBitmap> = new Map();
  private maxCacheSize = 100; // Maximum number of cached tiles
  private worker: Worker | null = null;
  private migrationQueue: Set<string> = new Set();

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  /**
   * Set the Worker instance for migration requests
   */
  setWorker(worker: Worker): void {
    this.worker = worker;
  }

  /**
   * Get tile with automatic fast/fallback path switching
   *
   * Flow:
   * 1. Check memory cache
   * 2. Check layer metadata
   * 3. If isOptimized=true, get from optimized_tiles (fast path)
   * 4. If isOptimized=false or tile not found, extract from legacy_blobs (fallback)
   * 5. Request Worker migration if using fallback
   */
  async getTile(layerId: string, tileKey: string): Promise<ImageBitmap | null> {
    const cacheKey = `${layerId}:${tileKey}`;

    // 1. Check memory cache
    if (this.tileCache.has(cacheKey)) {
      return this.tileCache.get(cacheKey)!;
    }

    // 2. Get layer metadata
    const layer = await this.getLayerMetadata(layerId);

    if (!layer) {
      return null;
    }

    let bitmap: ImageBitmap | null = null;

    // 3. Fast path: get from optimized_tiles
    if (layer.isOptimized) {
      bitmap = await this.getOptimizedTile(layerId, tileKey);
    }

    // 4. Fallback path: extract from legacy_blobs
    if (!bitmap) {
      bitmap = await this.extractTileFromLegacyBlob(layerId, tileKey, layer);

      // 5. Request migration if not already in queue
      if (!layer.isOptimized && !this.migrationQueue.has(layerId)) {
        this.requestMigration(layerId, layer);
      }
    }

    // Cache the result
    if (bitmap) {
      this.addToCache(cacheKey, bitmap);
    }

    return bitmap;
  }

  /**
   * Get layer metadata
   */
  async getLayerMetadata(layerId: string): Promise<LayerMetadata | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LAYERS], 'readonly');
      const store = tx.objectStore(STORES.LAYERS);
      const request = store.get(layerId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all layer metadata
   */
  async getAllLayers(): Promise<LayerMetadata[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LAYERS], 'readonly');
      const store = tx.objectStore(STORES.LAYERS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get visible layers only (for startup optimization)
   */
  async getVisibleLayers(): Promise<LayerMetadata[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LAYERS], 'readonly');
      const store = tx.objectStore(STORES.LAYERS);
      const index = store.index('visible');
      const request = index.getAll(true); // Only visible layers

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save a new layer (metadata + blob)
   */
  async saveLayer(layer: LayerMetadata, blob: Blob): Promise<void> {
    // Get image dimensions
    const img = await createImageBitmap(blob);
    const width = img.width;
    const height = img.height;
    img.close();

    // Save metadata
    await this.updateLayerMetadata(layer.id, layer);

    // Save legacy blob
    const legacyData: LegacyBlobData = {
      id: layer.id,
      blob,
      width,
      height,
      timestamp: Date.now()
    };

    await this.saveLegacyBlob(legacyData);

    console.log(`🧑‍🎨 : Saved layer ${layer.id} (${width}x${height})`);
  }

  /**
   * Update layer metadata
   */
  async updateLayerMetadata(
    layerId: string,
    updates: Partial<LayerMetadata>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LAYERS], 'readwrite');
      const store = tx.objectStore(STORES.LAYERS);
      const getRequest = store.get(layerId);

      getRequest.onsuccess = () => {
        const layer = getRequest.result;

        // If layer doesn't exist, create new one
        if (!layer) {
          const putRequest = store.put(updates);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
          return;
        }

        // Update existing layer
        const updated = { ...layer, ...updates };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete a layer (metadata + blobs + tiles)
   */
  async deleteLayer(layerId: string): Promise<void> {
    // Delete metadata
    await this.deleteLayerMetadata(layerId);

    // Delete legacy blob
    await this.deleteLegacyBlob(layerId);

    // Delete optimized tiles
    await this.deleteOptimizedTiles(layerId);

    // Delete statistics
    await this.deleteStatistics(layerId);

    // Clear memory cache
    this.clearCacheForLayer(layerId);

    console.log(`🧑‍🎨 : Deleted layer ${layerId}`);
  }

  /**
   * Invalidate layer (set isOptimized = false, delete optimized tiles)
   *
   * This is called when a layer is edited or moved.
   * The next getTile() will use fallback path and trigger re-migration.
   */
  async invalidateLayer(layerId: string): Promise<void> {
    // 1. Set isOptimized = false
    await this.updateLayerMetadata(layerId, { isOptimized: false });

    // 2. Delete optimized tiles
    await this.deleteOptimizedTiles(layerId);

    // 3. Clear memory cache
    this.clearCacheForLayer(layerId);

    console.log(`🧑‍🎨 : Invalidated layer ${layerId}`);
  }

  /**
   * Get statistics for a layer
   */
  async getStatistics(layerId: string): Promise<LayerStatistics | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.STATISTICS], 'readonly');
      const store = tx.objectStore(STORES.STATISTICS);
      const request = store.get(layerId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update statistics for a layer
   */
  async updateStatistics(layerId: string, stats: LayerStatistics): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.STATISTICS], 'readwrite');
      const store = tx.objectStore(STORES.STATISTICS);
      const request = store.put(stats);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear cache for all layers
   */
  clearCache(): void {
    for (const bitmap of this.tileCache.values()) {
      bitmap.close();
    }

    this.tileCache.clear();
    console.log('🧑‍🎨 : Cleared tile cache');
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.tileCache.size;
  }

  // === Private methods ===

  /**
   * Get optimized tile (fast path)
   */
  private async getOptimizedTile(
    layerId: string,
    tileKey: string
  ): Promise<ImageBitmap | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.OPTIMIZED_TILES], 'readonly');
      const store = tx.objectStore(STORES.OPTIMIZED_TILES);
      const request = store.get([layerId, tileKey]);

      request.onsuccess = async () => {
        const data: OptimizedTileData | undefined = request.result;

        if (!data) {
          resolve(null);
          return;
        }

        try {
          const bitmap = await createImageBitmap(data.blob);
          resolve(bitmap);
        } catch (error) {
          console.error('Failed to create ImageBitmap from optimized tile:', error);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Extract tile from legacy blob (fallback path)
   */
  private async extractTileFromLegacyBlob(
    layerId: string,
    tileKey: string,
    layer: LayerMetadata
  ): Promise<ImageBitmap | null> {
    // Get legacy blob
    const legacyData = await this.getLegacyBlob(layerId);

    if (!legacyData) {
      return null;
    }

    // Create ImageBitmap from blob
    const bitmap = await createImageBitmap(legacyData.blob);

    try {
      // Parse tile key: "TLX,TLY,PxX,PxY"
      const [tlx, tly, pxx, pxy] = tileKey.split(',').map(Number);

      // Calculate offset in source image
      const offsetX = (tlx - layer.coords.TLX) * 1000 + (pxx - layer.coords.PxX);
      const offsetY = (tly - layer.coords.TLY) * 1000 + (pxy - layer.coords.PxY);

      // Calculate tile size
      const width = Math.min(1000 - pxx, bitmap.width - offsetX);
      const height = Math.min(1000 - pxy, bitmap.height - offsetY);

      if (width <= 0 || height <= 0) {
        bitmap.close();
        return null;
      }

      // Extract tile using OffscreenCanvas
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        bitmap.close();
        return null;
      }

      ctx.drawImage(bitmap, offsetX, offsetY, width, height, 0, 0, width, height);

      const tileBitmap = await createImageBitmap(canvas);

      return tileBitmap;
    } finally {
      bitmap.close();
    }
  }

  /**
   * Get legacy blob
   */
  private async getLegacyBlob(layerId: string): Promise<LegacyBlobData | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LEGACY_BLOBS], 'readonly');
      const store = tx.objectStore(STORES.LEGACY_BLOBS);
      const request = store.get(layerId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save legacy blob
   */
  private async saveLegacyBlob(data: LegacyBlobData): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LEGACY_BLOBS], 'readwrite');
      const store = tx.objectStore(STORES.LEGACY_BLOBS);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Request Worker migration for a layer
   */
  private requestMigration(layerId: string, layer: LayerMetadata): void {
    if (!this.worker) {
      console.warn('🧑‍🎨 : Worker not set, skipping migration request');
      return;
    }

    this.migrationQueue.add(layerId);

    this.worker.postMessage({
      type: 'MIGRATE_REQUEST',
      data: {
        layerId,
        priority: 1, // Default: low priority (background)
        coords: layer.coords,
        bounds: layer.bounds
      }
    });

    console.log(`🧑‍🎨 : Requested migration for ${layerId}`);
  }

  /**
   * Add tile to memory cache (with LRU eviction)
   */
  private addToCache(key: string, bitmap: ImageBitmap): void {
    // If cache is full, remove oldest entry
    if (this.tileCache.size >= this.maxCacheSize) {
      const oldestKey = this.tileCache.keys().next().value;
      const oldBitmap = this.tileCache.get(oldestKey)!;
      oldBitmap.close();
      this.tileCache.delete(oldestKey);
    }

    this.tileCache.set(key, bitmap);
  }

  /**
   * Clear cache for a specific layer
   */
  private clearCacheForLayer(layerId: string): void {
    for (const [key, bitmap] of this.tileCache.entries()) {
      if (key.startsWith(`${layerId}:`)) {
        bitmap.close();
        this.tileCache.delete(key);
      }
    }
  }

  /**
   * Delete layer metadata
   */
  private async deleteLayerMetadata(layerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LAYERS], 'readwrite');
      const store = tx.objectStore(STORES.LAYERS);
      const request = store.delete(layerId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete legacy blob
   */
  private async deleteLegacyBlob(layerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LEGACY_BLOBS], 'readwrite');
      const store = tx.objectStore(STORES.LEGACY_BLOBS);
      const request = store.delete(layerId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete all optimized tiles for a layer
   */
  private async deleteOptimizedTiles(layerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.OPTIMIZED_TILES], 'readwrite');
      const store = tx.objectStore(STORES.OPTIMIZED_TILES);
      const index = store.index('layerId');
      const request = index.openCursor(IDBKeyRange.only(layerId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete statistics for a layer
   */
  private async deleteStatistics(layerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.STATISTICS], 'readwrite');
      const store = tx.objectStore(STORES.STATISTICS);
      const request = store.delete(layerId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
