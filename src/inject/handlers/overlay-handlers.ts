import type { GalleryItem } from "../../states/galleryStorage";
import {
  addImageToOverlayLayers,
  removePreparedOverlayImageByKey,
  setPerTileColorStats,
} from "../tile-draw";
import { loadImageBitmap } from "../utils/image-loader";

/**
 * Fetch full image from IndexedDB via postMessage
 *
 * NOTE: This implementation is needed in inject context (page context)
 * Cannot import from content context utilities (@/utils/indexed-db-bridge.ts)
 * Content and inject contexts are isolated - no direct module imports allowed
 *
 * For content context code, use: import { fetchFullImageFromIndexedDB } from "@/utils/indexed-db-bridge"
 */
const fetchFullImageFromIndexedDB = async (
  key: string
): Promise<string | null> => {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-gallery-dataurl-response" &&
        event.data.key === key
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.dataUrl);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-gallery-dataurl-request",
        key,
      },
      "*"
    );

    // Timeout after 10s
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn(`🧑‍🎨 : IndexedDB full image fetch timeout for ${key}`);
      resolve(null);
    }, 10000);
  });
};

/**
 * Save gallery item to IndexedDB and request Worker migration
 * SAFETY: Only saves metadata + blob, Worker does heavy processing in background
 */
const saveGalleryToIndexedDB = async (
  img: GalleryItem,
  bitmap: ImageBitmap
): Promise<void> => {
  const { getLayerRepository, getWorkerMessenger } = await import(
    "../states/migrationState"
  );
  const repository = getLayerRepository();
  const workerMessenger = getWorkerMessenger();

  if (!repository) {
    console.warn("🧑‍🎨 : LayerRepository not available, skipping IndexedDB save");
    return;
  }

  try {
    // Check if layer already exists
    const existingLayer = await repository.getLayerMetadata(img.key);
    if (existingLayer) {
      // Layer exists, but might not be optimized yet
      if (!existingLayer.isOptimized && workerMessenger) {
        // Request migration in background (low priority)
        requestWorkerMigration(workerMessenger, img.key, existingLayer);
      }
      return;
    }

    // Convert ImageBitmap to Blob (use already loaded bitmap)
    const blob = await bitmapToBlob(bitmap);

    // Calculate bounds
    if (!img.drawPosition) {
      console.warn(`🧑‍🎨 : No drawPosition for ${img.key}, skipping`);
      return;
    }

    const TLX = img.drawPosition.TLX;
    const TLY = img.drawPosition.TLY;
    const PxX = img.drawPosition.PxX;
    const PxY = img.drawPosition.PxY;

    const bounds = {
      top: TLY * 1000 + PxY,
      left: TLX * 1000 + PxX,
      right: TLX * 1000 + PxX + bitmap.width,
      bottom: TLY * 1000 + PxY + bitmap.height,
    };

    const layerMetadata = {
      id: img.key,
      type: "gallery" as const,
      visible: true,
      zIndex: img.layerOrder ?? 0,
      opacity: 1,
      coords: { TLX, TLY, PxX, PxY },
      bounds,
      isOptimized: false,
      timestamp: Date.now(),
    };

    // Save to IndexedDB (only metadata + blob, no tile splitting)
    // saveLayer calculates dimensions from blob automatically
    await repository.saveLayer(layerMetadata, blob);

    console.log(`🧑‍🎨 : Saved ${img.key} to IndexedDB`);

    // Request Worker migration in background (low priority)
    if (workerMessenger) {
      requestWorkerMigration(workerMessenger, img.key, layerMetadata);
    }
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to save ${img.key} to IndexedDB:`, error);
  }
};

/**
 * Convert ImageBitmap to Blob
 */
const bitmapToBlob = async (bitmap: ImageBitmap): Promise<Blob> => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }
  ctx.drawImage(bitmap, 0, 0);
  return await canvas.convertToBlob({ type: "image/png" });
};

/**
 * Request Worker migration (background processing)
 */
const requestWorkerMigration = (
  workerMessenger: import("../workers/messaging").WorkerMessenger,
  layerId: string,
  layer: {
    coords: { TLX: number; TLY: number; PxX: number; PxY: number };
    bounds: { top: number; left: number; right: number; bottom: number };
  }
): void => {
  workerMessenger.send({
    type: "MIGRATE_REQUEST",
    data: {
      layerId,
      priority: 1, // Low priority (background migration)
      coords: layer.coords,
      bounds: layer.bounds,
    },
  });

  console.log(`🧑‍🎨 : Requested background migration for ${layerId}`);
};

/**
 * Handle gallery images data from content script
 * Store in window for tile processing and sync to overlay layers
 * Also restores stored statistics from previous sessions
 */
export const handleGalleryImages = async (data: {
  images: Array<GalleryItem>;
}): Promise<void> => {
  if (!window.mrWplaceGalleryImages) {
    window.mrWplaceGalleryImages = new Map();
  }

  // Remove previously tracked gallery images from overlay layers
  if (window.mrWplaceGalleryImageKeys) {
    for (const key of window.mrWplaceGalleryImageKeys) {
      removePreparedOverlayImageByKey(key);
    }
  }

  // Clear and update gallery images
  window.mrWplaceGalleryImages.clear();
  for (const img of data.images) {
    window.mrWplaceGalleryImages.set(img.key, img);
  }

  // Sync to overlay layers for tile-draw system
  // Sort by layerOrder to maintain proper z-index
  const sortedImages = data.images.sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0));

  let successCount = 0;
  let failCount = 0;
  let totalTileCount = 0;
  const imageKeys: string[] = [];

  for (const img of sortedImages) {
    try {
      // Check if layer exists in IndexedDB (lazy loading strategy)
      const { getLayerRepository } = await import("../states/migrationState");
      const repository = getLayerRepository();

      let layerMetadata: Awaited<ReturnType<typeof repository.getLayerMetadata>> = null;
      if (repository) {
        try {
          layerMetadata = await repository.getLayerMetadata(img.key);
        } catch (error) {
          console.warn(`🧑‍🎨 : Failed to check IndexedDB for ${img.key}:`, error);
        }
      }

      // Strategy:
      // 1. If layer is optimized in IndexedDB -> use lazy loading (no image load needed)
      // 2. If layer exists but not optimized -> load full image from IndexedDB and split on-the-fly
      // 3. If no layer in IndexedDB -> load from dataUrl and save to IndexedDB

      if (layerMetadata && layerMetadata.isOptimized) {
        // Layer is optimized - tiles will be loaded on-demand from IndexedDB during rendering
        console.log(`🧑‍🎨 : Layer ${img.key} is optimized, will use lazy loading from IndexedDB`);

        // Only add to overlay layers if drawEnabled is true
        if (img.drawEnabled !== false) {
          if (!img.drawPosition) {
            console.warn(`🧑‍🎨 : No drawPosition for ${img.key}, skipping overlay`);
            continue;
          }

          // Create a dummy 1x1 bitmap as placeholder (won't be used for rendering)
          const dummyBitmap = await createImageBitmap(new ImageData(1, 1));
          await addImageToOverlayLayers(
            dummyBitmap,
            [
              img.drawPosition.TLX,
              img.drawPosition.TLY,
              img.drawPosition.PxX,
              img.drawPosition.PxY,
            ],
            img.key,
            { force: false } // Don't force split - layer is optimized
          );
        }

        // No need to save to IndexedDB - already exists and optimized
      } else {
        // Layer not optimized yet - check if in IndexedDB
        if (layerMetadata && !layerMetadata.isOptimized) {
          // Already in IndexedDB but not optimized - register metadata only, load tiles on-demand
          console.log(`🧑‍🎨 : Layer ${img.key} in IndexedDB but not optimized, will use lazy loading`);

          if (img.drawEnabled !== false && img.drawPosition) {
            // Create a dummy 1x1 bitmap as placeholder
            const dummyBitmap = await createImageBitmap(new ImageData(1, 1));
            await addImageToOverlayLayers(
              dummyBitmap,
              [
                img.drawPosition.TLX,
                img.drawPosition.TLY,
                img.drawPosition.PxX,
                img.drawPosition.PxY,
              ],
              img.key,
              { force: false } // Don't force split - will load tiles on-demand via getTile()
            );
          }
        } else {
          // Not in IndexedDB yet - need to load and save first
          let bitmap: ImageBitmap | null = null;

          if (img.dataUrl && img.dataUrl !== "") {
            // dataUrl available in Chrome storage - use it directly
            console.log(
              `🧑‍🎨 : Loading from dataUrl (${(img.dataUrl.length / 1024).toFixed(1)}KB) for ${img.key}`
            );
            bitmap = await loadImageBitmap(img.dataUrl, img.key);
          } else {
            // dataUrl is empty (Doctor cleanup) - try fetching from IndexedDB
            console.log(
              `🧑‍🎨 : dataUrl empty for ${img.key}, attempting IndexedDB fetch...`
            );
            const fullDataUrl = await fetchFullImageFromIndexedDB(img.key);
            if (fullDataUrl) {
              bitmap = await loadImageBitmap(fullDataUrl, img.key);
              console.log(
                `🧑‍🎨 : Successfully loaded from IndexedDB for ${img.key}`
              );
            } else {
              console.warn(
                `🧑‍🎨 : Failed to fetch from IndexedDB for ${img.key}`
              );
            }
          }

          if (!bitmap) {
            console.warn(
              `🧑‍🎨 : No image source available for ${img.key}, skipping`
            );
            continue;
          }

          // Save to IndexedDB first (so we can use lazy loading next time)
          await saveGalleryToIndexedDB(img, bitmap);

          // Only add to overlay layers if drawEnabled is true
          if (img.drawEnabled !== false && img.drawPosition) {
            await addImageToOverlayLayers(
              bitmap,
              [
                img.drawPosition.TLX,
                img.drawPosition.TLY,
                img.drawPosition.PxX,
                img.drawPosition.PxY,
              ],
              img.key,
              { force: true } // Force split since not optimized yet
            );

            // Count tiles for this image
            const { overlayLayers } = await import("../tile-draw");
            const thisImageLayer = overlayLayers.find(
              (layer) => layer.imageKey === img.key
            );
            if (thisImageLayer && thisImageLayer.tiles) {
              const tileCount = Object.keys(thisImageLayer.tiles).length;
              totalTileCount += tileCount;
              console.log(
                `🧑‍🎨 : Image ${img.key} split into ${tileCount} tiles (${bitmap.width}x${bitmap.height}px)`
              );
            }
          } else {
            console.log(
              `🧑‍🎨 : Image ${img.key} is disabled, skipping overlay layers (but saved to IndexedDB)`
            );
          }
        }
      }

      // Restore stored statistics if available
      if (img.perTileColorStats) {
        const tileStatsMap = new Map<
          string,
          { matched: Map<string, number>; total: Map<string, number> }
        >();

        for (const [tileKey, stats] of Object.entries(img.perTileColorStats)) {
          tileStatsMap.set(tileKey, {
            matched: new Map(Object.entries(stats.matched)),
            total: new Map(Object.entries(stats.total)),
          });
        }

        setPerTileColorStats(img.key, tileStatsMap);
        console.log(
          `🧑‍🎨 : Restored statistics for ${img.key} (${tileStatsMap.size} tiles)`
        );
      }

      imageKeys.push(img.key);
      successCount++;
    } catch (error) {
      failCount++;
      console.error(
        `🧑‍🎨 : Failed to add image ${img.key} to overlay layers:`,
        error
      );
    }
  }

  // Save current image keys for next update
  window.mrWplaceGalleryImageKeys = new Set(imageKeys);

  console.log(
    `🧑‍🎨 : Gallery images sync complete - success: ${successCount}, failed: ${failCount}, total tiles: ${totalTileCount}`
  );
  console.log(
    "🧑‍🎨 : Gallery images updated and synced to overlay layers:",
    data.images.length
  );

  // Log memory usage after processing (Chrome only)
  const memoryAfterProcessing = (performance as any).memory?.usedJSHeapSize;
  if (memoryAfterProcessing) {
    console.log(
      `🧑‍🎨 (inject): Memory after gallery processing: ${(
        memoryAfterProcessing /
        1024 /
        1024
      ).toFixed(2)}MB`
    );
  }
};

/**
 * Handle snapshots update from content script
 * Snapshots are tile-specific overlays for time-travel feature
 */
export const handleSnapshotsUpdate = async (data: {
  snapshots: Array<{
    key: string;
    dataUrl: string;
    tileX: number;
    tileY: number;
  }>;
}): Promise<void> => {
  if (!window.mrWplaceSnapshots) {
    window.mrWplaceSnapshots = new Map();
  }

  // Remove previously tracked snapshots from overlay layers
  if (window.mrWplaceSnapshotKeys) {
    for (const key of window.mrWplaceSnapshotKeys) {
      removePreparedOverlayImageByKey(key);
    }
  }

  // Clear and update snapshots
  window.mrWplaceSnapshots.clear();
  for (const snapshot of data.snapshots) {
    window.mrWplaceSnapshots.set(snapshot.key, snapshot);
  }

  // Add each snapshot to overlay layers
  const snapshotKeys: string[] = [];
  for (const snapshot of data.snapshots) {
    try {
      const bitmap = await loadImageBitmap(snapshot.dataUrl, snapshot.key);

      // Snapshots don't need stats computation (no progress tracking)
      await addImageToOverlayLayers(
        bitmap,
        [snapshot.tileX, snapshot.tileY, 0, 0],
        snapshot.key,
        { skip: true } // Don't compute stats for snapshots
      );

      snapshotKeys.push(snapshot.key);
      console.log(
        `🧑‍🎨 : Added snapshot ${snapshot.key} to overlay at (${snapshot.tileX}, ${snapshot.tileY})`
      );
    } catch (error) {
      console.error(
        `🧑‍🎨 : Failed to add snapshot ${snapshot.key} to overlay layers:`,
        error
      );
    }
  }

  // Save current snapshot keys for next update
  window.mrWplaceSnapshotKeys = new Set(snapshotKeys);

  console.log(`🧑‍🎨 : Snapshots updated: ${data.snapshots.length} active`);
};

/**
 * Handle text layers update from content script
 * Text layers are dynamically placed text overlays
 */
export const handleTextLayersUpdate = async (data: {
  textLayers: Array<{
    key: string;
    text: string;
    font: string;
    coords: { TLX: number; TLY: number; PxX: number; PxY: number };
    dataUrl: string;
    timestamp: number;
  }>;
}): Promise<void> => {
  if (!window.mrWplaceTextLayers) {
    window.mrWplaceTextLayers = new Map();
  }

  // Remove previously tracked text layers from overlay layers
  if (window.mrWplaceTextLayerKeys) {
    for (const key of window.mrWplaceTextLayerKeys) {
      removePreparedOverlayImageByKey(key);
    }
  }

  // Clear and update text layers
  window.mrWplaceTextLayers.clear();
  for (const textLayer of data.textLayers) {
    window.mrWplaceTextLayers.set(textLayer.key, textLayer);
  }

  // Add each text layer to overlay layers
  const textLayerKeys: string[] = [];
  for (const textLayer of data.textLayers) {
    try {
      const bitmap = await loadImageBitmap(textLayer.dataUrl, textLayer.key);

      // Text layers don't need stats computation (no progress tracking)
      await addImageToOverlayLayers(
        bitmap,
        [
          textLayer.coords.TLX,
          textLayer.coords.TLY,
          textLayer.coords.PxX,
          textLayer.coords.PxY,
        ],
        textLayer.key,
        { skip: true } // Don't compute stats for text layers
      );

      textLayerKeys.push(textLayer.key);
      console.log(
        `🧑‍🎨 : Added text layer ${textLayer.key} to overlay at (${textLayer.coords.TLX}, ${textLayer.coords.TLY})`
      );
    } catch (error) {
      console.error(
        `🧑‍🎨 : Failed to add text layer ${textLayer.key} to overlay layers:`,
        error
      );
    }
  }

  // Save current text layer keys for next update
  window.mrWplaceTextLayerKeys = new Set(textLayerKeys);

  console.log(`🧑‍🎨 : Text layers updated: ${data.textLayers.length} active`);
};

/**
 * Handle layer save request from content script
 * Saves layer to IndexedDB via LayerRepository
 */
export const handleLayerSave = async (data: {
  layer: {
    id: string;
    type: "gallery" | "text" | "snapshot";
    visible: boolean;
    zIndex: number;
    opacity: number;
    coords: { TLX: number; TLY: number; PxX: number; PxY: number };
    bounds: { top: number; left: number; right: number; bottom: number };
    isOptimized: boolean;
    title?: string;
    timestamp: number;
    layerOrder?: number;
    text?: string;
    font?: string;
    snapshotName?: string;
  };
  dataUrl: string;
}): Promise<void> => {
  const { getLayerRepository } = await import("../states/migrationState");
  const repository = getLayerRepository();

  if (!repository) {
    console.warn("🧑‍🎨 : LayerRepository not initialized, skipping layer save");
    return;
  }

  try {
    // Convert dataUrl to Blob
    const response = await fetch(data.dataUrl);
    const blob = await response.blob();

    // Save to IndexedDB
    await repository.saveLayer(data.layer, blob);

    console.log(`🧑‍🎨 : Saved layer ${data.layer.id} to IndexedDB`);

    // Send success response
    window.postMessage(
      {
        source: "mr-wplace-layer-save-response",
        layerId: data.layer.id,
        success: true,
      },
      "*"
    );
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to save layer ${data.layer.id}:`, error);

    // Send error response
    window.postMessage(
      {
        source: "mr-wplace-layer-save-response",
        layerId: data.layer.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      "*"
    );
  }
};

/**
 * Handle save image request from content context
 *
 * This handler saves an image blob to IndexedDB and triggers migration
 */
export const handleSaveImageRequest = async (data: {
  key: string;
  dataUrl: string;
  coords: { TLX: number; TLY: number; PxX: number; PxY: number };
}): Promise<void> => {
  try {
    const { getLayerRepository, requestWorkerMigration } = await import(
      "../states/migrationState"
    );
    const repository = getLayerRepository();

    if (!repository) {
      throw new Error("LayerRepository not initialized");
    }

    // Convert dataUrl to blob
    const response = await fetch(data.dataUrl);
    const blob = await response.blob();

    // Get image dimensions
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();

    // Create layer metadata
    const layer = {
      id: data.key,
      type: "gallery" as const,
      visible: true,
      zIndex: 0,
      opacity: 1,
      coords: data.coords,
      bounds: {
        top: data.coords.TLY,
        left: data.coords.TLX,
        right: data.coords.TLX + Math.floor(width / 1000),
        bottom: data.coords.TLY + Math.floor(height / 1000),
      },
      isOptimized: false,
      timestamp: Date.now(),
    };

    // Save to IndexedDB
    await repository.saveLayer(layer, blob);

    console.log(`🧑‍🎨 : Saved image ${data.key} to IndexedDB (${width}x${height})`);

    // Request migration
    requestWorkerMigration(data.key, {
      priority: 1,
      coords: data.coords,
      bounds: layer.bounds,
    });

    // Send success response
    window.postMessage(
      {
        source: "mr-wplace-save-image-response",
        key: data.key,
        success: true,
      },
      "*"
    );
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to save image ${data.key}:`, error);

    // Send error response
    window.postMessage(
      {
        source: "mr-wplace-save-image-response",
        key: data.key,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      "*"
    );
  }
};
