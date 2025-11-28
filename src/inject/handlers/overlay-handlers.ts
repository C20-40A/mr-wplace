import { addImageToOverlayLayers, removePreparedOverlayImageByKey, setPerTileColorStats } from "../tile-draw";
import { loadImageBitmap } from "../utils/image-loader";
import type { GalleryImage } from "../types";

/**
 * Save gallery item to IndexedDB and request Worker migration
 * SAFETY: Only saves metadata + blob, Worker does heavy processing in background
 */
const saveGalleryToIndexedDB = async (
  img: GalleryImage,
  bitmap: ImageBitmap
): Promise<void> => {
  const repository = window.mrWplace?.layerRepository;
  const worker = window.mrWplace?.workerMessenger?.worker;

  if (!repository) {
    console.warn("🧑‍🎨 : LayerRepository not available, skipping IndexedDB save");
    return;
  }

  try {
    // Check if layer already exists
    const existingLayer = await repository.getLayerMetadata(img.key);
    if (existingLayer) {
      // Layer exists, but might not be optimized yet
      if (!existingLayer.isOptimized && worker) {
        // Request migration in background (low priority)
        requestWorkerMigration(worker, img.key, existingLayer);
      }
      return;
    }

    // Convert ImageBitmap to Blob (use already loaded bitmap)
    const blob = await bitmapToBlob(bitmap);

    // Calculate bounds
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
      zIndex: img.layerOrder,
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
    if (worker) {
      requestWorkerMigration(worker, img.key, layerMetadata);
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
  worker: Worker,
  layerId: string,
  layer: {
    coords: { TLX: number; TLY: number; PxX: number; PxY: number };
    bounds: { top: number; left: number; right: number; bottom: number };
  }
): void => {
  worker.postMessage({
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
  images: Array<GalleryImage>;
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
  const sortedImages = data.images.sort((a, b) => a.layerOrder - b.layerOrder);

  let successCount = 0;
  let failCount = 0;
  let totalTileCount = 0;
  const imageKeys: string[] = [];

  for (const img of sortedImages) {
    try {
      const bitmap = await loadImageBitmap(img.dataUrl, img.key);

      // Only add to overlay layers if drawEnabled is true
      if (img.drawEnabled !== false) {
        await addImageToOverlayLayers(
          bitmap,
          [img.drawPosition.TLX, img.drawPosition.TLY, img.drawPosition.PxX, img.drawPosition.PxY],
          img.key
        );

        // Count tiles for this image
        const { overlayLayers } = await import("../tile-draw");
        const thisImageLayer = overlayLayers.find((layer) => layer.imageKey === img.key);
        if (thisImageLayer) {
          const tileCount = Object.keys(thisImageLayer.tiles).length;
          totalTileCount += tileCount;
          console.log(`🧑‍🎨 : Image ${img.key} split into ${tileCount} tiles (${bitmap.width}x${bitmap.height}px)`);
        }
      } else {
        console.log(`🧑‍🎨 : Image ${img.key} is disabled, skipping overlay layers (but saving to IndexedDB)`);
      }

      // Save to IndexedDB for ALL items (both enabled and disabled)
      // This ensures complete backup of gallery data
      await saveGalleryToIndexedDB(img, bitmap);

      // Restore stored statistics if available
      if (img.perTileColorStats) {
        const tileStatsMap = new Map<string, { matched: Map<string, number>; total: Map<string, number> }>();

        for (const [tileKey, stats] of Object.entries(img.perTileColorStats)) {
          tileStatsMap.set(tileKey, {
            matched: new Map(Object.entries(stats.matched)),
            total: new Map(Object.entries(stats.total)),
          });
        }

        setPerTileColorStats(img.key, tileStatsMap);
        console.log(`🧑‍🎨 : Restored statistics for ${img.key} (${tileStatsMap.size} tiles)`);
      }

      imageKeys.push(img.key);
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`🧑‍🎨 : Failed to add image ${img.key} to overlay layers:`, error);
    }
  }

  // Save current image keys for next update
  window.mrWplaceGalleryImageKeys = new Set(imageKeys);

  console.log(`🧑‍🎨 : Gallery images sync complete - success: ${successCount}, failed: ${failCount}, total tiles: ${totalTileCount}`);
  console.log("🧑‍🎨 : Gallery images updated and synced to overlay layers:", data.images.length);

  // Log memory usage after processing (Chrome only)
  const memoryAfterProcessing = (performance as any).memory?.usedJSHeapSize;
  if (memoryAfterProcessing) {
    console.log(`🧑‍🎨 (inject): Memory after gallery processing: ${(memoryAfterProcessing / 1024 / 1024).toFixed(2)}MB`);
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
      console.log(`🧑‍🎨 : Added snapshot ${snapshot.key} to overlay at (${snapshot.tileX}, ${snapshot.tileY})`);
    } catch (error) {
      console.error(`🧑‍🎨 : Failed to add snapshot ${snapshot.key} to overlay layers:`, error);
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
        [textLayer.coords.TLX, textLayer.coords.TLY, textLayer.coords.PxX, textLayer.coords.PxY],
        textLayer.key,
        { skip: true } // Don't compute stats for text layers
      );

      textLayerKeys.push(textLayer.key);
      console.log(`🧑‍🎨 : Added text layer ${textLayer.key} to overlay at (${textLayer.coords.TLX}, ${textLayer.coords.TLY})`);
    } catch (error) {
      console.error(`🧑‍🎨 : Failed to add text layer ${textLayer.key} to overlay layers:`, error);
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
    type: 'gallery' | 'text' | 'snapshot';
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
  const repository = window.mrWplace?.layerRepository;

  if (!repository) {
    console.warn('🧑‍🎨 : LayerRepository not initialized, skipping layer save');
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
        source: 'mr-wplace-layer-save-response',
        layerId: data.layer.id,
        success: true
      },
      '*'
    );
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to save layer ${data.layer.id}:`, error);

    // Send error response
    window.postMessage(
      {
        source: 'mr-wplace-layer-save-response',
        layerId: data.layer.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      '*'
    );
  }
};
