/**
 * Doctor Handlers - IndexedDB Health Check
 * Handles storage diagnostic requests from content script
 */

import { DB_NAME, DB_VERSION, STORES } from '../db/schema';

/**
 * Check if a gallery item exists in IndexedDB
 */
const handleIndexedDBCheck = async (key: string): Promise<void> => {
  try {
    const db = await openDatabase();
    const exists = await checkLayerExists(db, key);

    // Send response back to content script
    window.postMessage(
      {
        source: "mr-wplace-doctor-check-idb-response",
        key,
        exists,
      },
      "*"
    );
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to check IndexedDB for ${key}:`, error);

    // Send failure response
    window.postMessage(
      {
        source: "mr-wplace-doctor-check-idb-response",
        key,
        exists: false,
      },
      "*"
    );
  }
};

/**
 * Open IndexedDB database
 */
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.LAYERS)) {
        const layersStore = db.createObjectStore(STORES.LAYERS, { keyPath: "id" });
        layersStore.createIndex("type", "type", { unique: false });
        layersStore.createIndex("visible", "visible", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.LEGACY_BLOBS)) {
        db.createObjectStore(STORES.LEGACY_BLOBS, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.OPTIMIZED_TILES)) {
        const tilesStore = db.createObjectStore(STORES.OPTIMIZED_TILES, {
          keyPath: ["layerId", "tileKey"],
        });
        tilesStore.createIndex("layerId", "layerId", { unique: false });
        tilesStore.createIndex("tileKey", "tileKey", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.STATISTICS)) {
        db.createObjectStore(STORES.STATISTICS, { keyPath: "layerId" });
      }
    };
  });
};

/**
 * Check if layer exists in IndexedDB
 */
const checkLayerExists = (
  db: IDBDatabase,
  layerId: string
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LAYERS], "readonly");
    const store = tx.objectStore(STORES.LAYERS);
    const request = store.get(layerId);

    request.onsuccess = () => {
      resolve(!!request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Handle gallery dataUrl request from content script
 * Fetch blob from IndexedDB and convert to dataUrl
 */
const handleGalleryDataUrlRequest = async (key: string): Promise<void> => {
  try {
    const db = await openDatabase();
    const blob = await getLegacyBlob(db, key);

    if (!blob) {
      // Send empty response
      window.postMessage(
        {
          source: "mr-wplace-gallery-dataurl-response",
          key,
          dataUrl: null,
        },
        "*"
      );
      return;
    }

    // Convert Blob to dataUrl
    const dataUrl = await blobToDataUrl(blob);

    // Send response back to content script
    window.postMessage(
      {
        source: "mr-wplace-gallery-dataurl-response",
        key,
        dataUrl,
      },
      "*"
    );
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to fetch dataUrl for ${key}:`, error);

    // Send failure response
    window.postMessage(
      {
        source: "mr-wplace-gallery-dataurl-response",
        key,
        dataUrl: null,
      },
      "*"
    );
  }
};

/**
 * Get legacy blob from IndexedDB
 */
const getLegacyBlob = (
  db: IDBDatabase,
  layerId: string
): Promise<Blob | null> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LEGACY_BLOBS], "readonly");
    const store = tx.objectStore(STORES.LEGACY_BLOBS);
    const request = store.get(layerId);

    request.onsuccess = () => {
      const data = request.result;
      resolve(data ? data.blob : null);
    };

    request.onerror = () => reject(request.error);
  });
};

/**
 * Convert Blob to dataUrl
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
 * Handle thumbnail generation request
 * Generate 128x128 thumbnail from IndexedDB blob
 */
const handleThumbnailRequest = async (key: string): Promise<void> => {
  try {
    const db = await openDatabase();
    const blob = await getLegacyBlob(db, key);

    if (!blob) {
      // Send empty response
      window.postMessage(
        {
          source: "mr-wplace-thumbnail-response",
          key,
          thumbnail: null,
        },
        "*"
      );
      return;
    }

    // Generate thumbnail
    const thumbnail = await generateThumbnail(blob);

    // Send response back to content script
    window.postMessage(
      {
        source: "mr-wplace-thumbnail-response",
        key,
        thumbnail,
      },
      "*"
    );
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to generate thumbnail for ${key}:`, error);

    // Send failure response
    window.postMessage(
      {
        source: "mr-wplace-thumbnail-response",
        key,
        thumbnail: null,
      },
      "*"
    );
  }
};

/**
 * Generate 128x128 thumbnail from blob
 */
const generateThumbnail = async (blob: Blob): Promise<string> => {
  const THUMBNAIL_SIZE = 128;

  // Create ImageBitmap
  const bitmap = await createImageBitmap(blob);

  // Calculate scaled dimensions (maintain aspect ratio)
  let width = bitmap.width;
  let height = bitmap.height;

  if (width > height) {
    if (width > THUMBNAIL_SIZE) {
      height = (height * THUMBNAIL_SIZE) / width;
      width = THUMBNAIL_SIZE;
    }
  } else {
    if (height > THUMBNAIL_SIZE) {
      width = (width * THUMBNAIL_SIZE) / height;
      height = THUMBNAIL_SIZE;
    }
  }

  // Create canvas and draw scaled image
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Convert to JPEG (smaller size)
  const thumbnailBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.7,
  });

  // Convert to dataUrl
  return await blobToDataUrl(thumbnailBlob);
};

/**
 * Setup doctor message handlers
 */
export const setupDoctorHandlers = (): void => {
  window.addEventListener("message", (event) => {
    if (event.data.source === "mr-wplace-doctor-check-idb") {
      const { key } = event.data;
      handleIndexedDBCheck(key);
    }

    // Handle gallery dataUrl request
    if (event.data.source === "mr-wplace-gallery-dataurl-request") {
      const { key } = event.data;
      handleGalleryDataUrlRequest(key);
    }

    // Handle thumbnail generation request
    if (event.data.source === "mr-wplace-thumbnail-request") {
      const { key } = event.data;
      handleThumbnailRequest(key);
    }
  });

  console.log("🧑‍🎨 : Doctor handlers initialized");
};
