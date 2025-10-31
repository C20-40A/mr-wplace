import { applyTheme } from "./theme-manager";
import {
  addImageToOverlayLayers,
  getAggregatedColorStats,
  getOverlayPixelColor,
  perTileColorStats,
} from "./tile-draw";

/**
 * Setup message event listener for handling various events
 */
export const setupMessageHandler = (): void => {
  window.addEventListener("message", async (event: MessageEvent) => {
    // Handle processed blob from content script
    if (event.data.source === "mr-wplace-processed") {
      handleProcessedBlob(event.data);
      return;
    }

    // Handle flyTo requests from content script
    if (event.data.source === "wplace-studio-flyto") {
      handleFlyTo(event.data);
      return;
    }

    // Handle theme updates
    if (event.data.source === "mr-wplace-theme-update") {
      handleThemeUpdate(event.data);
      return;
    }

    // Handle data saver updates
    if (event.data.source === "mr-wplace-data-saver-update") {
      handleDataSaverUpdate(event.data);
      return;
    }

    // Handle gallery images update from content script
    if (event.data.source === "mr-wplace-gallery-images") {
      await handleGalleryImages(event.data);
      return;
    }

    // Handle compute device update
    if (event.data.source === "mr-wplace-compute-device") {
      handleComputeDeviceUpdate(event.data);
      return;
    }

    // Handle color filter manager update
    if (event.data.source === "mr-wplace-color-filter") {
      handleColorFilterUpdate(event.data);
      return;
    }

    // Handle requests from content script
    if (event.data.source === "mr-wplace-request-stats") {
      handleStatsRequest(event.data);
      return;
    }

    if (event.data.source === "mr-wplace-request-pixel-color") {
      await handlePixelColorRequest(event.data);
      return;
    }

    if (event.data.source === "mr-wplace-request-tile-stats") {
      handleTileStatsRequest(event.data);
      return;
    }
  });
};

/**
 * Handle processed blob callback
 */
const handleProcessedBlob = (data: any): void => {
  const { blobID, processedBlob } = data;
  const callback = window.tileProcessingQueue?.get(blobID);

  if (typeof callback === "function") {
    callback(processedBlob);
    window.tileProcessingQueue?.delete(blobID);
  }
};

/**
 * Handle flyTo/jumpTo requests
 */
const handleFlyTo = (data: {
  lat: number;
  lng: number;
  zoom: number;
}): void => {
  const { lat, lng, zoom } = data;

  // If map instance not available, fallback to URL navigation
  if (!window.wplaceMap) {
    console.log("🧑‍🎨 : Map instance not available, using URL navigation");
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
    return;
  }

  // Get current position
  const currentCenter = window.wplaceMap.getCenter();
  const currentZoom = window.wplaceMap.getZoom();

  // Calculate distance (simple lat/lng difference)
  const latDiff = Math.abs(currentCenter.lat - lat);
  const lngDiff = Math.abs(currentCenter.lng - lng);
  const zoomDiff = Math.abs(currentZoom - zoom);

  // If close enough (within ~1km and zoom difference <= 2), use flyTo for smooth animation
  // Otherwise use jumpTo for instant navigation
  const isClose = latDiff < 2 && lngDiff < 2 && zoomDiff <= 2;

  if (isClose) {
    console.log("🧑‍🎨 : Using flyTo (close distance)");
    window.wplaceMap.flyTo({ center: [lng, lat], zoom });
  } else {
    console.log("🧑‍🎨 : Using jumpTo (far distance)");
    window.wplaceMap.jumpTo({ center: [lng, lat], zoom });
  }
};

/**
 * Handle theme update
 */
const handleThemeUpdate = (data: { theme: "light" | "dark" }): void => {
  const theme = data.theme;
  console.log("🧑‍🎨 : Theme updated:", theme);

  if (window.wplaceMap) {
    applyTheme(window.wplaceMap, theme);
  }
};

/**
 * Handle data saver update
 */
const handleDataSaverUpdate = (data: { enabled: boolean }): void => {
  if (window.mrWplaceDataSaver) {
    window.mrWplaceDataSaver.enabled = data.enabled;
    console.log("🧑‍🎨 : Data saver updated:", data.enabled);
  }
};

/**
 * Handle gallery images data from content script
 * Store in window for tile processing and sync to overlay layers
 */
const handleGalleryImages = async (data: {
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

  for (const img of sortedImages) {
    try {
      // Use Image object instead of fetch to avoid WASM issues in inject context
      const imageElement = new Image();
      imageElement.src = img.dataUrl;

      await new Promise<void>((resolve, reject) => {
        imageElement.onload = () => resolve();
        imageElement.onerror = (e) => reject(new Error(`Failed to load image ${img.key}: ${e}`));
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error(`Timeout loading image ${img.key}`)), 5000);
      });

      // Convert Image to ImageBitmap
      const bitmap = await createImageBitmap(imageElement);

      await addImageToOverlayLayers(
        bitmap,
        [img.drawPosition.TLX, img.drawPosition.TLY, img.drawPosition.PxX, img.drawPosition.PxY],
        img.key
      );

      successCount++;
    } catch (error) {
      failCount++;
      console.error(`🧑‍🎨 : Failed to add image ${img.key} to overlay layers:`, error);
    }
  }

  console.log(`🧑‍🎨 : Gallery images sync complete - success: ${successCount}, failed: ${failCount}`);

  // Clear tile cache to force re-rendering with new images
  if (window.mrWplaceDataSaver?.tileCache) {
    window.mrWplaceDataSaver.tileCache.clear();
    console.log("🧑‍🎨 : Cleared tile cache after gallery update");
  }

  console.log("🧑‍🎨 : Gallery images updated and synced to overlay layers:", data.images.length);
};

/**
 * Handle compute device update
 */
const handleComputeDeviceUpdate = (data: { device: "gpu" | "cpu" }): void => {
  window.mrWplaceComputeDevice = data.device;
  console.log("🧑‍🎨 : Compute device updated:", data.device);

  // Clear tile cache to force re-rendering with new device
  if (window.mrWplaceDataSaver?.tileCache) {
    window.mrWplaceDataSaver.tileCache.clear();
    console.log("🧑‍🎨 : Cleared tile cache after compute device update");
  }
};

/**
 * Handle color filter manager update
 */
const handleColorFilterUpdate = (data: {
  isFilterActive: boolean;
  selectedRGBs?: number[][];
  enhancedMode: "dot" | "cross" | "fill" | "none";
}): void => {
  if (!window.mrWplace) {
    window.mrWplace = {};
  }

  window.mrWplace.colorFilterManager = {
    isFilterActive: () => data.isFilterActive,
    selectedRGBs: data.selectedRGBs,
    getEnhancedMode: () => data.enhancedMode,
  };

  console.log("🧑‍🎨 : Color filter updated:", data);

  // Clear tile cache to force re-rendering with new filter
  if (window.mrWplaceDataSaver?.tileCache) {
    window.mrWplaceDataSaver.tileCache.clear();
    console.log("🧑‍🎨 : Cleared tile cache after color filter update");
  }
};

/**
 * Handle aggregated color stats request
 */
const handleStatsRequest = (data: { imageKeys: string[]; requestId: string }): void => {
  const stats = getAggregatedColorStats(data.imageKeys);

  window.postMessage(
    {
      source: "mr-wplace-response-stats",
      requestId: data.requestId,
      stats,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent stats for ${data.imageKeys.length} images (request: ${data.requestId})`);
};

/**
 * Handle overlay pixel color request
 */
const handlePixelColorRequest = async (data: {
  lat: number;
  lng: number;
  requestId: string;
}): Promise<void> => {
  const color = await getOverlayPixelColor(data.lat, data.lng);

  window.postMessage(
    {
      source: "mr-wplace-response-pixel-color",
      requestId: data.requestId,
      color,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent pixel color for (${data.lat}, ${data.lng}) (request: ${data.requestId})`);
};

/**
 * Handle per-tile color stats request
 */
const handleTileStatsRequest = (data: { requestId: string }): void => {
  // Convert Map to serializable object
  const statsObject: Record<string, any> = {};

  for (const [imageKey, tileStatsMap] of perTileColorStats.entries()) {
    const tileStats: Record<string, any> = {};

    for (const [tileKey, stats] of tileStatsMap.entries()) {
      tileStats[tileKey] = {
        matched: Object.fromEntries(stats.matched),
        total: Object.fromEntries(stats.total),
      };
    }

    statsObject[imageKey] = tileStats;
  }

  window.postMessage(
    {
      source: "mr-wplace-response-tile-stats",
      requestId: data.requestId,
      stats: statsObject,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent tile stats (request: ${data.requestId})`);
};
