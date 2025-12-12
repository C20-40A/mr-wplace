/**
 * Data Migrator v2
 *
 * Chrome Storage → IndexedDB v2 への完全移行
 * - images: フルサイズ元画像
 * - tiles: タイル分割画像
 * - metadata: メタデータ
 * - thumbnails: サムネイル
 */

import type { MigrationProgress } from "./migration-modal";

const MIGRATION_VERSION = "3.0.0";
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
 * Get all legacy items from Chrome Storage
 */
const getLegacyItems = async (): Promise<LegacyGalleryItem[]> => {
  const { storage } = await import("@/utils/browser-api");
  const result = await storage.get(null);
  const items: LegacyGalleryItem[] = [];

  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith("gallery_") && !key.endsWith("_index")) {
      if (typeof value === "object" && (value as any).key) {
        items.push(value as LegacyGalleryItem);
      } else if (typeof value === "string") {
        // Old format: dataUrl only
        const timestamp = parseInt(key.replace("gallery_", ""));
        items.push({
          key,
          timestamp,
          dataUrl: value,
        });
      }
    }
  }

  return items;
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
 * Check if migration to v3 is needed
 */
export const needsMigration = async (): Promise<boolean> => {
  const { storage } = await import("@/utils/browser-api");
  const result = await storage.get(MIGRATION_VERSION_KEY);
  const currentVersion = result[MIGRATION_VERSION_KEY];

  if (currentVersion === MIGRATION_VERSION) return false;

  // Check if there are any legacy items to migrate
  const items = await getLegacyItems();
  return items.length > 0;
};

/**
 * Get count of items to migrate (for progress display)
 */
export const getMigrationCount = async (): Promise<number> => {
  const items = await getLegacyItems();
  return items.length;
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
  console.log("🧑‍🎨 [Migration] Starting migration to v3.0.0 (IndexedDB v2)...");

  const { initGalleryRepository } = await import(
    "@/inject/db/gallery-repository"
  );
  const repository = await initGalleryRepository();

  const items = await getLegacyItems();
  const total = items.length;

  let migrated = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    onProgress?.({
      current: i + 1,
      total,
      currentItem: item.title || item.key,
    });

    try {
      // Get image blob
      const blob = await getImageBlob(item);
      if (!blob) {
        console.warn(`🧑‍🎨 [Migration] No image source for ${item.key}, skipping`);
        skipped++;
        continue;
      }

      // Save to new IndexedDB v2
      await repository.saveGalleryItem(item.key, blob, {
        title: item.title,
        coords: item.drawPosition,
        visible: item.drawEnabled !== false,
        zIndex: item.layerOrder ?? 0,
        timestamp: item.timestamp,
        perTileStats: item.perTileColorStats,
      });

      console.log(`🧑‍🎨 [Migration] Migrated ${item.key}`);
      migrated++;
    } catch (error) {
      console.error(`🧑‍🎨 [Migration] Failed to migrate ${item.key}:`, error);
      failed.push(item.key);
    }

    // Small delay to avoid UI freeze
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Clean up Chrome Storage after successful migration
  if (failed.length === 0) {
    await cleanupLegacyStorage(items);
  }

  // Mark migration as complete
  const { storage } = await import("@/utils/browser-api");
  await storage.set({ [MIGRATION_VERSION_KEY]: MIGRATION_VERSION });

  console.log(
    `🧑‍🎨 [Migration] Complete: ${migrated} migrated, ${skipped} skipped, ${failed.length} failed`
  );

  return { migrated, skipped, failed };
};

/**
 * Clean up legacy Chrome Storage data
 */
const cleanupLegacyStorage = async (
  items: LegacyGalleryItem[]
): Promise<void> => {
  const { storage } = await import("@/utils/browser-api");

  // Remove all gallery items and index
  const keysToRemove = items.map((item) => item.key);
  keysToRemove.push("gallery_index");

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
 * Reset migration flag (for testing)
 */
export const resetMigration = async (): Promise<void> => {
  const { storage } = await import("@/utils/browser-api");
  await storage.remove(MIGRATION_VERSION_KEY);
  console.log("🧑‍🎨 [Migration] Reset migration flag");
};
