import {
  addImageToOverlayLayers,
  removePreparedOverlayImageByKey,
} from "../features/tile-draw";
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
  // Note: Explicit cache invalidation removed.
  // stateVersion in last-modified-cache.ts handles this automatically:
  // - overlayLayers changes → stateVersion changes → cache auto-clears on next checkStateChanged()

  // Remove previously tracked gallery images from overlay layers
  if (window.mrWplaceGalleryImageKeys) {
    for (const key of window.mrWplaceGalleryImageKeys) {
      removePreparedOverlayImageByKey(key);
    }
  }

  // Re-import overlayLayers after removal (removePreparedOverlayImageByKey replaces the array)
  const { overlayLayers: currentOverlayLayers } = await import(
    "../features/tile-draw"
  );

  const imageKeys: string[] = [];

  // Sort by zIndex (ascending: lower zIndex = bottom layer = first in array)
  const sortedItems = [...data.items].sort((a, b) => a.zIndex - b.zIndex);

  // Process each visible item with coords
  for (const item of sortedItems) {
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
      coords: [
        item.coords.TLX,
        item.coords.TLY,
        item.coords.PxX,
        item.coords.PxY,
      ],
      tiles: null, // Tiles loaded on-demand from IndexedDB v2
      imageKey: item.id,
      drawEnabled: true,
      isOptimized: true, // v2 items are always optimized
      bounds,
      affectedTiles: item.affectedTiles,
      affectedTileSet: new Set(item.affectedTiles),
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
 *
 * Note: Receives only draw state info, loads actual data from IndexedDB
 */
export const handleSnapshotsUpdate = async (data: {
  snapshotDrawStates: Array<{
    snapshotId: string;
    key: string;
    tileX: number;
    tileY: number;
  }>;
}): Promise<void> => {
  const { getSnapshotRepository } = await import("../db/snapshot-repository");

  if (!window.mrWplaceSnapshots) {
    window.mrWplaceSnapshots = new Map();
  }

  // Remove previously tracked snapshots from overlay layers
  if (window.mrWplaceSnapshotKeys) {
    for (const key of window.mrWplaceSnapshotKeys) {
      removePreparedOverlayImageByKey(key);
    }
  }

  // Clear snapshots
  window.mrWplaceSnapshots.clear();

  // Add each snapshot to overlay layers (load from IndexedDB)
  const snapshotKeys: string[] = [];
  const repository = getSnapshotRepository();

  for (const drawState of data.snapshotDrawStates) {
    try {
      // Load snapshot blob from IndexedDB
      const blob = await repository.getSnapshot(drawState.snapshotId);
      if (!blob) {
        console.warn(
          `🧑‍🎨 : Snapshot ${drawState.snapshotId} not found in IndexedDB`
        );
        continue;
      }

      // Convert blob to dataUrl for bitmap loading
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const bitmap = await loadImageBitmap(dataUrl, drawState.key);

      await addImageToOverlayLayers(
        bitmap,
        [drawState.tileX, drawState.tileY, 0, 0],
        drawState.key
      );

      // Store snapshot info for reference
      window.mrWplaceSnapshots.set(drawState.key, {
        key: drawState.key,
        tileX: drawState.tileX,
        tileY: drawState.tileY,
      });

      snapshotKeys.push(drawState.key);
      console.log(
        `🧑‍🎨 : Added snapshot ${drawState.key} to overlay at (${drawState.tileX}, ${drawState.tileY})`
      );
    } catch (error) {
      console.error(
        `🧑‍🎨 : Failed to add snapshot ${drawState.key} to overlay layers:`,
        error
      );
    }
  }

  // Save current snapshot keys for next update
  window.mrWplaceSnapshotKeys = new Set(snapshotKeys);

  console.log(`🧑‍🎨 : Snapshots updated: ${snapshotKeys.length} active`);
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

      await addImageToOverlayLayers(
        bitmap,
        [
          textLayer.coords.TLX,
          textLayer.coords.TLY,
          textLayer.coords.PxX,
          textLayer.coords.PxY,
        ],
        textLayer.key
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
