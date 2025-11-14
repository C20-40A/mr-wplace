import { addImageToOverlayLayers, removePreparedOverlayImageByKey } from "../tile-draw";
import { loadImageBitmap } from "../utils/image-loader";

/**
 * Handle gallery images data from content script
 * Store in window for tile processing and sync to overlay layers
 */
export const handleGalleryImages = async (data: {
  images: Array<{
    key: string;
    dataUrl: string;
    drawPosition: { TLX: number; TLY: number; PxX: number; PxY: number };
    layerOrder: number;
  }>;
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
  const imageKeys: string[] = [];

  for (const img of sortedImages) {
    try {
      const bitmap = await loadImageBitmap(img.dataUrl, img.key);

      await addImageToOverlayLayers(
        bitmap,
        [img.drawPosition.TLX, img.drawPosition.TLY, img.drawPosition.PxX, img.drawPosition.PxY],
        img.key
      );

      imageKeys.push(img.key);
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`🧑‍🎨 : Failed to add image ${img.key} to overlay layers:`, error);
    }
  }

  // Save current image keys for next update
  window.mrWplaceGalleryImageKeys = new Set(imageKeys);

  console.log(`🧑‍🎨 : Gallery images sync complete - success: ${successCount}, failed: ${failCount}`);
  console.log("🧑‍🎨 : Gallery images updated and synced to overlay layers:", data.images.length);
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
