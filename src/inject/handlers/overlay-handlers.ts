import {
  addImageToOverlayLayers,
  removePreparedOverlayImageByKey,
  removeOverlayImageByKey,
} from "../features/tile-draw";
import { loadImageBitmap } from "../utils/image-loader";
import { refreshFrontTileLayer } from "../features/map-instance";
import type { TileDrawInstance } from "../features/tile-draw/types";
import type { SnapshotImage, TextLayer } from "../types";

const hasSameAffectedTiles = (
  previous: string[] | undefined,
  next: string[]
): boolean => {
  if (!previous || previous.length !== next.length) return false;
  return previous.every((tileKey, index) => tileKey === next[index]);
};

const shouldPreserveGalleryStats = (
  previousLayer: TileDrawInstance | undefined,
  nextItem:
    | {
        id: string;
        coords?: { TLX: number; TLY: number; PxX: number; PxY: number };
        width: number;
        height: number;
        affectedTiles: string[];
        visible: boolean;
        zIndex: number;
        timestamp: number;
      }
    | undefined
): boolean => {
  if (!previousLayer || !nextItem?.coords) return false;
  if (previousLayer.timestamp !== nextItem.timestamp) return false;

  const [prevTLX, prevTLY, prevPxX, prevPxY] = previousLayer.coords;
  const { TLX, TLY, PxX, PxY } = nextItem.coords;
  if (
    prevTLX !== TLX ||
    prevTLY !== TLY ||
    prevPxX !== PxX ||
    prevPxY !== PxY
  )
    return false;

  if (!previousLayer.bounds) return false;

  const width = previousLayer.bounds.right - previousLayer.bounds.left;
  const height = previousLayer.bounds.bottom - previousLayer.bounds.top;
  if (width !== nextItem.width || height !== nextItem.height) return false;

  if (!hasSameAffectedTiles(previousLayer.affectedTiles, nextItem.affectedTiles))
    return false;

  return true;
};

const removeTrackedOverlayKeys = (keys?: Set<string>): void => {
  if (!keys) return;
  for (const key of keys) removePreparedOverlayImageByKey(key);
};

const replaceTrackedMap = <T extends { key: string }>(
  current: Map<string, T> | undefined,
  items: T[]
): Map<string, T> => {
  const next = current ?? new Map<string, T>();
  next.clear();
  for (const item of items) next.set(item.key, item);
  return next;
};

const updateTrackedKeys = (items: Array<{ key: string }>): Set<string> => {
  return new Set(items.map((item) => item.key));
};

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

  const previousGalleryLayers = new Map<string, TileDrawInstance>();
  const { overlayLayers: existingOverlayLayers } = await import(
    "../features/tile-draw"
  );
  for (const layer of existingOverlayLayers) {
    if (!window.mrWplaceGalleryImageKeys?.has(layer.imageKey)) continue;
    previousGalleryLayers.set(layer.imageKey, layer);
  }
  const nextItemsById = new Map(data.items.map((item) => [item.id, item]));

  // Remove previously tracked gallery images from overlay layers
  if (window.mrWplaceGalleryImageKeys) {
    for (const key of window.mrWplaceGalleryImageKeys) {
      removeOverlayImageByKey(key, {
        preserveStats: shouldPreserveGalleryStats(
          previousGalleryLayers.get(key),
          nextItemsById.get(key)
        ),
      });
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
      timestamp: item.timestamp,
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
  refreshFrontTileLayer();
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

  removeTrackedOverlayKeys(window.mrWplaceSnapshotKeys);
  window.mrWplaceSnapshots = replaceTrackedMap<SnapshotImage>(
    window.mrWplaceSnapshots,
    []
  );

  // Add each snapshot to overlay layers (load from IndexedDB)
  const snapshots: SnapshotImage[] = [];
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

      const snapshot = {
        key: drawState.key,
        tileX: drawState.tileX,
        tileY: drawState.tileY,
      };
      window.mrWplaceSnapshots.set(drawState.key, snapshot);

      snapshots.push(snapshot);
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
  window.mrWplaceSnapshotKeys = updateTrackedKeys(snapshots);

  console.log(`🧑‍🎨 : Snapshots updated: ${snapshots.length} active`);
  refreshFrontTileLayer();
};

/**
 * Handle text layers update from content script
 * Text layers are dynamically placed text overlays
 */
export const handleTextLayersUpdate = async (data: {
  textLayers: TextLayer[];
}): Promise<void> => {
  removeTrackedOverlayKeys(window.mrWplaceTextLayerKeys);
  window.mrWplaceTextLayers = replaceTrackedMap(
    window.mrWplaceTextLayers,
    data.textLayers
  );

  // Add each text layer to overlay layers
  const syncedTextLayers: TextLayer[] = [];
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

      syncedTextLayers.push(textLayer);
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
  window.mrWplaceTextLayerKeys = updateTrackedKeys(syncedTextLayers);

  console.log(`🧑‍🎨 : Text layers updated: ${data.textLayers.length} active`);
  refreshFrontTileLayer();
};
