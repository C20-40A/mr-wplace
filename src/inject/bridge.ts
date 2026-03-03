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
  handleSelectedColorOnlyMarkUpdate,
  handleColorFilterUpdate,
  handleCacheClear,
  handleFrontTileLayerUpdate,
  handleSnapshotCaptureUpdate,
} from "./handlers/state-handlers";
import {
  handleStatsRequest,
  handlePixelColorRequest,
  handleTileStatsRequest,
  handleImageStatsRequest,
  handleComputeTotalStats,
  handleMapCenterRequest,
  handleOriginalTileRequest,
} from "./handlers/request-handlers";
import { setupGalleryV2Handlers } from "./handlers/gallery-v2-handlers";
import { setupSnapshotHandlers } from "./handlers/snapshot-handlers";
import {
  startAutoCanvasClick,
  stopAutoCanvasClick,
} from "./features/developer/auto-canvas-click";
import {
  startAutoColorSpoit,
  stopAutoColorSpoit,
} from "./features/developer/auto-color-spoit";
import {
  startAreaFill,
  stopAreaFill,
  calculateAreaFillEstimate,
  resetAreaFillProgress,
} from "./features/developer/area-fill";
import {
  openFilePickerAndImport,
  exportAndDownload,
  resetGallery,
} from "./utils/gallery-io";
import {
  handleDangerousAuthInit,
  isDangerousMessageAuthorized,
} from "./security/message-auth";
import {
  changeTileBoundaryVisibility,
  changeBackgroundColor,
  changeMap3dEnabled,
  changeMap3dDragRotateEnabled,
  handleMapInstanceAreaGoto,
  getMapInstanceFromWplace,
  handleMapInstanceFlyTo,
} from "./features/map-instance";
import { setGridDisplayEnabled } from "./features/grid-display";
import { setScaleDisplayEnabled } from "./features/scale-display";
import {
  setAreaDisplayOptions,
  setAreaMeasureEnabled,
  setAreaRegions,
  startAreaRegionEdit,
  stopAreaRegionEdit,
  respondAreaRegionEditRequest,
} from "./features/area-display";
import { AREA_MESSAGE_SOURCE } from "@/constants/area-message";

type MessageHandler = (data: any) => void | Promise<void>;
const LOCATION_KEY = "location";
const DEFAULT_AREA_REGION_ZOOM = 11;

const getAreaRegionZoom = (): number => {
  const mapInstance = getMapInstanceFromWplace() as {
    getZoom?: () => number;
  } | null;
  const mapZoom = mapInstance?.getZoom?.();
  if (typeof mapZoom === "number" && Number.isFinite(mapZoom)) return mapZoom;

  try {
    const raw = window.localStorage.getItem(LOCATION_KEY);
    if (!raw) return DEFAULT_AREA_REGION_ZOOM;
    const location = JSON.parse(raw) as { zoom?: unknown };
    const zoom = location?.zoom;
    if (typeof zoom === "number" && Number.isFinite(zoom)) return zoom;
  } catch {
    // Ignore parse failure and use default zoom
  }

  return DEFAULT_AREA_REGION_ZOOM;
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
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-gallery-import-response",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
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
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-gallery-export-response",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
    );
  }
};

/**
 * Handle gallery reset request
 */
const handleGalleryReset = async (data: {
  requestId: string;
  auth?: unknown;
}): Promise<void> => {
  if (!isDangerousMessageAuthorized(data)) {
    window.postMessage(
      {
        source: "mr-wplace-gallery-reset-response",
        requestId: data.requestId,
        error: "Unauthorized request",
      },
      "*",
    );
    console.warn("🧑‍🎨 : Rejected unauthorized gallery reset request");
    return;
  }

  try {
    const count = await resetGallery();
    window.postMessage(
      {
        source: "mr-wplace-gallery-reset-response",
        requestId: data.requestId,
        count,
      },
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-gallery-reset-response",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
    );
  }
};

/**
 * Handle area fill estimate request
 */
const handleAreaFillEstimate = async (data: {
  requestId: string;
  corners: any;
  options: any;
}): Promise<void> => {
  try {
    const result = await calculateAreaFillEstimate(data.corners, data.options);
    window.postMessage(
      {
        source: "mr-wplace-area-fill-estimate-response",
        requestId: data.requestId,
        result,
      },
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-area-fill-estimate-response",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
    );
  }
};

const messageHandlers: Record<string, MessageHandler> = {
  "mr-wplace-auth-init": handleDangerousAuthInit,
  "mr-wplace-processed": handleProcessedBlob,
  "mr-wplace-map-flyto": (data: { lat: number; lng: number; zoom: number }) =>
    handleMapInstanceFlyTo({ lat: data.lat, lng: data.lng, zoom: data.zoom }),
  [AREA_MESSAGE_SOURCE.REGION_GOTO]: (data: {
    regionId: string;
    lng: number;
    lat: number;
    bounds?: unknown;
  }) => {
    const currentZoom = getAreaRegionZoom();
    handleMapInstanceAreaGoto({
      lat: data.lat,
      lng: data.lng,
      zoom: currentZoom,
      bounds: data.bounds,
    });
  },
  "mr-wplace-theme-update": handleThemeUpdate,
  "mr-wplace-data-saver-update": handleDataSaverUpdate,
  "mr-wplace-cache-size-update": handleCacheSizeUpdate,
  "mr-wplace-compute-device": handleComputeDeviceUpdate,
  "mr-wplace-show-unplaced-only": handleShowUnplacedOnlyUpdate,
  "mr-wplace-selected-color-only-mark": handleSelectedColorOnlyMarkUpdate,
  "mr-wplace-color-filter": handleColorFilterUpdate,
  "mr-wplace-tile-boundaries-update": (data) =>
    changeTileBoundaryVisibility(data.visible),
  "mr-wplace-grid-display-update": (data) =>
    setGridDisplayEnabled(data.visible),
  "mr-wplace-area-display-update": (data) =>
    setScaleDisplayEnabled(data.visible),
  [AREA_MESSAGE_SOURCE.MEASURE_UPDATE]: (data) =>
    setAreaMeasureEnabled(data.visible),
  [AREA_MESSAGE_SOURCE.REGIONS_SYNC]: (data) => setAreaRegions(data.regions || []),
  [AREA_MESSAGE_SOURCE.DISPLAY_OPTIONS_UPDATE]: (data) =>
    setAreaDisplayOptions(data.options || {}),
  [AREA_MESSAGE_SOURCE.REGION_EDIT_START]: (data) => startAreaRegionEdit(data),
  [AREA_MESSAGE_SOURCE.REGION_EDIT_STOP]: () => stopAreaRegionEdit(),
  [AREA_MESSAGE_SOURCE.REGION_EDIT_REQUEST]: (data) =>
    respondAreaRegionEditRequest(data),
  "mr-wplace-background-color-update": (data) =>
    changeBackgroundColor(data.color),
  "mr-wplace-map-3d-update": (data) => changeMap3dEnabled(data.enabled),
  "mr-wplace-map-3d-drag-rotate-update": (data) =>
    changeMap3dDragRotateEnabled(data.enabled),
  "mr-wplace-cache-clear": handleCacheClear,
  "mr-wplace-front-tile-layer-update": handleFrontTileLayerUpdate,
  "mr-wplace-snapshot-capture-update": handleSnapshotCaptureUpdate,
  "mr-wplace-gallery-images-v2": handleGalleryImagesV2,
  "mr-wplace-snapshots": handleSnapshotsUpdate,
  "mr-wplace-text-layers": handleTextLayersUpdate,
  "mr-wplace-request-stats": handleStatsRequest,
  "mr-wplace-request-pixel-color": handlePixelColorRequest,
  "mr-wplace-request-tile-stats": handleTileStatsRequest,
  "mr-wplace-request-image-stats": handleImageStatsRequest,
  "mr-wplace-request-map-center": handleMapCenterRequest,
  "mr-wplace-request-original-tile": handleOriginalTileRequest,
  "mr-wplace-compute-total-stats": handleComputeTotalStats,
  "mr-wplace-auto-canvas-click-start": startAutoCanvasClick,
  "mr-wplace-auto-canvas-click-stop": stopAutoCanvasClick,
  "mr-wplace-auto-color-spoit-start": startAutoColorSpoit,
  "mr-wplace-auto-color-spoit-stop": stopAutoColorSpoit,
  "mr-wplace-area-fill-start": (data: any) =>
    startAreaFill(data.corners, data.options),
  "mr-wplace-area-fill-stop": stopAreaFill,
  "mr-wplace-area-fill-reset": resetAreaFillProgress,
  "mr-wplace-area-fill-estimate": handleAreaFillEstimate,
  "mr-wplace-gallery-import": handleGalleryImport,
  "mr-wplace-gallery-export": handleGalleryExport,
  "mr-wplace-gallery-reset": handleGalleryReset,
};

export const setupMessageHandler = (): void => {
  setupGalleryV2Handlers();
  setupSnapshotHandlers();

  window.addEventListener("message", async (event: MessageEvent) => {
    const { source } = event.data;
    const handler = messageHandlers[source];

    if (handler) await handler(event.data);
  });
};
