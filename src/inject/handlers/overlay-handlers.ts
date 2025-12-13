import {
  addImageToOverlayLayers,
  removePreparedOverlayImageByKey,
} from "../tile-draw";
import { loadImageBitmap } from "../utils/image-loader";

/**
 * Handle gallery images v2 (IndexedDB v2 based)
 * Uses metadata with affectedTiles for efficient tile lookup
 */
export const handleGalleryImagesV2 = async (data: {
  items: Array<{
    id: string;
    title?: string;
    coords?: { TLX: number; TLY: number; PxX: number; PxY: number };
    width: number;
    height: number;
    affectedTiles: string[];
    visible: boolean;
    zIndex: number;
    timestamp: number;
  }>;
}): Promise<void> => {
  const { overlayLayers } = await import("../tile-draw");
  const { invalidateTileCache } = await import("../cache-storage");

  // Collect all affected tiles (old and new) for cache invalidation
  const tilesToInvalidate = new Set<string>();

  // Collect old affected tiles from existing layers
  for (const layer of overlayLayers) {
    if (layer.affectedTiles) {
      for (const tileKey of layer.affectedTiles) {
        tilesToInvalidate.add(tileKey);
      }
    }
  }

  // Collect new affected tiles from incoming items
  for (const item of data.items) {
    if (item.affectedTiles) {
      for (const tileKey of item.affectedTiles) {
        tilesToInvalidate.add(tileKey);
      }
    }
  }

  // Invalidate cache for all affected tiles
  for (const tileKey of tilesToInvalidate) {
    invalidateTileCache(tileKey).catch((err) => {
      console.warn(`🧑‍🎨 : Failed to invalidate tile cache ${tileKey}:`, err);
    });
  }

  if (tilesToInvalidate.size > 0) {
    console.log(`🧑‍🎨 : Invalidated ${tilesToInvalidate.size} tile caches`);
  }

  // Remove previously tracked gallery images from overlay layers
  if (window.mrWplaceGalleryImageKeys) {
    for (const key of window.mrWplaceGalleryImageKeys) {
      removePreparedOverlayImageByKey(key);
    }
  }

  // Re-import overlayLayers after removal (removePreparedOverlayImageByKey replaces the array)
  const { overlayLayers: currentOverlayLayers } = await import("../tile-draw");

  const imageKeys: string[] = [];

  // Process each visible item with coords
  for (const item of data.items) {
    if (!item.visible || !item.coords) continue;

    // Calculate bounds from coords and dimensions
    const bounds = {
      top: item.coords.TLY * 1000 + item.coords.PxY,
      left: item.coords.TLX * 1000 + item.coords.PxX,
      right: item.coords.TLX * 1000 + item.coords.PxX + item.width,
      bottom: item.coords.TLY * 1000 + item.coords.PxY + item.height,
    };

    // Add directly to overlay layers with affectedTiles for efficient lookup
    currentOverlayLayers.push({
      coords: [item.coords.TLX, item.coords.TLY, item.coords.PxX, item.coords.PxY],
      tiles: null, // Tiles loaded on-demand from IndexedDB v2
      imageKey: item.id,
      drawEnabled: true,
      isOptimized: true, // v2 items are always optimized
      bounds,
      affectedTiles: item.affectedTiles,
    });

    imageKeys.push(item.id);
    console.log(
      `🧑‍🎨 : Registered v2 layer ${item.id} (${item.affectedTiles.length} affected tiles)`
    );
  }

  // Save current image keys for next update
  window.mrWplaceGalleryImageKeys = new Set(imageKeys);

  console.log(
    `🧑‍🎨 : Gallery images v2 sync complete - ${imageKeys.length} layers registered`
  );
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
