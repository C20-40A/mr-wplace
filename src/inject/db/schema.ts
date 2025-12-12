/**
 * IndexedDB Schema and Data Models
 * Phase 2.1: IndexedDB Schema
 *
 * This file defines the data model for the migration architecture.
 * The design follows "Unified Layer & Progressive Migration" pattern.
 */

// Database configuration
export const DB_NAME = "mr-wplace-gallery";
export const DB_VERSION = 1;

// Object store names
export const STORES = {
  LAYERS: "layers",
  LEGACY_BLOBS: "legacy_blobs",
  OPTIMIZED_TILES: "optimized_tiles",
  STATISTICS: "statistics",
} as const;

/**
 * Layer Metadata (Object Store: "layers")
 *
 * Stores lightweight metadata for all layers (Gallery, Text, Snapshot).
 * This is loaded quickly on startup.
 */
export interface LayerMetadata {
  // Identifier
  id: string; // "gallery_<timestamp>" | "text_<timestamp>" | "snapshot_<timestamp>_<x>_<y>"
  type: "gallery" | "text" | "snapshot";

  // Display settings
  visible: boolean; // On/Off
  zIndex: number; // Layer order
  opacity: number; // 0-1

  // Coordinates and bounds
  coords?: {
    TLX: number; // Tile X coordinate
    TLY: number; // Tile Y coordinate
    PxX: number; // Pixel X offset
    PxY: number; // Pixel Y offset
  };
  bounds?: {
    top: number; // Min tile Y
    left: number; // Min tile X
    right: number; // Max tile X
    bottom: number; // Max tile Y
  };

  // State management (Phase 4: unified to single flag)
  // Phase 4: Simplified from 4 states (A/B/C/D) to 2 states (raw/final)
  // - false (raw): IndexedDB legacy_blob available, not optimized
  // - true (final): IndexedDB optimized_tiles available, optimized
  isOptimized: boolean;

  // Metadata
  title?: string; // User-set title
  timestamp: number; // Creation time

  // Gallery-specific fields
  layerOrder?: number; // Gallery layer order

  // Text-specific fields
  text?: string; // Text content
  font?: string; // Font name

  // Snapshot-specific fields
  snapshotName?: string; // Snapshot name
}

/**
 * Legacy Blob Data (Object Store: "legacy_blobs")
 *
 * Stores raw image data (Blob) before optimization.
 * Used for fallback when optimized tiles are not available (State A).
 */
export interface LegacyBlobData {
  id: string; // Same as LayerMetadata.id
  blob: Blob; // Raw image data (PNG/JPEG)
  width: number; // Image width
  height: number; // Image height
  timestamp: number; // Save time
}

/**
 * Optimized Tile Data (Object Store: "optimized_tiles")
 *
 * Stores pre-split tiles (1000x1000 PNG blobs).
 * Used for fast tile rendering (State B).
 */
export interface OptimizedTileData {
  layerId: string; // LayerMetadata.id
  tileKey: string; // "0123,0456,123,456" (TLX,TLY,PxX,PxY)
  blob: Blob; // Split tile image (PNG)
  width: number; // Tile width (usually <= 1000)
  height: number; // Tile height (usually <= 1000)
  timestamp: number; // Optimization time
}

/**
 * Layer Statistics (Object Store: "statistics")
 *
 * Stores color statistics for each layer.
 */
export interface LayerStatistics {
  layerId: string; // LayerMetadata.id
  perTileStats: Record<
    string,
    {
      matched: Record<string, number>; // Colors matched with background
      total: Record<string, number>; // Total colors
    }
  >;
  lastUpdated: number; // Last update time
}

/**
 * Open the IndexedDB database
 *
 * This function creates the database and object stores if they don't exist.
 * It can be called from both main thread and worker context.
 */
export const openDatabase = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log("🧑‍🎨 : IndexedDB opened successfully");
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      console.log("🧑‍🎨 : IndexedDB upgrade needed, creating schema");

      // Create "layers" store
      if (!db.objectStoreNames.contains(STORES.LAYERS)) {
        const layersStore = db.createObjectStore(STORES.LAYERS, {
          keyPath: "id",
        });
        layersStore.createIndex("type", "type", { unique: false });
        layersStore.createIndex("visible", "visible", { unique: false });
        console.log('🧑‍🎨 : Created "layers" store');
      }

      // Create "legacy_blobs" store
      if (!db.objectStoreNames.contains(STORES.LEGACY_BLOBS)) {
        db.createObjectStore(STORES.LEGACY_BLOBS, { keyPath: "id" });
        console.log('🧑‍🎨 : Created "legacy_blobs" store');
      }

      // Create "optimized_tiles" store
      if (!db.objectStoreNames.contains(STORES.OPTIMIZED_TILES)) {
        const tilesStore = db.createObjectStore(STORES.OPTIMIZED_TILES, {
          keyPath: ["layerId", "tileKey"],
        });
        tilesStore.createIndex("layerId", "layerId", { unique: false });
        tilesStore.createIndex("tileKey", "tileKey", { unique: false });
        console.log('🧑‍🎨 : Created "optimized_tiles" store');
      }

      // Create "statistics" store
      if (!db.objectStoreNames.contains(STORES.STATISTICS)) {
        db.createObjectStore(STORES.STATISTICS, { keyPath: "layerId" });
        console.log('🧑‍🎨 : Created "statistics" store');
      }

      console.log("🧑‍🎨 : IndexedDB schema created successfully");
    };
  });
};

/**
 * Delete the IndexedDB database (for testing or rollback)
 */
export const deleteDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      console.log("🧑‍🎨 : IndexedDB deleted successfully");
      resolve();
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn("🧑‍🎨 : IndexedDB deletion blocked, please close all tabs");
    };
  });
};

/**
 * Check if IndexedDB is available
 */
export const isIndexedDBAvailable = (): boolean => {
  try {
    return typeof indexedDB !== "undefined";
  } catch (error) {
    return false;
  }
};

/**
 * Check storage quota and usage
 */
export const checkStorageQuota = async (): Promise<{
  available: number;
  used: number;
  quota: number;
  percentage: number;
}> => {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;

    return {
      available: quota - usage,
      used: usage,
      quota,
      percentage: quota > 0 ? (usage / quota) * 100 : 0,
    };
  }

  // Fallback: assume 100MB available
  return {
    available: 100 * 1024 * 1024,
    used: 0,
    quota: 100 * 1024 * 1024,
    percentage: 0,
  };
};

/**
 * Calculate estimated size for migration
 */
export const estimateMigrationSize = async (
  layerCount: number,
  avgLayerSizeKB: number = 500
): Promise<number> => {
  // Estimate: each layer takes ~avgLayerSizeKB KB
  // Plus metadata overhead (~10%)
  const totalSize = layerCount * avgLayerSizeKB * 1024 * 1.1;

  return totalSize;
};
