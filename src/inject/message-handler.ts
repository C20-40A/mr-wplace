import {
  handleGalleryImages,
  handleSnapshotsUpdate,
  handleTextLayersUpdate,
  handleLayerSave,
  handleSaveImageRequest,
} from "./handlers/overlay-handlers";
import {
  handleThemeUpdate,
  handleDataSaverUpdate,
  handleCacheSizeUpdate,
  handleComputeDeviceUpdate,
  handleShowUnplacedOnlyUpdate,
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
import {
  setupIndexedDBBridgeHandlers,
} from "./handlers/indexeddb-bridge-handlers";
import {
  startAutoCanvasClick,
  stopAutoCanvasClick,
} from "./auto-canvas-click";

type MessageHandler = (data: any) => void | Promise<void>;

const messageHandlers: Record<string, MessageHandler> = {
  "mr-wplace-processed": handleProcessedBlob,
  "wplace-studio-flyto": handleFlyTo,
  "mr-wplace-theme-update": handleThemeUpdate,
  "mr-wplace-data-saver-update": handleDataSaverUpdate,
  "mr-wplace-cache-size-update": handleCacheSizeUpdate,
  "mr-wplace-compute-device": handleComputeDeviceUpdate,
  "mr-wplace-show-unplaced-only": handleShowUnplacedOnlyUpdate,
  "mr-wplace-color-filter": handleColorFilterUpdate,
  "mr-wplace-tile-boundaries-update": handleTileBoundariesUpdate,
  "mr-wplace-cache-clear": handleCacheClear,
  "mr-wplace-gallery-images": handleGalleryImages,
  "mr-wplace-snapshots": handleSnapshotsUpdate,
  "mr-wplace-text-layers": handleTextLayersUpdate,
  "mr-wplace-layer-save": handleLayerSave,
  "mr-wplace-save-image-request": handleSaveImageRequest,
  "mr-wplace-request-stats": handleStatsRequest,
  "mr-wplace-request-pixel-color": handlePixelColorRequest,
  "mr-wplace-request-tile-stats": handleTileStatsRequest,
  "mr-wplace-request-image-stats": handleImageStatsRequest,
  "mr-wplace-compute-total-stats": handleComputeTotalStats,
  "mr-wplace-auto-canvas-click-start": startAutoCanvasClick,
  "mr-wplace-auto-canvas-click-stop": stopAutoCanvasClick,
};

export const setupMessageHandler = (): void => {
  setupIndexedDBBridgeHandlers();

  window.addEventListener("message", async (event: MessageEvent) => {
    const { source } = event.data;
    const handler = messageHandlers[source];

    if (handler) {
      await handler(event.data);
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
