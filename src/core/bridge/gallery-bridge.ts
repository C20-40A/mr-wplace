/**
 * Gallery Bridge - Content ↔ Inject communication for gallery images
 *
 * NOTE: Migration後は新しいIndexedDB v2を使用
 */

import {
  getAllGalleryMetadata,
  getGalleryImageDataUrl,
} from "./gallery-storage-bridge";

/**
 * Send gallery images to inject side for tile processing
 *
 * IMPORTANT: Call this after any gallery image changes (add, move, toggle, delete)
 *
 * New flow (v2):
 * 1. Get all metadata from IndexedDB v2
 * 2. Send metadata to inject side
 * 3. Inject side uses metadata.affectedTiles for efficient tile lookup
 */
export const sendGalleryImagesToInject = async () => {
  try {
    const metadata = await getAllGalleryMetadata();

    // Filter to items with coords (drawable items)
    const drawableItems = metadata
      .filter((m) => m.coords)
      .sort((a, b) => a.zIndex - b.zIndex);

    const messageData = {
      source: "mr-wplace-gallery-images-v2",
      items: drawableItems,
    };

    console.log(
      `🧑‍🎨 : [sendGalleryImagesToInject] Sending ${drawableItems.length} gallery Metadata to inject side (v2)`
    );

    window.postMessage(messageData, "*");
  } catch (error) {
    console.error(
      "🧑‍🎨 : [sendGalleryImagesToInject] Failed to send gallery images:",
      error
    );
  }
};

/**
 * Request total stats computation for a newly saved image
 * Called after image is saved to storage
 */
export const requestTotalStatsComputation = async (imageKey: string) => {
  // Get full image from IndexedDB v2
  const dataUrl = await getGalleryImageDataUrl(imageKey);
  if (!dataUrl) {
    console.warn(`🧑‍🎨 : Cannot compute stats - image not found: ${imageKey}`);
    return;
  }

  window.postMessage(
    {
      source: "mr-wplace-compute-total-stats",
      imageKey,
      dataUrl,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Requested total stats computation for ${imageKey}`);
};
