import {
  handleGalleryImages,
  handleSnapshotsUpdate,
  handleTextLayersUpdate,
} from "./handlers/overlay-handlers";
import {
  handleThemeUpdate,
  handleDataSaverUpdate,
  handleCacheSizeUpdate,
  handleComputeDeviceUpdate,
  handleColorFilterUpdate,
  handleTileBoundariesUpdate,
  handleCacheClear,
} from "./handlers/state-handlers";
import {
  handleStatsRequest,
  handlePixelColorRequest,
  handleTileStatsRequest,
  handleImageStatsRequest,
  handleComputeTotalStats,
} from "./handlers/request-handlers";

/**
 * Setup message event listener for handling various events
 */
export const setupMessageHandler = (): void => {
  window.addEventListener("message", async (event: MessageEvent) => {
    const { source } = event.data;

    // Legacy processed blob handler
    if (source === "mr-wplace-processed") {
      handleProcessedBlob(event.data);
      return;
    }

    // Navigation handler
    if (source === "wplace-studio-flyto") {
      handleFlyTo(event.data);
      return;
    }

    // State update handlers
    if (source === "mr-wplace-theme-update") {
      handleThemeUpdate(event.data);
      return;
    }

    if (source === "mr-wplace-data-saver-update") {
      handleDataSaverUpdate(event.data);
      return;
    }

    if (source === "mr-wplace-cache-size-update") {
      handleCacheSizeUpdate(event.data);
      return;
    }

    if (source === "mr-wplace-compute-device") {
      handleComputeDeviceUpdate(event.data);
      return;
    }

    if (source === "mr-wplace-color-filter") {
      handleColorFilterUpdate(event.data);
      return;
    }

    if (source === "mr-wplace-tile-boundaries-update") {
      handleTileBoundariesUpdate(event.data);
      return;
    }

    if (source === "mr-wplace-cache-clear") {
      handleCacheClear();
      return;
    }

    // Overlay update handlers
    if (source === "mr-wplace-gallery-images") {
      await handleGalleryImages(event.data);
      return;
    }

    if (source === "mr-wplace-snapshots") {
      await handleSnapshotsUpdate(event.data);
      return;
    }

    if (source === "mr-wplace-text-layers") {
      await handleTextLayersUpdate(event.data);
      return;
    }

    // Request handlers
    if (source === "mr-wplace-request-stats") {
      handleStatsRequest(event.data);
      return;
    }

    if (source === "mr-wplace-request-pixel-color") {
      await handlePixelColorRequest(event.data);
      return;
    }

    if (source === "mr-wplace-request-tile-stats") {
      handleTileStatsRequest(event.data);
      return;
    }

    if (source === "mr-wplace-request-image-stats") {
      handleImageStatsRequest(event.data);
      return;
    }

    if (source === "mr-wplace-compute-total-stats") {
      await handleComputeTotalStats(event.data);
      return;
    }
  });
};

/**
 * Handle processed blob callback (legacy)
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
