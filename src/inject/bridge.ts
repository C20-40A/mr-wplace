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
  handleOverlayLightweightModeUpdate,
  handleSelectedColorOnlyMarkUpdate,
  handleColorFilterUpdate,
  handleCacheClear,
  handleFrontTileLayerUpdate,
  handleTransparentPixelFilterUpdate,
  handleSnapshotCaptureUpdate,
} from "./handlers/state-handlers";
import {
  handleStatsRequest,
  handlePixelColorRequest,
  handleTilePixelColorRequest,
  handleConnectedTileRegionRequest,
  handleTileStatsRequest,
  handleImageStatsRequest,
  handleAdjustPreviewRequest,
  handleAdjustPreviewSessionRelease,
  handleComputeTotalStats,
  handleMapCenterRequest,
  handleMapPixelsFromScreenRequest,
  handleMapProjectionTrackingUpdate,
  handleScreenPointsFromMapPixelsRequest,
  handleTransparencyPreviewRequest,
  handleOriginalTileRequest,
  handleMapThumbnailRequest,
} from "./handlers/request-handlers";
import {
  setDraftModeEnabled,
  clearAllDraft,
  handleDraftExportRequest,
  handleDraftSeedRequest,
} from "./features/draft-draw";
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
  exportSnapshotsToZip,
  type SnapshotExportScope,
} from "./utils/snapshot-io";
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
import { startArtCruise, stopArtCruise } from "./features/art-cruise";
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
import { ensureUserDataAvailable } from "./features/user-status/user-data-recovery";

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
 * Handle gallery export request (Worker-based, off-thread ZIP)
 */
const handleGalleryExport = async (data: {
  requestId: string;
  workerUrl: string;
  format?: "png" | "wplace";
}): Promise<void> => {
  const { requestId, workerUrl, format } = data;
  try {
    const result = await exportAndDownload(workerUrl, format, (progress) => {
      window.postMessage(
        {
          source: "mr-wplace-gallery-export-response",
          requestId,
          type: "progress",
          progress,
        },
        "*",
      );
    });
    window.postMessage(
      {
        source: "mr-wplace-gallery-export-response",
        requestId,
        type: result.status,
        count: result.count,
      },
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-gallery-export-response",
        requestId,
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
    );
  }
};

/**
 * Handle snapshot export request (Worker-based, off-thread ZIP)
 */
const handleSnapshotExport = async (data: {
  requestId: string;
  workerUrl: string;
  scope: "all" | "tile";
  tileX?: number;
  tileY?: number;
}): Promise<void> => {
  const { requestId, workerUrl } = data;
  const scope: SnapshotExportScope =
    data.scope === "tile"
      ? { scope: "tile", tileX: data.tileX!, tileY: data.tileY! }
      : { scope: "all" };

  try {
    const result = await exportSnapshotsToZip(workerUrl, scope, {
      onProgress: (progress) => {
        window.postMessage(
          {
            source: "mr-wplace-snapshot-export-response",
            requestId,
            type: "progress",
            progress,
          },
          "*",
        );
      },
    });

    window.postMessage(
      {
        source: "mr-wplace-snapshot-export-response",
        requestId,
        type: result.status,
        count: result.count,
      },
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-snapshot-export-response",
        requestId,
        type: "error",
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

const handleUserDataRecoveryRequest = async (data: {
  reason?: string;
}): Promise<void> => {
  await ensureUserDataAvailable(data.reason || "manual-request");
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
  "mr-wplace-overlay-lightweight-mode": handleOverlayLightweightModeUpdate,
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
  [AREA_MESSAGE_SOURCE.REGIONS_SYNC]: (data) =>
    setAreaRegions(data.regions || []),
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
  "mr-wplace-art-cruise-update": (data) =>
    data.enabled ? startArtCruise(data) : stopArtCruise(),
  "mr-wplace-cache-clear": handleCacheClear,
  "mr-wplace-front-tile-layer-update": handleFrontTileLayerUpdate,
  "mr-wplace-transparent-pixel-filter-update":
    handleTransparentPixelFilterUpdate,
  "mr-wplace-snapshot-capture-update": handleSnapshotCaptureUpdate,
  "mr-wplace-gallery-images-v2": handleGalleryImagesV2,
  "mr-wplace-snapshots": handleSnapshotsUpdate,
  "mr-wplace-text-layers": handleTextLayersUpdate,
  "mr-wplace-draft-mode-update": (data) => setDraftModeEnabled(data.enabled),
  "mr-wplace-draft-clear": () => clearAllDraft(),
  "mr-wplace-request-draft-export": handleDraftExportRequest,
  "mr-wplace-request-draft-seed": handleDraftSeedRequest,
  "mr-wplace-request-stats": handleStatsRequest,
  "mr-wplace-request-pixel-color": handlePixelColorRequest,
  "mr-wplace-request-tile-pixel-color": handleTilePixelColorRequest,
  "mr-wplace-request-connected-tile-region": handleConnectedTileRegionRequest,
  "mr-wplace-request-tile-stats": handleTileStatsRequest,
  "mr-wplace-request-image-stats": handleImageStatsRequest,
  "mr-wplace-request-adjust-preview": handleAdjustPreviewRequest,
  "mr-wplace-adjust-preview-session-release": handleAdjustPreviewSessionRelease,
  "mr-wplace-request-map-thumbnail": handleMapThumbnailRequest,
  "mr-wplace-request-map-center": handleMapCenterRequest,
  "mr-wplace-request-map-pixels-from-screen": handleMapPixelsFromScreenRequest,
  "mr-wplace-map-projection-tracking": handleMapProjectionTrackingUpdate,
  "mr-wplace-request-screen-points-from-map-pixels":
    handleScreenPointsFromMapPixelsRequest,
  "mr-wplace-request-transparency-preview": handleTransparencyPreviewRequest,
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
  "mr-wplace-snapshot-export": handleSnapshotExport,
  "mr-wplace-request-user-data": handleUserDataRecoveryRequest,
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
