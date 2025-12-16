/**
 * Data Migrator v2
 *
 * Chrome Storage → IndexedDB v2 への完全移行
 * - images: フルサイズ元画像
 * - tiles: タイル分割画像
 * - metadata: メタデータ
 * - thumbnails: サムネイル
 * - snapshots: タイルスナップショット (v3.1.0+)
 */

import type { MigrationProgress } from "./migration-modal";

const MIGRATION_VERSION = "3.1.0";
const MIGRATION_VERSION_KEY = "mr-wplace-migration-version";

/**
 * Convert dataUrl to Blob
 */
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

/**
 * Legacy GalleryItem type (for migration)
 */
interface LegacyGalleryItem {
  key: string;
  timestamp: number;
  dataUrl?: string;
  thumbnail?: string;
  title?: string;
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  layerOrder?: number;
  matchedColorStats?: Record<string, number>;
  totalColorStats?: Record<string, number>;
  perTileColorStats?: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >;
}

/**
 * Get legacy gallery item keys from Chrome Storage (without data to save memory)
 */
const getLegacyItemKeys = async (): Promise<string[]> => {
  const { storage } = await import("@/utils/browser-api");
  const result = await storage.get(null);
  const keys: string[] = [];

  for (const key of Object.keys(result)) {
    if (key.startsWith("gallery_") && !key.endsWith("_index")) {
      keys.push(key);
    }
  }

  return keys;
};

/**
 * Load a single legacy gallery item from Chrome Storage
 */
const loadLegacyItem = async (
  key: string
): Promise<LegacyGalleryItem | null> => {
  const { storage } = await import("@/utils/browser-api");
  const result = await storage.get(key);
  const value = result[key];

  if (!value) return null;

  if (typeof value === "object" && (value as any).key) {
    return value as LegacyGalleryItem;
  } else if (typeof value === "string") {
    // Old format: dataUrl only
    const timestamp = parseInt(key.replace("gallery_", ""));
    return { key, timestamp, dataUrl: value };
  }

  return null;
};

/**
 * Try to get image blob from various sources
 */
const getImageBlob = async (item: LegacyGalleryItem): Promise<Blob | null> => {
  // 1. Try dataUrl in Chrome Storage
  if (item.dataUrl && item.dataUrl !== "") {
    return dataUrlToBlob(item.dataUrl);
  }

  // 2. Try legacy IndexedDB (mr-wplace-gallery)
  const blob = await getLegacyIndexedDBBlob(item.key);
  if (blob) return blob;

  return null;
};

/**
 * Get blob from legacy IndexedDB
 */
const getLegacyIndexedDBBlob = async (key: string): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const request = indexedDB.open("mr-wplace-gallery", 1);

    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("legacy_blobs")) {
        db.close();
        resolve(null);
        return;
      }

      const tx = db.transaction(["legacy_blobs"], "readonly");
      const store = tx.objectStore("legacy_blobs");
      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        db.close();
        const data = getRequest.result;
        resolve(data?.blob || null);
      };
      getRequest.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
};

/**
 * Legacy snapshot key info (without data to save memory)
 */
interface LegacySnapshotKey {
  id: string;
  fullKey: string;
  timestamp: number;
  tileX: number;
  tileY: number;
}

/**
 * Get legacy snapshot keys from Chrome Storage (without data)
 */
const getLegacySnapshotKeys = async (): Promise<LegacySnapshotKey[]> => {
  const { storage } = await import("@/utils/browser-api");
  const result = await storage.get(null);
  const keys: LegacySnapshotKey[] = [];

  for (const key of Object.keys(result)) {
    if (key.startsWith("tile_snapshot_")) {
      const parts = key.split("_");
      if (parts.length >= 5) {
        const timestamp = parseInt(parts[2]);
        const tileX = parseInt(parts[3]);
        const tileY = parseInt(parts[4]);
        const id = key.replace("tile_snapshot_", "");

        keys.push({ id, fullKey: key, timestamp, tileX, tileY });
      }
    }
  }

  return keys;
};

/**
 * Check if migration to v3 is needed
 */
export const needsMigration = async (): Promise<boolean> => {
  const { storage } = await import("@/utils/browser-api");
  const result = await storage.get(MIGRATION_VERSION_KEY);
  const currentVersion = result[MIGRATION_VERSION_KEY];

  if (currentVersion === MIGRATION_VERSION) return false;

  // Check if there are any legacy items to migrate
  const itemKeys = await getLegacyItemKeys();
  const snapshotKeys = await getLegacySnapshotKeys();
  return itemKeys.length > 0 || snapshotKeys.length > 0;
};

/**
 * Get count of items to migrate (for progress display)
 */
export const getMigrationCount = async (): Promise<number> => {
  const itemKeys = await getLegacyItemKeys();
  const snapshotKeys = await getLegacySnapshotKeys();
  return itemKeys.length + snapshotKeys.length;
};

/**
 * Run data migration
 */
export const runDataMigration = async (
  onProgress?: (progress: MigrationProgress) => void
): Promise<{
  migrated: number;
  skipped: number;
  failed: string[];
}> => {
  console.log("🧑‍🎨 [Migration] Starting migration to v3.1.0 (IndexedDB v2 + Snapshots)...");

  const { initGalleryRepository } = await import(
    "@/inject/db/gallery-repository"
  );
  const { initSnapshotRepository } = await import(
    "@/inject/db/snapshot-repository"
  );
  const galleryRepository = await initGalleryRepository();
  const snapshotRepository = await initSnapshotRepository();

  const itemKeys = await getLegacyItemKeys();
  const snapshotKeys = await getLegacySnapshotKeys();
  const total = itemKeys.length + snapshotKeys.length;

  let migrated = 0;
  let skipped = 0;
  const failed: string[] = [];

  // Migrate gallery items (one at a time to avoid memory issues)
  for (let i = 0; i < itemKeys.length; i++) {
    const itemKey = itemKeys[i];

    onProgress?.({
      current: i + 1,
      total,
      currentItem: `Gallery: ${itemKey}`,
    });

    try {
      // Load item data for this key only
      const item = await loadLegacyItem(itemKey);
      if (!item) {
        console.warn(`🧑‍🎨 [Migration] Invalid gallery item ${itemKey}, skipping`);
        skipped++;
        continue;
      }

      // Get image blob
      const blob = await getImageBlob(item);
      if (!blob) {
        console.warn(`🧑‍🎨 [Migration] No image source for ${item.key}, skipping`);
        skipped++;
        continue;
      }

      // Save to new IndexedDB v2
      await galleryRepository.saveGalleryItem(item.key, blob, {
        title: item.title,
        coords: item.drawPosition,
        visible: item.drawEnabled !== false,
        zIndex: item.layerOrder ?? 0,
        timestamp: item.timestamp,
        perTileStats: item.perTileColorStats,
      });

      console.log(`🧑‍🎨 [Migration] Migrated gallery ${item.key}`);
      migrated++;
    } catch (error) {
      console.error(`🧑‍🎨 [Migration] Failed to migrate ${itemKey}:`, error);
      failed.push(itemKey);
    }

    // Small delay to avoid UI freeze
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Migrate snapshots (one at a time to avoid memory issues)
  const { storage } = await import("@/utils/browser-api");
  for (let i = 0; i < snapshotKeys.length; i++) {
    const snapshotKey = snapshotKeys[i];

    onProgress?.({
      current: itemKeys.length + i + 1,
      total,
      currentItem: `Snapshot: ${snapshotKey.id}`,
    });

    try {
      // Load data for this snapshot only
      const result = await storage.get(snapshotKey.fullKey);
      const data = result[snapshotKey.fullKey];
      if (!Array.isArray(data)) {
        console.warn(`🧑‍🎨 [Migration] Invalid snapshot data for ${snapshotKey.id}, skipping`);
        skipped++;
        continue;
      }

      // Convert number array to Blob
      const uint8Array = new Uint8Array(data);
      const blob = new Blob([uint8Array], { type: "image/png" });

      // Save to IndexedDB
      await snapshotRepository.saveSnapshotWithMetadata(snapshotKey.id, blob, {
        id: snapshotKey.id,
        timestamp: snapshotKey.timestamp,
        tileX: snapshotKey.tileX,
        tileY: snapshotKey.tileY,
      });

      // Delete from Chrome Storage immediately to free memory
      await storage.remove(snapshotKey.fullKey);

      console.log(`🧑‍🎨 [Migration] Migrated snapshot ${snapshotKey.id}`);
      migrated++;
    } catch (error) {
      console.error(
        `🧑‍🎨 [Migration] Failed to migrate snapshot ${snapshotKey.id}:`,
        error
      );
      failed.push(snapshotKey.fullKey);
    }

    // Small delay to avoid UI freeze
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Clean up Chrome Storage after successful migration
  if (failed.length === 0) {
    await cleanupLegacyStorage(itemKeys);
    await cleanupLegacySnapshotIndex();
  }

  // Mark migration as complete
  const { storage: storageApi } = await import("@/utils/browser-api");
  await storageApi.set({ [MIGRATION_VERSION_KEY]: MIGRATION_VERSION });

  console.log(
    `🧑‍🎨 [Migration] Complete: ${migrated} migrated, ${skipped} skipped, ${failed.length} failed`
  );

  return { migrated, skipped, failed };
};

/**
 * Clean up legacy Chrome Storage data
 */
const cleanupLegacyStorage = async (itemKeys: string[]): Promise<void> => {
  const { storage } = await import("@/utils/browser-api");

  // Remove all gallery items and index
  const keysToRemove = [...itemKeys, "gallery_index"];

  for (const key of keysToRemove) {
    await storage.remove(key);
  }

  console.log(
    `🧑‍🎨 [Migration] Cleaned up ${keysToRemove.length} items from Chrome Storage`
  );

  // Also clean up legacy IndexedDB
  await deleteLegacyIndexedDB();
};

/**
 * Delete legacy IndexedDB
 */
const deleteLegacyIndexedDB = async (): Promise<void> => {
  return new Promise((resolve) => {
    // Timeout after 3 seconds to prevent hanging
    const timeout = setTimeout(() => {
      console.warn("🧑‍🎨 [Migration] Legacy IndexedDB deletion timed out");
      resolve();
    }, 3000);

    const request = indexedDB.deleteDatabase("mr-wplace-gallery");
    request.onsuccess = () => {
      clearTimeout(timeout);
      console.log("🧑‍🎨 [Migration] Deleted legacy IndexedDB");
      resolve();
    };
    request.onerror = () => {
      clearTimeout(timeout);
      console.warn("🧑‍🎨 [Migration] Failed to delete legacy IndexedDB");
      resolve();
    };
    request.onblocked = () => {
      clearTimeout(timeout);
      console.warn("🧑‍🎨 [Migration] Legacy IndexedDB deletion blocked (connections still open)");
      resolve();
    };
  });
};

/**
 * Clean up legacy snapshot index from Chrome Storage
 * Note: Snapshot data is already deleted during migration
 * Note: timetravel_draw_states is NOT deleted (still used for UI state)
 */
const cleanupLegacySnapshotIndex = async (): Promise<void> => {
  const { storage } = await import("@/utils/browser-api");
  await storage.remove("tile_snapshots_index");
  console.log("🧑‍🎨 [Migration] Cleaned up snapshot index from Chrome Storage");
};

/**
 * Reset migration flag (for testing)
 */
export const resetMigration = async (): Promise<void> => {
  const { storage } = await import("@/utils/browser-api");
  await storage.remove(MIGRATION_VERSION_KEY);
  console.log("🧑‍🎨 [Migration] Reset migration flag");
};
