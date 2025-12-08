/**
 * Data Migrator - Phase 5: Legacy Data Migration
 *
 * Migrates existing user data from old format (dataUrl in Chrome Storage)
 * to new format (thumbnail + IndexedDB blob storage)
 */

import { GalleryStorage } from "@/states/galleryStorage";
import { generateThumbnail } from "@/utils/thumbnail";
import { saveImageToIndexedDB } from "@/utils/indexed-db-bridge";

const MIGRATION_VERSION = "2.0.0";
const MIGRATION_VERSION_KEY = "mr-wplace-migration-version";

/**
 * Convert dataUrl to Blob
 */
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

/**
 * Check if migration is needed
 */
export const needsMigration = async (): Promise<boolean> => {
  const { storage } = await import("@/utils/browser-api");
  const result = await storage.get(MIGRATION_VERSION_KEY);
  const currentVersion = result[MIGRATION_VERSION_KEY];

  return !currentVersion || currentVersion !== MIGRATION_VERSION;
};

/**
 * Run data migration for all gallery items
 *
 * This function:
 * 1. Finds all items with dataUrl
 * 2. Generates thumbnail from dataUrl
 * 3. Saves blob to IndexedDB
 * 4. Removes dataUrl from Chrome Storage
 * 5. Queues background optimization
 */
export const runDataMigration = async (): Promise<{
  migrated: number;
  skipped: number;
  failed: string[];
}> => {
  console.log("🧑‍🎨 [Migration] Starting data migration to v2.0.0...");

  const galleryStorage = new GalleryStorage();
  const items = await galleryStorage.getAll();

  let migrated = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const item of items) {
    // Skip if no dataUrl (already migrated or new format)
    if (!item.dataUrl || item.dataUrl === "") {
      skipped++;
      continue;
    }

    try {
      console.log(`🧑‍🎨 [Migration] Migrating ${item.key}...`);

      // 1. Convert dataUrl to blob
      const blob = await dataUrlToBlob(item.dataUrl);

      // 2. Generate thumbnail if not exists
      let thumbnail = item.thumbnail;
      if (!thumbnail) {
        thumbnail = await generateThumbnail(blob, 128);
        console.log(`🧑‍🎨 [Migration] Generated thumbnail for ${item.key}`);
      }

      // 3. Save blob to IndexedDB (only if it has drawPosition)
      if (item.drawPosition) {
        const success = await saveImageToIndexedDB(
          item.key,
          blob,
          item.drawPosition
        );

        if (!success) {
          console.warn(
            `🧑‍🎨 [Migration] Failed to save to IndexedDB: ${item.key}`
          );
          failed.push(item.key);
          continue;
        }

        console.log(`🧑‍🎨 [Migration] Saved to IndexedDB: ${item.key}`);
      }

      // 4. Remove dataUrl from Chrome Storage
      const { dataUrl, ...metadata } = item;
      await galleryStorage.save({
        ...metadata,
        thumbnail,
      });

      console.log(`🧑‍🎨 [Migration] Removed dataUrl from ${item.key}`);
      migrated++;

      // Small delay to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`🧑‍🎨 [Migration] Failed to migrate ${item.key}:`, error);
      failed.push(item.key);
    }
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
 * Reset migration flag (for testing)
 */
export const resetMigration = async (): Promise<void> => {
  const { storage } = await import("@/utils/browser-api");
  await storage.remove(MIGRATION_VERSION_KEY);
  console.log("🧑‍🎨 [Migration] Reset migration flag");
};
