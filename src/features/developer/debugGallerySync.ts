/**
 * ⚠️ DANGER: Gallery Sync - Experimental Feature
 *
 * IndexedDB v2 ↔ chrome.storage.local 完全同期機能
 *
 * 警告:
 * - 大量のデータを chrome.storage.local に保存するため、容量制限に注意
 * - Blob → dataURL 変換により、データサイズが増加します
 * - unlimitedStorage permission が必須
 */

import {
  openDatabaseV2,
  STORES_V2,
  type GalleryMetadata,
  type ImageRecord,
  type TileRecord,
  type ThumbnailRecord,
} from "@/inject/db/schema-v2";
import { storage } from "@/utils/browser-api";

const STORAGE_SYNC_KEY = "mr-wplace-gallery-v2-sync";

/**
 * Sync data structure for chrome.storage
 */
interface StorageSyncData {
  metadata: GalleryMetadata[];
  images: { id: string; dataUrl: string }[];
  splitTiles: { layerId: string; tileKey: string; dataUrl: string }[];
  thumbnails: { id: string; dataUrl: string }[];
  syncedAt: number;
}

/**
 * Convert Blob to dataURL
 */
const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Convert dataURL to Blob
 */
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return res.blob();
};

/**
 * Get all data from IndexedDB v2
 */
const getAllFromIndexedDB = async (): Promise<
  Omit<StorageSyncData, "syncedAt">
> => {
  const db = await openDatabaseV2();

  console.log("🧑‍🎨 [Sync] Reading from IndexedDB...");

  // Get all metadata
  const metadataList = await new Promise<GalleryMetadata[]>(
    (resolve, reject) => {
      const tx = db.transaction([STORES_V2.METADATA], "readonly");
      const store = tx.objectStore(STORES_V2.METADATA);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }
  );
  console.log(`🧑‍🎨 [Sync] Found ${metadataList.length} metadata items`);

  // Get all images
  const imageRecords = await new Promise<ImageRecord[]>((resolve, reject) => {
    const tx = db.transaction([STORES_V2.IMAGES], "readonly");
    const store = tx.objectStore(STORES_V2.IMAGES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  console.log(`🧑‍🎨 [Sync] Found ${imageRecords.length} images`);

  const images = await Promise.all(
    imageRecords.map(async (record) => ({
      id: record.id,
      dataUrl: await blobToDataUrl(record.blob),
    }))
  );

  // Get all splitTiles
  const tileRecords = await new Promise<TileRecord[]>((resolve, reject) => {
    const tx = db.transaction([STORES_V2.SPLIT_TILES], "readonly");
    const store = tx.objectStore(STORES_V2.SPLIT_TILES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  console.log(`🧑‍🎨 [Sync] Found ${tileRecords.length} split tiles`);

  const splitTiles = await Promise.all(
    tileRecords.map(async (record) => ({
      layerId: record.layerId,
      tileKey: record.tileKey,
      dataUrl: await blobToDataUrl(record.blob),
    }))
  );

  // Get all thumbnails
  const thumbnailRecords = await new Promise<ThumbnailRecord[]>(
    (resolve, reject) => {
      const tx = db.transaction([STORES_V2.THUMBNAILS], "readonly");
      const store = tx.objectStore(STORES_V2.THUMBNAILS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }
  );
  console.log(`🧑‍🎨 [Sync] Found ${thumbnailRecords.length} thumbnails`);

  const thumbnails = await Promise.all(
    thumbnailRecords.map(async (record) => ({
      id: record.id,
      dataUrl: await blobToDataUrl(record.blob),
    }))
  );

  return {
    metadata: metadataList,
    images,
    splitTiles,
    thumbnails,
  };
};

/**
 * Write all data to IndexedDB v2
 */
const writeAllToIndexedDB = async (
  data: Omit<StorageSyncData, "syncedAt">
): Promise<void> => {
  const db = await openDatabaseV2();

  console.log("🧑‍🎨 [Sync] Writing to IndexedDB...");

  // Convert all dataUrls to Blobs BEFORE opening transactions
  console.log("🧑‍🎨 [Sync] Converting dataUrls to Blobs...");
  const imageBlobs = await Promise.all(
    data.images.map(async (image) => ({
      id: image.id,
      blob: await dataUrlToBlob(image.dataUrl),
    }))
  );

  const tileBlobs = await Promise.all(
    data.splitTiles.map(async (tile) => ({
      layerId: tile.layerId,
      tileKey: tile.tileKey,
      blob: await dataUrlToBlob(tile.dataUrl),
    }))
  );

  const thumbnailBlobs = await Promise.all(
    data.thumbnails.map(async (thumbnail) => ({
      id: thumbnail.id,
      blob: await dataUrlToBlob(thumbnail.dataUrl),
    }))
  );
  console.log("🧑‍🎨 [Sync] Conversion complete");

  // Write metadata
  const metadataTx = db.transaction([STORES_V2.METADATA], "readwrite");
  const metadataStore = metadataTx.objectStore(STORES_V2.METADATA);
  for (const metadata of data.metadata) {
    metadataStore.put(metadata);
  }
  await new Promise<void>((resolve, reject) => {
    metadataTx.oncomplete = () => resolve();
    metadataTx.onerror = () => reject(metadataTx.error);
  });
  console.log(`🧑‍🎨 [Sync] Wrote ${data.metadata.length} metadata items`);

  // Write images
  const imagesTx = db.transaction([STORES_V2.IMAGES], "readwrite");
  const imagesStore = imagesTx.objectStore(STORES_V2.IMAGES);
  for (const image of imageBlobs) {
    imagesStore.put({ id: image.id, blob: image.blob } as ImageRecord);
  }
  await new Promise<void>((resolve, reject) => {
    imagesTx.oncomplete = () => resolve();
    imagesTx.onerror = () => reject(imagesTx.error);
  });
  console.log(`🧑‍🎨 [Sync] Wrote ${imageBlobs.length} images`);

  // Write splitTiles
  const tilesTx = db.transaction([STORES_V2.SPLIT_TILES], "readwrite");
  const tilesStore = tilesTx.objectStore(STORES_V2.SPLIT_TILES);
  for (const tile of tileBlobs) {
    tilesStore.put({
      layerId: tile.layerId,
      tileKey: tile.tileKey,
      blob: tile.blob,
    } as TileRecord);
  }
  await new Promise<void>((resolve, reject) => {
    tilesTx.oncomplete = () => resolve();
    tilesTx.onerror = () => reject(tilesTx.error);
  });
  console.log(`🧑‍🎨 [Sync] Wrote ${tileBlobs.length} split tiles`);

  // Write thumbnails
  const thumbnailsTx = db.transaction([STORES_V2.THUMBNAILS], "readwrite");
  const thumbnailsStore = thumbnailsTx.objectStore(STORES_V2.THUMBNAILS);
  for (const thumbnail of thumbnailBlobs) {
    thumbnailsStore.put({ id: thumbnail.id, blob: thumbnail.blob } as ThumbnailRecord);
  }
  await new Promise<void>((resolve, reject) => {
    thumbnailsTx.oncomplete = () => resolve();
    thumbnailsTx.onerror = () => reject(thumbnailsTx.error);
  });
  console.log(`🧑‍🎨 [Sync] Wrote ${thumbnailBlobs.length} thumbnails`);
};

/**
 * Clear all data from IndexedDB v2
 */
const clearIndexedDB = async (): Promise<void> => {
  const db = await openDatabaseV2();

  console.log("🧑‍🎨 [Sync] Clearing IndexedDB...");

  // Clear all stores
  for (const storeName of [
    STORES_V2.METADATA,
    STORES_V2.IMAGES,
    STORES_V2.SPLIT_TILES,
    STORES_V2.THUMBNAILS,
  ]) {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  console.log("🧑‍🎨 [Sync] IndexedDB cleared");
};

/**
 * ⚠️ DANGER: Sync IndexedDB → chrome.storage.local
 *
 * IndexedDB v2 の内容を chrome.storage.local にコピーします。
 * 既存の chrome.storage.local データは上書きされます。
 */
export const syncIndexedDBToStorage = async (): Promise<void> => {
  const startTime = Date.now();
  console.log("🧑‍🎨 [Sync] ========================================");
  console.log("🧑‍🎨 [Sync] Starting IndexedDB → Storage sync...");

  try {
    // Get all data from IndexedDB
    const data = await getAllFromIndexedDB();

    // Create sync data
    const syncData: StorageSyncData = {
      ...data,
      syncedAt: Date.now(),
    };

    // Calculate size
    const dataString = JSON.stringify(syncData);
    const sizeKB = (dataString.length / 1024).toFixed(2);
    const sizeMB = (dataString.length / 1024 / 1024).toFixed(2);
    console.log(`🧑‍🎨 [Sync] Data size: ${sizeKB} KB (${sizeMB} MB)`);

    // Save to chrome.storage.local
    console.log("🧑‍🎨 [Sync] Saving to chrome.storage.local...");
    await storage.set({ [STORAGE_SYNC_KEY]: syncData });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `🧑‍🎨 [Sync] ✅ Sync complete! (${elapsed}s, ${sizeMB} MB)`
    );
    console.log("🧑‍🎨 [Sync] ========================================");

    alert(
      `✅ Sync IndexedDB → Storage complete!\n\n` +
        `Metadata: ${data.metadata.length}\n` +
        `Images: ${data.images.length}\n` +
        `Split Tiles: ${data.splitTiles.length}\n` +
        `Thumbnails: ${data.thumbnails.length}\n` +
        `Size: ${sizeMB} MB\n` +
        `Time: ${elapsed}s`
    );
  } catch (error: any) {
    console.error("🧑‍🎨 [Sync] ❌ Error:", error);
    alert(
      `❌ Sync failed!\n\n${error.message}\n\n` +
        `Check if unlimitedStorage permission is enabled.\n` +
        `See console for details.`
    );
    throw error;
  }
};

/**
 * ⚠️ DANGER: Sync chrome.storage.local → IndexedDB
 *
 * chrome.storage.local の内容で IndexedDB v2 を上書きします。
 * 既存の IndexedDB データは完全に削除されます。
 */
export const syncStorageToIndexedDB = async (): Promise<void> => {
  const startTime = Date.now();
  console.log("🧑‍🎨 [Sync] ========================================");
  console.log("🧑‍🎨 [Sync] Starting Storage → IndexedDB sync...");

  try {
    // Get sync data from chrome.storage.local
    console.log("🧑‍🎨 [Sync] Reading from chrome.storage.local...");
    const result = await storage.get(STORAGE_SYNC_KEY);
    const syncData = result[STORAGE_SYNC_KEY] as StorageSyncData | undefined;

    if (!syncData) {
      alert(
        "❌ No sync data found in chrome.storage.local!\n\n" +
          "Please run 'IndexedDB → Storage' sync first."
      );
      return;
    }

    console.log(
      `🧑‍🎨 [Sync] Found sync data (synced at: ${new Date(syncData.syncedAt).toLocaleString()})`
    );
    console.log(`🧑‍🎨 [Sync] Metadata: ${syncData.metadata.length}`);
    console.log(`🧑‍🎨 [Sync] Images: ${syncData.images.length}`);
    console.log(`🧑‍🎨 [Sync] Split Tiles: ${syncData.splitTiles.length}`);
    console.log(`🧑‍🎨 [Sync] Thumbnails: ${syncData.thumbnails.length}`);

    // Clear existing IndexedDB
    await clearIndexedDB();

    // Write to IndexedDB
    await writeAllToIndexedDB(syncData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🧑‍🎨 [Sync] ✅ Sync complete! (${elapsed}s)`);
    console.log("🧑‍🎨 [Sync] ========================================");

    alert(
      `✅ Sync Storage → IndexedDB complete!\n\n` +
        `Metadata: ${syncData.metadata.length}\n` +
        `Images: ${syncData.images.length}\n` +
        `Split Tiles: ${syncData.splitTiles.length}\n` +
        `Thumbnails: ${syncData.thumbnails.length}\n` +
        `Time: ${elapsed}s\n\n` +
        `⚠️ Reload page to apply changes.`
    );
  } catch (error: any) {
    console.error("🧑‍🎨 [Sync] ❌ Error:", error);
    alert(`❌ Sync failed!\n\n${error.message}\n\nSee console for details.`);
    throw error;
  }
};

/**
 * ⚠️ DANGER: Clean chrome.storage.local sync data
 *
 * chrome.storage.local の同期データを削除します。
 * IndexedDB のデータには影響しません。
 */
export const cleanStorageSync = async (): Promise<void> => {
  console.log("🧑‍🎨 [Sync] ========================================");
  console.log("🧑‍🎨 [Sync] Cleaning chrome.storage.local sync data...");

  try {
    // Check if data exists
    const result = await storage.get(STORAGE_SYNC_KEY);
    const syncData = result[STORAGE_SYNC_KEY] as StorageSyncData | undefined;

    if (!syncData) {
      alert("ℹ️ No sync data found in chrome.storage.local.");
      return;
    }

    // Calculate size
    const dataString = JSON.stringify(syncData);
    const sizeMB = (dataString.length / 1024 / 1024).toFixed(2);

    // Remove from storage
    await storage.remove(STORAGE_SYNC_KEY);

    console.log("🧑‍🎨 [Sync] ✅ Sync data removed");
    console.log("🧑‍🎨 [Sync] ========================================");

    alert(
      `✅ Sync data cleaned!\n\n` +
        `Removed ${sizeMB} MB from chrome.storage.local\n\n` +
        `IndexedDB data is not affected.`
    );
  } catch (error: any) {
    console.error("🧑‍🎨 [Sync] ❌ Error:", error);
    alert(`❌ Clean failed!\n\n${error.message}\n\nSee console for details.`);
    throw error;
  }
};
