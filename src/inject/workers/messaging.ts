/**
 * Type-safe messaging helper for Worker communication
 * Phase 1.3: Communication Protocol
 */

// Worker request types
export interface MigrateRequestData {
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

export type WorkerRequest =
  | { type: 'MIGRATE_REQUEST'; data: MigrateRequestData }
  | { type: 'CANCEL_MIGRATION'; data: { layerId: string } };

// Worker response types
export interface MigrationCompleteResponse {
  type: 'MIGRATION_COMPLETE';
  layerId: string;
  success: boolean;
  error?: string;
  stats?: {
    tileCount: number;
    processingTime: number;
  };
}

export interface MigrationProgressResponse {
  type: 'MIGRATION_PROGRESS';
  layerId: string;
  progress: number; // 0-100
  currentTile: string;
}

export type WorkerResponse = MigrationCompleteResponse | MigrationProgressResponse;

/**
 * Type-safe Worker messenger
 */
export class WorkerMessenger {
  private worker: Worker;
  private listeners: Map<string, Set<(data: WorkerResponse) => void>> = new Map();

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Send a request to the worker
   */
  send(request: WorkerRequest): void {
    this.worker.postMessage(request);
    console.log('🧑‍🎨 : [Worker →]', request.type, request.data);
  }

  /**
   * Wait for a specific response type from the worker
   */
  async waitFor<T extends WorkerResponse['type']>(
    type: T,
    timeout = 30000
  ): Promise<Extract<WorkerResponse, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(type, handler);
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeout);

      const handler = (data: WorkerResponse) => {
        if (data.type === type) {
          clearTimeout(timer);
          this.off(type, handler);
          resolve(data as Extract<WorkerResponse, { type: T }>);
        }
      };

      this.on(type, handler);
    });
  }

  /**
   * Wait for a specific layer's migration to complete
   */
  async waitForMigrationComplete(
    layerId: string,
    timeout = 60000
  ): Promise<MigrationCompleteResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('MIGRATION_COMPLETE', handler);
        reject(new Error(`Timeout waiting for migration of ${layerId}`));
      }, timeout);

      const handler = (data: WorkerResponse) => {
        if (data.type === 'MIGRATION_COMPLETE' && data.layerId === layerId) {
          clearTimeout(timer);
          this.off('MIGRATION_COMPLETE', handler);
          resolve(data);
        }
      };

      this.on('MIGRATION_COMPLETE', handler);
    });
  }

  /**
   * Add a listener for a specific message type
   */
  on(type: string, handler: (data: WorkerResponse) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(handler);
  }

  /**
   * Remove a listener for a specific message type
   */
  off(type: string, handler: (data: WorkerResponse) => void): void {
    const listeners = this.listeners.get(type);

    if (listeners) {
      listeners.delete(handler);
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Terminate the worker and clean up
   */
  terminate(): void {
    this.removeAllListeners();
    this.worker.terminate();
  }

  /**
   * Handle messages from worker
   */
  private handleMessage(event: MessageEvent): void {
    const response: WorkerResponse = event.data;

    console.log('🧑‍🎨 : [Worker ←]', response.type, response);

    const listeners = this.listeners.get(response.type);

    if (listeners) {
      for (const listener of listeners) {
        listener(response);
      }
    }
  }
}

/**
 * Create a migration worker instance using Blob URL
 * This works in inject context without requiring chrome.runtime.getURL
 */
export const createMigrationWorker = (): Worker => {
  // Inline worker code as a string
  // This avoids the need for chrome.runtime.getURL which is unavailable in inject context
  const workerCode = `
// Migration Worker - Inline version
// This is the same code as migration.worker.ts but bundled inline

const DB_NAME = 'mr-wplace-v2';
const DB_VERSION = 1;
const STORES = {
  LAYERS: 'layers',
  LEGACY_BLOBS: 'legacy_blobs',
  OPTIMIZED_TILES: 'optimized_tiles',
  STATISTICS: 'statistics'
};

class MigrationWorker {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.db = null;
  }

  async init() {
    console.log('🧑‍🎨 : [Worker] Initializing migration worker');
    try {
      this.db = await this.openDatabase();
      console.log('🧑‍🎨 : [Worker] IndexedDB opened successfully');
    } catch (error) {
      console.error('🧑‍🎨 : [Worker] Failed to open IndexedDB:', error);
      throw error;
    }
  }

  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORES.LAYERS)) {
          const layersStore = db.createObjectStore(STORES.LAYERS, { keyPath: 'id' });
          layersStore.createIndex('type', 'type', { unique: false });
          layersStore.createIndex('visible', 'visible', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.LEGACY_BLOBS)) {
          db.createObjectStore(STORES.LEGACY_BLOBS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.OPTIMIZED_TILES)) {
          const tilesStore = db.createObjectStore(STORES.OPTIMIZED_TILES, {
            keyPath: ['layerId', 'tileKey']
          });
          tilesStore.createIndex('layerId', 'layerId', { unique: false });
          tilesStore.createIndex('tileKey', 'tileKey', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.STATISTICS)) {
          db.createObjectStore(STORES.STATISTICS, { keyPath: 'layerId' });
        }
      };
    });
  }

  enqueue(task) {
    if (this.queue.some(t => t.layerId === task.layerId)) {
      console.log(\`🧑‍🎨 : [Worker] Task \${task.layerId} already in queue, skipping\`);
      return;
    }
    this.queue.push(task);
    this.queue.sort((a, b) => a.priority - b.priority);
    console.log(\`🧑‍🎨 : [Worker] Task \${task.layerId} added to queue (priority: \${task.priority})\`);
    this.processQueue();
  }

  cancel(layerId) {
    const index = this.queue.findIndex(t => t.layerId === layerId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(\`🧑‍🎨 : [Worker] Task \${layerId} cancelled\`);
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      const startTime = performance.now();

      try {
        console.log(\`🧑‍🎨 : [Worker] Processing \${task.layerId}\`);
        const tileCount = await this.migrateLayer(task);
        const processingTime = performance.now() - startTime;

        self.postMessage({
          type: 'MIGRATION_COMPLETE',
          layerId: task.layerId,
          success: true,
          stats: { tileCount, processingTime }
        });

        console.log(\`🧑‍🎨 : [Worker] Completed \${task.layerId} (\${tileCount} tiles, \${processingTime.toFixed(0)}ms)\`);
      } catch (error) {
        console.error(\`🧑‍🎨 : [Worker] Failed to migrate \${task.layerId}:\`, error);
        self.postMessage({
          type: 'MIGRATION_COMPLETE',
          layerId: task.layerId,
          success: false,
          error: error.message
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  async migrateLayer(task) {
    if (!this.db) throw new Error('Database not initialized');

    const legacyData = await this.getLegacyBlob(task.layerId);
    if (!legacyData) throw new Error(\`Legacy data not found for \${task.layerId}\`);

    const bitmap = await createImageBitmap(legacyData.blob);
    try {
      const tiles = await this.splitImageOnTiles(bitmap, task.coords, legacyData.width, legacyData.height);
      await this.saveOptimizedTiles(task.layerId, tiles);
      await this.updateLayerMetadata(task.layerId, { isOptimized: true });

      for (const tileBitmap of Object.values(tiles)) {
        tileBitmap.close();
      }

      return Object.keys(tiles).length;
    } finally {
      bitmap.close();
    }
  }

  async getLegacyBlob(layerId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LEGACY_BLOBS], 'readonly');
      const store = tx.objectStore(STORES.LEGACY_BLOBS);
      const request = store.get(layerId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async splitImageOnTiles(source, coords, width, height) {
    const tileSize = 1000;
    const tiles = {};

    for (let py = coords.PxY; py < height + coords.PxY; ) {
      const drawH = Math.min(tileSize - (py % tileSize), height - (py - coords.PxY));

      for (let px = coords.PxX; px < width + coords.PxX; ) {
        const drawW = Math.min(tileSize - (px % tileSize), width - (px - coords.PxX));

        const canvas = new OffscreenCanvas(drawW, drawH);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

        ctx.drawImage(source, px - coords.PxX, py - coords.PxY, drawW, drawH, 0, 0, drawW, drawH);

        const imageData = ctx.getImageData(0, 0, drawW, drawH);
        if (this.hasVisibleContent(imageData)) {
          const tileBitmap = await createImageBitmap(canvas);
          const tx = coords.TLX + Math.floor(px / 1000);
          const ty = coords.TLY + Math.floor(py / 1000);
          const tileKey = \`\${tx.toString().padStart(4, '0')},\${ty.toString().padStart(4, '0')},\${(px % 1000).toString().padStart(3, '0')},\${(py % 1000).toString().padStart(3, '0')}\`;
          tiles[tileKey] = tileBitmap;
        }

        px += drawW;
      }
      py += drawH;
    }

    return tiles;
  }

  hasVisibleContent(imageData) {
    const data = imageData.data;
    const threshold = 10;
    let visiblePixels = 0;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        visiblePixels++;
        if (visiblePixels >= threshold) return true;
      }
    }

    return false;
  }

  async saveOptimizedTiles(layerId, tiles) {
    const savedTiles = [];

    try {
      for (const [tileKey, bitmap] of Object.entries(tiles)) {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

        ctx.drawImage(bitmap, 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        await this.saveSingleTile(layerId, tileKey, blob, bitmap.width, bitmap.height);
        savedTiles.push(tileKey);
      }
    } catch (error) {
      console.error(\`🧑‍🎨 : [Worker] Failed to save tiles, rolling back\`, error);
      for (const tileKey of savedTiles) {
        await this.deleteSingleTile(layerId, tileKey);
      }
      throw error;
    }
  }

  async saveSingleTile(layerId, tileKey, blob, width, height) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.OPTIMIZED_TILES], 'readwrite');
      const store = tx.objectStore(STORES.OPTIMIZED_TILES);
      const data = { layerId, tileKey, blob, width, height, timestamp: Date.now() };
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSingleTile(layerId, tileKey) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.OPTIMIZED_TILES], 'readwrite');
      const store = tx.objectStore(STORES.OPTIMIZED_TILES);
      const request = store.delete([layerId, tileKey]);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateLayerMetadata(layerId, updates) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LAYERS], 'readwrite');
      const store = tx.objectStore(STORES.LAYERS);
      const getRequest = store.get(layerId);

      getRequest.onsuccess = () => {
        const layer = getRequest.result;
        if (!layer) {
          reject(new Error(\`Layer \${layerId} not found\`));
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

// Worker instance
const worker = new MigrationWorker();

// Message handler
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'MIGRATE_REQUEST':
        if (!worker.db) {
          await worker.init();
        }
        worker.enqueue({
          layerId: data.layerId,
          priority: data.priority,
          coords: data.coords,
          bounds: data.bounds
        });
        break;

      case 'CANCEL_MIGRATION':
        worker.cancel(data.layerId);
        break;

      default:
        console.warn(\`🧑‍🎨 : [Worker] Unknown message type: \${type}\`);
    }
  } catch (error) {
    console.error('🧑‍🎨 : [Worker] Error handling message:', error);
  }
});

console.log('🧑‍🎨 : [Worker] Migration worker loaded');
`;

  // Create Blob URL from inline code
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);

  console.log('🧑‍🎨 : Migration worker created (inline Blob)');

  return worker;
};
