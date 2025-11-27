/**
 * Migration Worker - Phase 1: Worker Infrastructure
 *
 * This worker handles heavy image processing tasks in a separate thread:
 * - Splits images into 1000x1000 tiles
 * - Saves tiles to IndexedDB
 * - Manages memory (ImageBitmap cleanup)
 * - Processes tasks serially (one at a time) to avoid memory issues
 */

// Types for worker messages
interface MigrateRequestData {
  layerId: string;
  priority: 0 | 1; // 0 = high priority (visible), 1 = low priority (background)
  coords: {
    TLX: number;
    TLY: number;
    PxX: number;
    PxY: number;
  };
  bounds: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

interface WorkerRequest {
  type: 'MIGRATE_REQUEST' | 'CANCEL_MIGRATION';
  data: MigrateRequestData | { layerId: string };
}

interface MigrationCompleteResponse {
  type: 'MIGRATION_COMPLETE';
  layerId: string;
  success: boolean;
  error?: string;
  stats?: {
    tileCount: number;
    processingTime: number;
  };
}

interface MigrationProgressResponse {
  type: 'MIGRATION_PROGRESS';
  layerId: string;
  progress: number; // 0-100
  currentTile: string;
}

type WorkerResponse = MigrationCompleteResponse | MigrationProgressResponse;

// Task queue management
interface MigrationTask {
  layerId: string;
  priority: number;
  coords: MigrateRequestData['coords'];
  bounds: MigrateRequestData['bounds'];
}

class MigrationWorker {
  private queue: MigrationTask[] = [];
  private isProcessing = false;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    console.log('🧑‍🎨 : [Worker] Initializing migration worker');

    try {
      this.db = await this.openDatabase();
      console.log('🧑‍🎨 : [Worker] IndexedDB opened successfully');
    } catch (error) {
      console.error('🧑‍🎨 : [Worker] Failed to open IndexedDB:', error);
      throw error;
    }
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('mr-wplace-v2', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('layers')) {
          const layersStore = db.createObjectStore('layers', { keyPath: 'id' });
          layersStore.createIndex('type', 'type', { unique: false });
          layersStore.createIndex('visible', 'visible', { unique: false });
        }

        if (!db.objectStoreNames.contains('legacy_blobs')) {
          db.createObjectStore('legacy_blobs', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('optimized_tiles')) {
          const tilesStore = db.createObjectStore('optimized_tiles', {
            keyPath: ['layerId', 'tileKey']
          });
          tilesStore.createIndex('layerId', 'layerId', { unique: false });
          tilesStore.createIndex('tileKey', 'tileKey', { unique: false });
        }

        if (!db.objectStoreNames.contains('statistics')) {
          db.createObjectStore('statistics', { keyPath: 'layerId' });
        }

        console.log('🧑‍🎨 : [Worker] IndexedDB schema created');
      };
    });
  }

  enqueue(task: MigrationTask): void {
    // Check if task already exists
    if (this.queue.some(t => t.layerId === task.layerId)) {
      console.log(`🧑‍🎨 : [Worker] Task ${task.layerId} already in queue, skipping`);
      return;
    }

    this.queue.push(task);

    // Sort by priority (0 = high, 1 = low)
    this.queue.sort((a, b) => a.priority - b.priority);

    console.log(`🧑‍🎨 : [Worker] Task ${task.layerId} added to queue (priority: ${task.priority})`);

    this.processQueue();
  }

  cancel(layerId: string): void {
    const index = this.queue.findIndex(t => t.layerId === layerId);

    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`🧑‍🎨 : [Worker] Task ${layerId} cancelled`);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      const startTime = performance.now();

      try {
        console.log(`🧑‍🎨 : [Worker] Processing ${task.layerId}`);

        const tileCount = await this.migrateLayer(task);
        const processingTime = performance.now() - startTime;

        // Send success response
        const response: MigrationCompleteResponse = {
          type: 'MIGRATION_COMPLETE',
          layerId: task.layerId,
          success: true,
          stats: {
            tileCount,
            processingTime
          }
        };

        self.postMessage(response);

        console.log(`🧑‍🎨 : [Worker] Completed ${task.layerId} (${tileCount} tiles, ${processingTime.toFixed(0)}ms)`);
      } catch (error) {
        console.error(`🧑‍🎨 : [Worker] Failed to migrate ${task.layerId}:`, error);

        // Send error response
        const response: MigrationCompleteResponse = {
          type: 'MIGRATION_COMPLETE',
          layerId: task.layerId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };

        self.postMessage(response);
      }

      // Wait to allow GC (longer for low priority tasks)
      const delay = task.priority === 0 ? 100 : 500; // High: 100ms, Low: 500ms
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.isProcessing = false;
  }

  private async migrateLayer(task: MigrationTask): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // 1. Get legacy blob from IndexedDB
    const legacyData = await this.getLegacyBlob(task.layerId);

    if (!legacyData) {
      throw new Error(`Legacy data not found for ${task.layerId}`);
    }

    // 2. Create ImageBitmap from blob
    const bitmap = await createImageBitmap(legacyData.blob);

    try {
      // 3. Split image into tiles
      const tiles = await this.splitImageOnTiles(
        bitmap,
        task.coords,
        legacyData.width,
        legacyData.height
      );

      // 4. Save tiles to IndexedDB
      await this.saveOptimizedTiles(task.layerId, tiles);

      // 5. Update layer metadata (isOptimized = true)
      await this.updateLayerMetadata(task.layerId, { isOptimized: true });

      // 6. Close all bitmaps
      for (const tileBitmap of Object.values(tiles)) {
        tileBitmap.close();
      }

      return Object.keys(tiles).length;
    } finally {
      // Always close the source bitmap
      bitmap.close();
    }
  }

  private async getLegacyBlob(layerId: string): Promise<{
    id: string;
    blob: Blob;
    width: number;
    height: number;
    timestamp: number;
  } | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['legacy_blobs'], 'readonly');
      const store = tx.objectStore('legacy_blobs');
      const request = store.get(layerId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Split image into tile-aligned ImageBitmaps
   * Uses OffscreenCanvas for worker context compatibility
   * Based on existing splitImageOnTiles implementation
   */
  private async splitImageOnTiles(
    source: ImageBitmap,
    coords: { TLX: number; TLY: number; PxX: number; PxY: number },
    width: number,
    height: number
  ): Promise<Record<string, ImageBitmap>> {
    const tileSize = 1000;
    const tiles: Record<string, ImageBitmap> = {};

    for (let py = coords.PxY; py < height + coords.PxY; ) {
      const drawH = Math.min(tileSize - (py % tileSize), height - (py - coords.PxY));

      for (let px = coords.PxX; px < width + coords.PxX; ) {
        const drawW = Math.min(tileSize - (px % tileSize), width - (px - coords.PxX));

        // Use OffscreenCanvas in worker context
        const canvas = new OffscreenCanvas(drawW, drawH);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Draw the cropped portion
        ctx.drawImage(
          source,
          px - coords.PxX, // sx
          py - coords.PxY, // sy
          drawW,            // sw
          drawH,            // sh
          0,                // dx
          0,                // dy
          drawW,            // dw
          drawH             // dh
        );

        // Check if tile is mostly transparent (sparse optimization)
        const imageData = ctx.getImageData(0, 0, drawW, drawH);
        const hasContent = this.hasVisibleContent(imageData);

        if (hasContent) {
          // Convert to ImageBitmap
          const tileBitmap = await createImageBitmap(canvas);

          const tx = coords.TLX + Math.floor(px / 1000);
          const ty = coords.TLY + Math.floor(py / 1000);
          const tileKey = `${tx.toString().padStart(4, '0')},${ty
            .toString()
            .padStart(4, '0')},${(px % 1000).toString().padStart(3, '0')},${(
            py % 1000
          )
            .toString()
            .padStart(3, '0')}`;

          tiles[tileKey] = tileBitmap;
        }

        px += drawW;
      }
      py += drawH;
    }

    return tiles;
  }

  /**
   * Check if image data has visible content (not fully transparent)
   */
  private hasVisibleContent(imageData: ImageData): boolean {
    const data = imageData.data;
    const threshold = 10; // Minimum visible pixels

    let visiblePixels = 0;

    // Check alpha channel every 4th byte
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        visiblePixels++;

        if (visiblePixels >= threshold) {
          return true;
        }
      }
    }

    return false;
  }

  private async saveOptimizedTiles(
    layerId: string,
    tiles: Record<string, ImageBitmap>
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const savedTiles: string[] = [];

    try {
      for (const [tileKey, bitmap] of Object.entries(tiles)) {
        // Convert ImageBitmap to Blob
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        ctx.drawImage(bitmap, 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/png' });

        // Save to IndexedDB
        await this.saveSingleTile(layerId, tileKey, blob, bitmap.width, bitmap.height);
        savedTiles.push(tileKey);
      }
    } catch (error) {
      // Rollback: delete all saved tiles
      console.error(`🧑‍🎨 : [Worker] Failed to save tiles, rolling back`, error);

      for (const tileKey of savedTiles) {
        await this.deleteSingleTile(layerId, tileKey);
      }

      throw error;
    }
  }

  private async saveSingleTile(
    layerId: string,
    tileKey: string,
    blob: Blob,
    width: number,
    height: number
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['optimized_tiles'], 'readwrite');
      const store = tx.objectStore('optimized_tiles');

      const data = {
        layerId,
        tileKey,
        blob,
        width,
        height,
        timestamp: Date.now()
      };

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteSingleTile(layerId: string, tileKey: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['optimized_tiles'], 'readwrite');
      const store = tx.objectStore('optimized_tiles');
      const request = store.delete([layerId, tileKey]);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updateLayerMetadata(
    layerId: string,
    updates: { isOptimized: boolean }
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['layers'], 'readwrite');
      const store = tx.objectStore('layers');
      const getRequest = store.get(layerId);

      getRequest.onsuccess = () => {
        const layer = getRequest.result;

        if (!layer) {
          reject(new Error(`Layer ${layerId} not found`));
          return;
        }

        const updated = { ...layer, ...updates };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }
}

// Create worker instance
const worker = new MigrationWorker();

// Message handler
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'MIGRATE_REQUEST': {
        const requestData = data as MigrateRequestData;

        // Initialize database if not already done
        if (!worker['db']) {
          await worker.init();
        }

        worker.enqueue({
          layerId: requestData.layerId,
          priority: requestData.priority,
          coords: requestData.coords,
          bounds: requestData.bounds
        });
        break;
      }

      case 'CANCEL_MIGRATION': {
        const cancelData = data as { layerId: string };
        worker.cancel(cancelData.layerId);
        break;
      }

      default:
        console.warn(`🧑‍🎨 : [Worker] Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('🧑‍🎨 : [Worker] Error handling message:', error);
  }
});

console.log('🧑‍🎨 : [Worker] Migration worker loaded');
