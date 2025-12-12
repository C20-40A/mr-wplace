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

  console.log(
    `🧑‍🎨 : flyTo from (${currentCenter.lat.toFixed(2)}, ${currentCenter.lng.toFixed(
      2
    )}, z${currentZoom}) to (${lat.toFixed(2)}, ${lng.toFixed(2)}, z${zoom})`
  );

  window.wplaceMap.flyTo({ center: [lng, lat], zoom });
};

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
