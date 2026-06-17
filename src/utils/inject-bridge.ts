/**
 * Content ↔ Inject Communication Bridge
 *
 * This module provides functions to request data from the inject context (page context).
 * All functions use postMessage for cross-context communication with request/response pattern.
 */
import { withDangerousMessageAuth } from "@/core/bridge/inject-message-auth";
import type {
  ColorFlattenMode,
  DitheringMethod,
  ImageAdjustments,
  QuantizationMethod,
} from "@/features/gallery/routes/image-editor/canvas-processor";

let requestIdCounter = 0;
const generateRequestId = (): string => `req_${Date.now()}_${++requestIdCounter}`;

export type AdjustPreviewRequestParams = {
  sessionId: string;
  imageSrc: string;
  widthPx: number;
  heightPx: number;
  adjustments: ImageAdjustments;
  selectedColorIds: number[];
  ditheringEnabled: boolean;
  ditheringThreshold: number;
  ditheringMethod: DitheringMethod;
  quantizationMethod: QuantizationMethod;
  colorFlattenMode: ColorFlattenMode;
  outlineEnabled: boolean;
  outlineThreshold: number;
  outlineWidth: number;
  outlineUseFixedColor: boolean;
  outlineFixedColor: string;
};

export type TransparencyPreviewRequestParams = {
  imageSrc: string;
  mask: number[];
  width: number;
  height: number;
};

export type AdjustPreviewResult = {
  dataUrl: string;
  colorStats: Record<string, { matched: number; total: number }>;
};

export type ConnectedTileRegionResult = {
  kind: "success";
  dataUrl: string;
  width: number;
  height: number;
  pixelCount: number;
  origin: {
    TLX: number;
    TLY: number;
    PxX: number;
    PxY: number;
  };
};

export type ConnectedTileRegionTooLargeResult = {
  kind: "too-large";
  dataUrl: string;
  width: number;
  height: number;
  pixelCount: number;
  candidateColors: Array<[number, number, number, number]>;
};

/**
 * Request aggregated color stats from inject side
 * Used by: paint-stats, color-filter
 *
 * @param imageKeys - Array of image keys to get stats for
 * @returns Promise resolving to color stats (RGB key → matched/total counts)
 */
export const getAggregatedColorStats = async (
  imageKeys: string[]
): Promise<Record<string, { matched: number; total: number }>> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-stats" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-stats",
        imageKeys,
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Stats request timed out");
      resolve({});
    }, 5000);
  });
};

/**
 * Request tile pixel color from inject side
 *
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns Promise resolving to RGBA color or null if unavailable
 */
export const getTilePixelColor = async (
  lat: number,
  lng: number
): Promise<{ r: number; g: number; b: number; a: number } | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-tile-pixel-color" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.color);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-tile-pixel-color",
        lat,
        lng,
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Tile pixel color request timed out");
      resolve(null);
    }, 5000);
  });
};

/**
 * Request overlay pixel color from inject side
 * Used by: auto-spoit (pixel color detection)
 *
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns Promise resolving to RGBA color or null if no overlay at position
 */
export const getOverlayPixelColor = async (
  lat: number,
  lng: number
): Promise<{ r: number; g: number; b: number; a: number } | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-pixel-color" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.color);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-pixel-color",
        lat,
        lng,
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Pixel color request timed out");
      resolve(null);
    }, 5000);
  });
};

export const extractConnectedTileRegion = async (
  lat: number,
  lng: number,
  excludedColors: Array<[number, number, number, number]> = [],
  maxSelectedPixels?: number,
  includeDiagonals = true,
): Promise<ConnectedTileRegionResult | ConnectedTileRegionTooLargeResult | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-connected-tile-region" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);

        if (event.data.error) {
          reject(new Error(event.data.error));
          return;
        }

        resolve(event.data.result);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      {
        source: "mr-wplace-request-connected-tile-region",
        lat,
        lng,
        excludedColors,
        maxSelectedPixels,
        includeDiagonals,
        requestId,
      },
      "*",
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Connected tile region request timed out"));
    }, 5000);
  });
};

/**
 * Request per-tile color stats from inject side
 * Returns statistics organized by image key and tile key
 *
 * @returns Promise resolving to nested stats structure
 */
export const getPerTileColorStatsAll = async (): Promise<
  Record<string, Record<string, { matched: Record<string, number>; total: Record<string, number> }>>
> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-tile-stats" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-tile-stats",
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Tile stats request timed out");
      resolve({});
    }, 5000);
  });
};

/**
 * Request per-image aggregated stats from inject side
 * Used by: gallery list (progress bars)
 *
 * @param imageKeys - Array of image keys to get stats for
 * @returns Promise resolving to stats per image (image key → color stats)
 */
export const getStatsPerImage = async (
  imageKeys: string[]
): Promise<Record<string, { matched: Record<string, number>; total: Record<string, number> }>> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-image-stats" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-image-stats",
        imageKeys,
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Image stats request timed out");
      resolve({});
    }, 5000);
  });
};

export const renderAdjustPreviewInInject = async (
  params: AdjustPreviewRequestParams,
): Promise<AdjustPreviewResult> => {
  const requestId = generateRequestId();

  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-adjust-preview" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
          return;
        }
        resolve(event.data.result);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      {
        source: "mr-wplace-request-adjust-preview",
        requestId,
        params,
      },
      "*",
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Adjust preview request timed out"));
    }, 10000);
  });
};

export const releaseAdjustPreviewSessionInInject = (sessionId: string): void => {
  window.postMessage(
    {
      source: "mr-wplace-adjust-preview-session-release",
      sessionId,
    },
    "*",
  );
};

export const renderTransparencyPreviewInInject = async (
  params: TransparencyPreviewRequestParams,
): Promise<string> => {
  const requestId = generateRequestId();

  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-transparency-preview" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
          return;
        }
        resolve(event.data.dataUrl);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      {
        source: "mr-wplace-request-transparency-preview",
        requestId,
        params,
      },
      "*",
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Transparency preview request timed out"));
    }, 10000);
  });
};

/**
 * Send active snapshot draw states to inject side for overlay rendering
 * Used by: time-travel feature
 *
 * Note: Only sends draw state info (snapshotId, tileX, tileY).
 * Inject side loads actual snapshot data from IndexedDB.
 */
export const sendSnapshotsToInject = async () => {
  const { TimeTravelStorage } = await import("@/features/time-travel/storage");

  const drawStates = await TimeTravelStorage.getDrawStates();
  const enabledStates = drawStates.filter((s) => s.drawEnabled);

  // Send only draw state info - inject will load from IndexedDB
  const snapshotDrawStates = enabledStates.map((state) => ({
    snapshotId: state.fullKey.replace("tile_snapshot_", ""),
    key: `snapshot_${state.fullKey}`,
    tileX: state.tileX,
    tileY: state.tileY,
  }));

  console.log(
    `🧑‍🎨 : Sending ${snapshotDrawStates.length} snapshot draw states to inject side`
  );

  window.postMessage(
    {
      source: "mr-wplace-snapshots",
      snapshotDrawStates,
    },
    "*"
  );
};

/**
 * Toggle tmp tile snapshot capture in inject context
 * Used by: time-travel modal open/close
 */
export const sendSnapshotCaptureToInject = (enabled: boolean): void => {
  window.postMessage(
    {
      source: "mr-wplace-snapshot-capture-update",
      enabled,
    },
    "*"
  );
};

// ============================================
// Snapshot Repository Bridge Functions
// ============================================

export interface SnapshotMetadata {
  id: string;
  timestamp: number;
  tileX: number;
  tileY: number;
  name?: string;
}

/**
 * Get all snapshot metadata from inject side IndexedDB
 */
export const getAllSnapshotMetadata = async (): Promise<SnapshotMetadata[]> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-get-all-metadata-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result || []);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: "mr-wplace-snapshot-get-all-metadata", requestId }, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Get all snapshot metadata timed out");
      resolve([]);
    }, 5000);
  });
};

/**
 * Get snapshot metadata by tile coordinates
 */
export const getSnapshotMetadataByTile = async (
  tileX: number,
  tileY: number
): Promise<SnapshotMetadata[]> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-get-metadata-by-tile-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result || []);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      { source: "mr-wplace-snapshot-get-metadata-by-tile", requestId, tileX, tileY },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Get snapshot metadata by tile timed out");
      resolve([]);
    }, 5000);
  });
};

/**
 * Get snapshot blob as dataUrl
 */
export const getSnapshotDataUrl = async (id: string): Promise<string | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-get-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result || null);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: "mr-wplace-snapshot-get", requestId, id }, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Get snapshot timed out");
      resolve(null);
    }, 5000);
  });
};

/**
 * Save snapshot with metadata to inject side IndexedDB
 */
export const saveSnapshotToInject = async (
  id: string,
  dataUrl: string,
  metadata: SnapshotMetadata
): Promise<boolean> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-save-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result === true);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      { source: "mr-wplace-snapshot-save", requestId, id, dataUrl, metadata },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Save snapshot timed out");
      resolve(false);
    }, 10000);
  });
};

export const updateSnapshotMetadataInInject = async (
  id: string,
  updates: Partial<Omit<SnapshotMetadata, "id">>
): Promise<boolean> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-update-metadata-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result === true);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      { source: "mr-wplace-snapshot-update-metadata", requestId, id, updates },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Update snapshot metadata timed out");
      resolve(false);
    }, 5000);
  });
};

/**
 * Delete snapshot with metadata from inject side IndexedDB
 */
export const deleteSnapshotFromInject = async (id: string): Promise<boolean> => {
  const requestId = generateRequestId();
  const payload = await withDangerousMessageAuth({
    source: "mr-wplace-snapshot-delete",
    requestId,
    id,
  });

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-delete-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result === true);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(payload, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Delete snapshot timed out");
      resolve(false);
    }, 5000);
  });
};

/**
 * Get original tile image as dataUrl from inject side
 * Uses in-memory cache first and backend fetch as fallback
 */
export const getOriginalTileDataUrl = async (
  tileX: number,
  tileY: number
): Promise<string | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-original-tile" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.dataUrl || null);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      {
        source: "mr-wplace-request-original-tile",
        requestId,
        tileX,
        tileY,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Get original tile timed out");
      resolve(null);
    }, 7000);
  });
};

/**
 * Get map center coordinates from inject side
 * Returns null if map instance is not available
 */
export const getMapCenter = async (): Promise<{ lat: number; lng: number } | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-map-center" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.center);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: "mr-wplace-request-map-center", requestId }, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Map center request timed out");
      resolve(null);
    }, 5000);
  });
};

type ScreenPoint = { x: number; y: number };
type MapPixelPoint = { pixelX: number; pixelY: number };

const requestProjectionPoints = <TRequestPoint, TResponsePoint>(params: {
  requestSource: string;
  responseSource: string;
  timeoutMessage: string;
  points: TRequestPoint[];
}): Promise<TResponsePoint[]> => {
  if (!params.points.length) return Promise.resolve([]);
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === params.responseSource &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve((event.data.points || []) as TResponsePoint[]);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      {
        source: params.requestSource,
        requestId,
        points: params.points,
      },
      "*",
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn(`🧑‍🎨 : ${params.timeoutMessage}`);
      resolve([]);
    }, 5000);
  });
};

/**
 * Project viewport client points to wplace pixel coordinates via inject map instance
 */
export const projectScreenPointsToMapPixels = async (
  points: ScreenPoint[],
): Promise<MapPixelPoint[]> => {
  return requestProjectionPoints<ScreenPoint, MapPixelPoint>({
    requestSource: "mr-wplace-request-map-pixels-from-screen",
    responseSource: "mr-wplace-response-map-pixels-from-screen",
    timeoutMessage: "Screen point projection request timed out",
    points,
  });
};

/**
 * Project wplace pixel coordinates to viewport client points via inject map instance
 */
export const projectMapPixelsToScreenPoints = async (
  points: MapPixelPoint[],
): Promise<ScreenPoint[]> => {
  return requestProjectionPoints<MapPixelPoint, ScreenPoint>({
    requestSource: "mr-wplace-request-screen-points-from-map-pixels",
    responseSource: "mr-wplace-response-screen-points-from-map-pixels",
    timeoutMessage: "Map pixel projection request timed out",
    points,
  });
};

/**
 * Capture current map view as 256x256 JPEG thumbnail from inject side
 * Returns dataUrl or null if map canvas is unavailable
 */
export const getMapThumbnail = async (): Promise<string | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-map-thumbnail" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.dataUrl ?? null);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: "mr-wplace-request-map-thumbnail", requestId }, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Map thumbnail request timed out");
      resolve(null);
    }, 5000);
  });
};

/**
 * Enable/disable inject-side map projection tracking events.
 * When enabled, inject posts "mr-wplace-map-view-changed" during map movement
 * and a final settled event after movement ends.
 */
export const setMapProjectionTracking = (enabled: boolean): void => {
  window.postMessage(
    {
      source: "mr-wplace-map-projection-tracking",
      enabled,
    },
    "*",
  );
};

// ============================================
// Snapshot Export (Worker-based, off-thread ZIP)
// ============================================

export type SnapshotExportScope =
  | { scope: "all" }
  | { scope: "tile"; tileX: number; tileY: number };

export type ZipExportProgress =
  | { phase: "read"; current: number; total: number }
  | { phase: "pack"; percent: number };

export type ZipExportResult = {
  status: "done" | "empty";
  count: number;
};

/**
 * Generic Worker-based ZIP export request to inject.
 * Inject spawns a Worker (workerUrl) that reads IndexedDB + packs ZIP, then
 * triggers the download itself. Progress is streamed via onProgress.
 * The idle timeout resets on every progress message so long exports don't abort.
 */
const requestZipExport = (
  requestSource: string,
  responseSource: string,
  payload: Record<string, unknown>,
  onProgress?: (progress: ZipExportProgress) => void,
): Promise<ZipExportResult> => {
  const requestId = generateRequestId();
  const IDLE_TIMEOUT_MS = 30000;

  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(new Error("Export timed out"));
      }, IDLE_TIMEOUT_MS);
    };

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.source !== responseSource || data.requestId !== requestId)
        return;

      if (data.type === "progress") {
        resetTimeout();
        onProgress?.(data.progress as ZipExportProgress);
        return;
      }

      clearTimeout(timeoutId);
      window.removeEventListener("message", handler);

      if (data.type === "error") {
        reject(new Error(data.error || "Export failed"));
        return;
      }
      resolve({
        status: data.type === "empty" ? "empty" : "done",
        count: data.count ?? 0,
      });
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: requestSource, requestId, ...payload }, "*");
    resetTimeout();
  });
};

/**
 * Request inject side to export snapshots to a ZIP off the main thread.
 * @param workerUrl - runtime.getURL(...) for the snapshot export worker
 * @param scope - all snapshots or a single tile
 */
export const exportSnapshots = (
  workerUrl: string,
  scope: SnapshotExportScope,
  onProgress?: (progress: ZipExportProgress) => void,
): Promise<ZipExportResult> =>
  requestZipExport(
    "mr-wplace-snapshot-export",
    "mr-wplace-snapshot-export-response",
    { workerUrl, ...scope },
    onProgress,
  );

/**
 * Request inject side to export the gallery to a ZIP off the main thread.
 * @param workerUrl - runtime.getURL(...) for the gallery export worker
 * @param format - "png" (raw images) or "wplace" (.wplace JSON per image)
 */
export const exportGallery = (
  workerUrl: string,
  format: "png" | "wplace" = "png",
  onProgress?: (progress: ZipExportProgress) => void,
): Promise<ZipExportResult> =>
  requestZipExport(
    "mr-wplace-gallery-export",
    "mr-wplace-gallery-export-response",
    { workerUrl, format },
    onProgress,
  );
