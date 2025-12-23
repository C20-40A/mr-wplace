import {
  handleGalleryImagesV2,
  handleSnapshotsUpdate,
  handleTextLayersUpdate,
} from "./handlers/overlay-handlers";
import {
  handleThemeUpdate,
  handleDataSaverUpdate,
  handleCacheSizeUpdate,
  handleComputeDeviceUpdate,
  handleShowUnplacedOnlyUpdate,
  handleColorFilterUpdate,
  handleCacheClear,
  handleLayerSortUpdate,
} from "./handlers/state-handlers";
import {
  handleStatsRequest,
  handlePixelColorRequest,
  handleTileStatsRequest,
  handleImageStatsRequest,
  handleComputeTotalStats,
} from "./handlers/request-handlers";
import { setupGalleryV2Handlers } from "./handlers/gallery-v2-handlers";
import { startAutoCanvasClick, stopAutoCanvasClick } from "./auto-canvas-click";
import {
  openFilePickerAndImport,
  exportAndDownload,
  resetGallery,
} from "./utils/gallery-io";
import {
  changeTileBoundaryVisibility,
  handleMapInstanceFlyTo,
} from "./features/map-instance";

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
 * Handle gallery import request
 */
const handleGalleryImport = async (data: {
  requestId: string;
}): Promise<void> => {
  try {
    const result = await openFilePickerAndImport();
    window.postMessage(
      {
        source: "mr-wplace-gallery-import-response",
        requestId: data.requestId,
        result,
      },
      "*"
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-gallery-import-response",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*"
    );
  }
};

/**
 * Handle gallery export request
 */
const handleGalleryExport = async (data: {
  requestId: string;
}): Promise<void> => {
  try {
    await exportAndDownload();
    window.postMessage(
      {
        source: "mr-wplace-gallery-export-response",
        requestId: data.requestId,
        success: true,
      },
      "*"
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-gallery-export-response",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*"
    );
  }
};

/**
 * Handle gallery reset request
 */
const handleGalleryReset = async (data: {
  requestId: string;
}): Promise<void> => {
  try {
    const count = await resetGallery();
    window.postMessage(
      {
        source: "mr-wplace-gallery-reset-response",
        requestId: data.requestId,
        count,
      },
      "*"
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-gallery-reset-response",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*"
    );
  }
};

const messageHandlers: Record<string, MessageHandler> = {
  "mr-wplace-processed": handleProcessedBlob,
  "mr-wplace-map-flyto": (data: { lat: number; lng: number; zoom: number }) =>
    handleMapInstanceFlyTo({ lat: data.lat, lng: data.lng, zoom: data.zoom }),
  "mr-wplace-theme-update": handleThemeUpdate,
  "mr-wplace-data-saver-update": handleDataSaverUpdate,
  "mr-wplace-cache-size-update": handleCacheSizeUpdate,
  "mr-wplace-compute-device": handleComputeDeviceUpdate,
  "mr-wplace-show-unplaced-only": handleShowUnplacedOnlyUpdate,
  "mr-wplace-color-filter": handleColorFilterUpdate,
  "mr-wplace-tile-boundaries-update": (data) =>
    changeTileBoundaryVisibility(data.visible),
  "mr-wplace-cache-clear": handleCacheClear,
  "mr-wplace-layer-sort-update": handleLayerSortUpdate,
  "mr-wplace-gallery-images-v2": handleGalleryImagesV2,
  "mr-wplace-snapshots": handleSnapshotsUpdate,
  "mr-wplace-text-layers": handleTextLayersUpdate,
  "mr-wplace-request-stats": handleStatsRequest,
  "mr-wplace-request-pixel-color": handlePixelColorRequest,
  "mr-wplace-request-tile-stats": handleTileStatsRequest,
  "mr-wplace-request-image-stats": handleImageStatsRequest,
  "mr-wplace-compute-total-stats": handleComputeTotalStats,
  "mr-wplace-auto-canvas-click-start": startAutoCanvasClick,
  "mr-wplace-auto-canvas-click-stop": stopAutoCanvasClick,
  "mr-wplace-gallery-import": handleGalleryImport,
  "mr-wplace-gallery-export": handleGalleryExport,
  "mr-wplace-gallery-reset": handleGalleryReset,
};

export const setupMessageHandler = (): void => {
  setupGalleryV2Handlers();

  window.addEventListener("message", async (event: MessageEvent) => {
    const { source } = event.data;
    const handler = messageHandlers[source];

    if (handler) await handler(event.data);
  });
};
