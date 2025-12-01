/**
 * Gallery Bridge - Content ↔ Inject communication for gallery images
 */

/**
 * Send gallery images to inject side for tile processing
 * IMPORTANT: Call this after any gallery image changes (add, move, toggle, delete)
 * Also sends stored statistics for restoration after reload
 */
export const sendGalleryImagesToInject = async () => {
  const { GalleryStorage } = await import("@/states/galleryStorage");
  const galleryStorage = new GalleryStorage();
  const images = await galleryStorage.getAll(); // Send thumbnails only (lightweight)

  // Send ALL images with drawPosition (including disabled ones)
  // Inject side will handle IndexedDB storage for all items
  // But only add enabled items to overlay layers
  const allImages = images
    .filter((img) => img.drawPosition)
    .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0));

  const messageData = {
    source: "mr-wplace-gallery-images",
    images: allImages,
  };

  // Log data size for performance monitoring
  const dataSize = JSON.stringify(messageData).length;
  const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
  console.log(
    `🧑‍🎨 : Sending ${allImages.length} gallery images to inject side (${dataSizeMB}MB)`
  );

  window.postMessage(messageData, "*");

  console.log(`🧑‍🎨 : Sent ${allImages.length} gallery images to inject side`);
};

/**
 * Request total stats computation for a newly saved image
 * Called after image is saved to storage
 */
export const requestTotalStatsComputation = (
  imageKey: string,
  dataUrl: string
) => {
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
