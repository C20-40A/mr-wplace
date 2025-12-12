/**
 * Gallery Repository
 *
 * 統合リポジトリ: images, tiles, metadata, thumbnails の CRUD 操作
 */

import {
  openDatabaseV2,
  STORES_V2,
  calculateAffectedTiles,
  type GalleryMetadata,
  type ImageRecord,
  type TileRecord,
  type ThumbnailRecord,
} from "./schema-v2";

const TILE_SIZE = 1000;

export class GalleryRepository {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize database connection
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.db = await openDatabaseV2();
    })();

    return this.initPromise;
  }

  private getDb(): IDBDatabase {
    if (!this.db) throw new Error("Database not initialized");
    return this.db;
  }

  // ============================================
  // Metadata Operations
  // ============================================

  async getMetadata(id: string): Promise<GalleryMetadata | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.METADATA], "readonly");
      const store = tx.objectStore(STORES_V2.METADATA);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMetadata(): Promise<GalleryMetadata[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.METADATA], "readonly");
      const store = tx.objectStore(STORES_V2.METADATA);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getVisibleMetadata(): Promise<GalleryMetadata[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.METADATA], "readonly");
      const store = tx.objectStore(STORES_V2.METADATA);
      const index = store.index("visible");
      const request = index.getAll(IDBKeyRange.only(true));

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetadata(metadata: GalleryMetadata): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.METADATA], "readwrite");
      const store = tx.objectStore(STORES_V2.METADATA);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMetadata(id: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.METADATA], "readwrite");
      const store = tx.objectStore(STORES_V2.METADATA);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Image Operations (Full-size)
  // ============================================

  async getImage(id: string): Promise<Blob | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.IMAGES], "readonly");
      const store = tx.objectStore(STORES_V2.IMAGES);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as ImageRecord | undefined;
        resolve(record?.blob || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveImage(id: string, blob: Blob): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.IMAGES], "readwrite");
      const store = tx.objectStore(STORES_V2.IMAGES);
      const request = store.put({ id, blob } as ImageRecord);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteImage(id: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.IMAGES], "readwrite");
      const store = tx.objectStore(STORES_V2.IMAGES);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Thumbnail Operations
  // ============================================

  async getThumbnail(id: string): Promise<Blob | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.THUMBNAILS], "readonly");
      const store = tx.objectStore(STORES_V2.THUMBNAILS);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as ThumbnailRecord | undefined;
        resolve(record?.blob || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveThumbnail(id: string, blob: Blob): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.THUMBNAILS], "readwrite");
      const store = tx.objectStore(STORES_V2.THUMBNAILS);
      const request = store.put({ id, blob } as ThumbnailRecord);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteThumbnail(id: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.THUMBNAILS], "readwrite");
      const store = tx.objectStore(STORES_V2.THUMBNAILS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Tile Operations
  // ============================================

  async getTile(layerId: string, tileKey: string): Promise<Blob | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.SPLIT_TILES], "readonly");
      const store = tx.objectStore(STORES_V2.SPLIT_TILES);
      const request = store.get([layerId, tileKey]);

      request.onsuccess = () => {
        const record = request.result as TileRecord | undefined;
        resolve(record?.blob || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTilesForLayer(layerId: string): Promise<Map<string, Blob>> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.SPLIT_TILES], "readonly");
      const store = tx.objectStore(STORES_V2.SPLIT_TILES);
      const index = store.index("layerId");
      const request = index.getAll(IDBKeyRange.only(layerId));

      request.onsuccess = () => {
        const records = request.result as TileRecord[];
        const map = new Map<string, Blob>();
        for (const record of records) {
          map.set(record.tileKey, record.blob);
        }
        resolve(map);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveTile(layerId: string, tileKey: string, blob: Blob): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.SPLIT_TILES], "readwrite");
      const store = tx.objectStore(STORES_V2.SPLIT_TILES);
      const request = store.put({ layerId, tileKey, blob } as TileRecord);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTilesForLayer(layerId: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES_V2.SPLIT_TILES], "readwrite");
      const store = tx.objectStore(STORES_V2.SPLIT_TILES);
      const index = store.index("layerId");
      const request = index.openCursor(IDBKeyRange.only(layerId));

      request.onsuccess = () => {
        const cursor = request.result;
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

  // ============================================
  // Combined Operations
  // ============================================

  /**
   * Save complete gallery item (image + thumbnail + metadata + tiles)
   */
  async saveGalleryItem(
    id: string,
    imageBlob: Blob,
    metadata: Omit<GalleryMetadata, "id" | "width" | "height" | "affectedTiles">,
    options?: { skipTileSplit?: boolean }
  ): Promise<GalleryMetadata> {
    console.log(`🧑‍🎨 [GalleryRepository] saveGalleryItem start: ${id}`);

    // Get image dimensions
    const bitmap = await createImageBitmap(imageBlob);
    const width = bitmap.width;
    const height = bitmap.height;
    console.log(`🧑‍🎨 [GalleryRepository] dimensions: ${width}x${height}`);

    // Calculate affected tiles if coords exist
    const affectedTiles = metadata.coords
      ? calculateAffectedTiles(metadata.coords, width, height)
      : [];
    console.log(`🧑‍🎨 [GalleryRepository] affectedTiles: ${affectedTiles.length}`);

    const fullMetadata: GalleryMetadata = {
      ...metadata,
      id,
      width,
      height,
      affectedTiles,
    };

    // Save image blob
    await this.saveImage(id, imageBlob);
    console.log(`🧑‍🎨 [GalleryRepository] saved image`);

    // Generate and save thumbnail
    const thumbnailBlob = await this.generateThumbnail(bitmap);
    await this.saveThumbnail(id, thumbnailBlob);
    console.log(`🧑‍🎨 [GalleryRepository] saved thumbnail`);

    // Save metadata
    await this.saveMetadata(fullMetadata);
    console.log(`🧑‍🎨 [GalleryRepository] saved metadata`);

    // Split and save tiles (if coords exist and not skipped)
    if (metadata.coords && !options?.skipTileSplit) {
      await this.splitAndSaveTiles(id, bitmap, metadata.coords);
      console.log(`🧑‍🎨 [GalleryRepository] saved tiles`);
    }

    bitmap.close();
    console.log(`🧑‍🎨 [GalleryRepository] saveGalleryItem complete: ${id}`);

    return fullMetadata;
  }

  /**
   * Delete complete gallery item (all stores)
   */
  async deleteGalleryItem(id: string): Promise<void> {
    await Promise.all([
      this.deleteImage(id),
      this.deleteThumbnail(id),
      this.deleteMetadata(id),
      this.deleteTilesForLayer(id),
    ]);
  }

  /**
   * Generate 128x128 thumbnail
   */
  private async generateThumbnail(bitmap: ImageBitmap): Promise<Blob> {
    const MAX_SIZE = 128;
    const scale = Math.min(MAX_SIZE / bitmap.width, MAX_SIZE / bitmap.height, 1);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);

    return canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
  }

  /**
   * Split image into tiles and save
   */
  private async splitAndSaveTiles(
    layerId: string,
    bitmap: ImageBitmap,
    coords: { TLX: number; TLY: number; PxX: number; PxY: number }
  ): Promise<void> {
    const affectedTiles = calculateAffectedTiles(coords, bitmap.width, bitmap.height);

    for (const tileKey of affectedTiles) {
      const [tlx, tly] = tileKey.split(",").map(Number);

      const tileStartGlobalX = tlx * TILE_SIZE;
      const tileStartGlobalY = tly * TILE_SIZE;
      const imageStartGlobalX = coords.TLX * TILE_SIZE + coords.PxX;
      const imageStartGlobalY = coords.TLY * TILE_SIZE + coords.PxY;

      const srcX = Math.max(0, tileStartGlobalX - imageStartGlobalX);
      const srcY = Math.max(0, tileStartGlobalY - imageStartGlobalY);
      const dstX = Math.max(0, imageStartGlobalX - tileStartGlobalX);
      const dstY = Math.max(0, imageStartGlobalY - tileStartGlobalY);

      const copyWidth = Math.min(bitmap.width - srcX, TILE_SIZE - dstX);
      const copyHeight = Math.min(bitmap.height - srcY, TILE_SIZE - dstY);

      if (copyWidth <= 0 || copyHeight <= 0) continue;

      const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, srcX, srcY, copyWidth, copyHeight, dstX, dstY, copyWidth, copyHeight);

      const tileBlob = await canvas.convertToBlob({ type: "image/png" });
      await this.saveTile(layerId, tileKey, tileBlob);
    }
  }

  /**
   * Update tiles for a layer (when coords change)
   */
  async updateTiles(
    id: string,
    coords: { TLX: number; TLY: number; PxX: number; PxY: number }
  ): Promise<string[]> {
    // Delete existing tiles
    await this.deleteTilesForLayer(id);

    // Get image and regenerate tiles
    const imageBlob = await this.getImage(id);
    if (!imageBlob) throw new Error(`Image not found: ${id}`);

    const bitmap = await createImageBitmap(imageBlob);
    const affectedTiles = calculateAffectedTiles(coords, bitmap.width, bitmap.height);

    await this.splitAndSaveTiles(id, bitmap, coords);
    bitmap.close();

    // Update metadata
    const metadata = await this.getMetadata(id);
    if (metadata) {
      metadata.coords = coords;
      metadata.affectedTiles = affectedTiles;
      await this.saveMetadata(metadata);
    }

    return affectedTiles;
  }

  /**
   * Check if a tile key is affected by any visible layer
   */
  async isAffectedTile(tileKey: string): Promise<boolean> {
    const visibleLayers = await this.getVisibleMetadata();
    return visibleLayers.some((layer) => layer.affectedTiles.includes(tileKey));
  }

  /**
   * Get layers that affect a specific tile
   */
  async getLayersForTile(tileKey: string): Promise<GalleryMetadata[]> {
    const visibleLayers = await this.getVisibleMetadata();
    return visibleLayers
      .filter((layer) => layer.affectedTiles.includes(tileKey))
      .sort((a, b) => a.zIndex - b.zIndex);
  }
}

// Singleton instance
let repositoryInstance: GalleryRepository | null = null;

export const getGalleryRepository = (): GalleryRepository => {
  if (!repositoryInstance) {
    repositoryInstance = new GalleryRepository();
  }
  return repositoryInstance;
};

export const initGalleryRepository = async (): Promise<GalleryRepository> => {
  const repo = getGalleryRepository();
  await repo.init();
  return repo;
};
