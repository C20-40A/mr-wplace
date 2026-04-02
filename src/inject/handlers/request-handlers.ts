import {
  getAggregatedColorStats,
  getStatsPerImage,
  getOverlayPixelColor,
  getTilePixelColor,
  extractConnectedTileRegion,
  perTileColorStats,
  getOriginalBlob,
  setOriginalBlob,
} from "../features/tile-draw";
import { computeTotalStatsFromImage } from "../features/tile-draw";
import { latLonToPixels, metersToLatLon, pixelsToMeters } from "@/utils/geo-converter";
import {
  renderAdjustPreview,
  releaseAdjustPreviewSession,
  renderTransparencyPreview,
  type InjectAdjustPreviewResult,
  type InjectAdjustPreviewParams,
  type InjectTransparencyPreviewParams,
} from "../features/preview-renderer";

const TILE_FETCH_TIMEOUT_MS = 5000;
const MAP_VIEW_LIVE_EVENTS = ["move", "zoom", "rotate", "pitch"] as const;
const MAP_VIEW_SETTLED_EVENTS = [
  "moveend",
  "zoomend",
  "rotateend",
  "pitchend",
  "resize",
] as const;

type ProjectionTrackingMap = {
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  getCenter?: () => { lng: number; lat: number };
  getZoom?: () => number;
};

let projectionTrackingEnabled = false;
let trackedMap: ProjectionTrackingMap | null = null;
let trackedMapLiveHandler: (() => void) | null = null;
let trackedMapSettledHandler: (() => void) | null = null;
let liveMapViewNotifyQueued = false;

const getMapView = (): { center: { lng: number; lat: number }; zoom: number } | undefined => {
  if (!trackedMap?.getCenter || !trackedMap?.getZoom) return undefined;
  const c = trackedMap.getCenter();
  return { center: { lng: c.lng, lat: c.lat }, zoom: trackedMap.getZoom() };
};

const notifyMapViewChanged = (settled: boolean): void => {
  if (!projectionTrackingEnabled) return;
  if (settled) {
    window.postMessage({ source: "mr-wplace-map-view-changed", settled: true, ...getMapView() }, "*");
    return;
  }
  if (liveMapViewNotifyQueued) return;
  liveMapViewNotifyQueued = true;
  requestAnimationFrame(() => {
    liveMapViewNotifyQueued = false;
    if (!projectionTrackingEnabled) return;
    window.postMessage({ source: "mr-wplace-map-view-changed", settled: false, ...getMapView() }, "*");
  });
};

const detachMapProjectionTracking = (): void => {
  if (!trackedMap || typeof trackedMap.off !== "function") {
    trackedMap = null;
    trackedMapLiveHandler = null;
    trackedMapSettledHandler = null;
    return;
  }
  if (trackedMapLiveHandler)
    for (const event of MAP_VIEW_LIVE_EVENTS) trackedMap.off(event, trackedMapLiveHandler);
  if (trackedMapSettledHandler)
    for (const event of MAP_VIEW_SETTLED_EVENTS)
      trackedMap.off(event, trackedMapSettledHandler);
  trackedMap = null;
  trackedMapLiveHandler = null;
  trackedMapSettledHandler = null;
};

const attachMapProjectionTracking = (): void => {
  const { getMapInstanceFromWplace } = require("../features/map-instance/get-map-instance");
  const mapInstance = getMapInstanceFromWplace() as ProjectionTrackingMap | null;
  if (!mapInstance || typeof mapInstance.on !== "function") return;
  if (trackedMap === mapInstance && trackedMapLiveHandler && trackedMapSettledHandler) return;

  detachMapProjectionTracking();
  trackedMap = mapInstance;
  trackedMapLiveHandler = () => notifyMapViewChanged(false);
  trackedMapSettledHandler = () => notifyMapViewChanged(true);
  for (const event of MAP_VIEW_LIVE_EVENTS) mapInstance.on(event, trackedMapLiveHandler);
  for (const event of MAP_VIEW_SETTLED_EVENTS)
    mapInstance.on(event, trackedMapSettledHandler);
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const fetchOriginalTileBlob = async (
  tileX: number,
  tileY: number,
): Promise<Blob | null> => {
  const urls = [
    `https://backend.wplace.live/tile/${tileX}/${tileY}.png`,
    `https://backend.wplace.live/tiles/${tileX}/${tileY}.png`,
    `https://backend.wplace.live/files/s0/tiles/${tileX}/${tileY}.png`,
  ];

  for (const url of urls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TILE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) continue;

      const blob = await response.blob();
      if (blob.size === 0) continue;

      return blob;
    } catch {
      // Try next endpoint
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
};

/**
 * Handle aggregated color stats request
 */
export const handleStatsRequest = (data: {
  imageKeys: string[];
  requestId: string;
}): void => {
  const stats = getAggregatedColorStats(data.imageKeys);

  window.postMessage(
    {
      source: "mr-wplace-response-stats",
      requestId: data.requestId,
      stats,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent stats for ${data.imageKeys.length} images (request: ${data.requestId})`
  );
};

/**
 * Handle overlay pixel color request
 */
export const handlePixelColorRequest = async (data: {
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

  console.log(
    `🧑‍🎨 : Sent pixel color for (${data.lat}, ${data.lng}) (request: ${data.requestId})`
  );
};

export const handleTilePixelColorRequest = async (data: {
  lat: number;
  lng: number;
  requestId: string;
}): Promise<void> => {
  const color = await getTilePixelColor(data.lat, data.lng);

  window.postMessage(
    {
      source: "mr-wplace-response-tile-pixel-color",
      requestId: data.requestId,
      color,
    },
    "*"
  );
};

export const handleConnectedTileRegionRequest = async (data: {
  lat: number;
  lng: number;
  requestId: string;
  excludedColors?: Array<[number, number, number, number]>;
  maxSelectedPixels?: number;
  includeDiagonals?: boolean;
}): Promise<void> => {
  try {
    const result = await extractConnectedTileRegion(data.lat, data.lng, {
      excludedColors: data.excludedColors,
      maxSelectedPixels: data.maxSelectedPixels,
      includeDiagonals: data.includeDiagonals,
    });

    window.postMessage(
      {
        source: "mr-wplace-response-connected-tile-region",
        requestId: data.requestId,
        result,
      },
      "*"
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-response-connected-tile-region",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*"
    );
  }
};

/**
 * Handle per-tile color stats request
 */
export const handleTileStatsRequest = (data: { requestId: string }): void => {
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

/**
 * Handle image stats request (per-image aggregated stats)
 * Hybrid: Get from memory (overlayLayers) + IndexedDB (statistics store)
 */
export const handleImageStatsRequest = async (data: {
  imageKeys: string[];
  requestId: string;
}): Promise<void> => {
  // Get stats from memory (overlay layers)
  const memoryStats = getStatsPerImage(data.imageKeys);

  // Get stats from IndexedDB for missing keys
  const missingKeys = data.imageKeys.filter((key) => !memoryStats[key]);

  if (missingKeys.length > 0) {
    console.log(
      `🧑‍🎨 : Fetching stats for ${missingKeys.length} images from IndexedDB...`
    );
    const indexedDBStats = await fetchStatsFromIndexedDB(missingKeys);

    // Merge with memory stats
    for (const [key, stats] of Object.entries(indexedDBStats)) {
      memoryStats[key] = stats;
    }
  }

  window.postMessage(
    {
      source: "mr-wplace-response-image-stats",
      requestId: data.requestId,
      stats: memoryStats,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent image stats for ${data.imageKeys.length} images (request: ${data.requestId})`
  );
};

export const handleAdjustPreviewRequest = async (data: {
  requestId: string;
  params: InjectAdjustPreviewParams;
}): Promise<void> => {
  try {
    const result: InjectAdjustPreviewResult = await renderAdjustPreview(data.params);
    window.postMessage(
      {
        source: "mr-wplace-response-adjust-preview",
        requestId: data.requestId,
        result,
      },
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-response-adjust-preview",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
    );
  }
};

export const handleAdjustPreviewSessionRelease = (data: {
  sessionId: string;
}): void => {
  releaseAdjustPreviewSession(data.sessionId);
};

export const handleTransparencyPreviewRequest = async (data: {
  requestId: string;
  params: InjectTransparencyPreviewParams;
}): Promise<void> => {
  try {
    const dataUrl = await renderTransparencyPreview(data.params);
    window.postMessage(
      {
        source: "mr-wplace-response-transparency-preview",
        requestId: data.requestId,
        dataUrl,
      },
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        source: "mr-wplace-response-transparency-preview",
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
    );
  }
};

/**
 * Fetch stats from IndexedDB (GalleryRepository v2)
 */
const fetchStatsFromIndexedDB = async (
  imageKeys: string[]
): Promise<
  Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >
> => {
  const result: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  > = {};

  // Try GalleryRepository v2 first (perTileStats in metadata)
  try {
    const { getGalleryRepository } = await import("../db/gallery-repository");
    const repoV2 = getGalleryRepository();

    for (const key of imageKeys) {
      if (result[key]) continue;

      const metadata = await repoV2.getMetadata(key);
      if (metadata?.perTileStats) {
        // Aggregate perTileStats to get total matched and total stats
        const matched: Record<string, number> = {};
        const total: Record<string, number> = {};

        for (const tileStats of Object.values(metadata.perTileStats)) {
          for (const [color, count] of Object.entries(tileStats.matched)) {
            matched[color] = (matched[color] || 0) + count;
          }
          for (const [color, count] of Object.entries(tileStats.total)) {
            total[color] = (total[color] || 0) + count;
          }
        }

        result[key] = { matched, total };
      }
    }
  } catch (error) {
    console.warn(
      "🧑‍🎨 : GalleryRepository v2 not available for stats fetch:",
      error
    );
  }

  console.log(
    `🧑‍🎨 : Fetched stats for ${Object.keys(result).length}/${
      imageKeys.length
    } images from IndexedDB`
  );

  return result;
};

/**
 * Handle compute total stats request (position-independent)
 * Compute total stats from image dataUrl without position information
 */
export const handleComputeTotalStats = async (data: {
  imageKey: string;
  dataUrl: string;
}): Promise<void> => {
  try {
    console.log(`🧑‍🎨 : Computing total stats for ${data.imageKey}`);
    const result = await computeTotalStatsFromImage(data.dataUrl);

    // Send result back to content side
    window.postMessage(
      {
        source: "mr-wplace-total-stats-computed",
        imageKey: data.imageKey,
        totalColorStats: result.total,
        totalPixels: result.totalPixels,
      },
      "*"
    );

    console.log(
      `🧑‍🎨 : Total stats computed for ${data.imageKey}: ${result.totalPixels} pixels`
    );
  } catch (error) {
    console.error(
      `🧑‍🎨 : Failed to compute total stats for ${data.imageKey}:`,
      error
    );
  }
};

/**
 * Handle map center request
 */
const MAP_THUMBNAIL_SIZE = 256;

/**
 * Handle map canvas thumbnail capture request
 * Returns 1:1 cropped center JPEG dataUrl (256x256)
 */
export const handleMapThumbnailRequest = async (data: {
  requestId: string;
}): Promise<void> => {
  const { getMapInstanceFromWplace } = require(
    "../features/map-instance/get-map-instance",
  );
  const mapInstance = getMapInstanceFromWplace() as {
    getCanvas?: () => HTMLCanvasElement;
  } | null;
  const mapCanvas = mapInstance?.getCanvas?.();

  if (!mapCanvas) {
    window.postMessage(
      { source: "mr-wplace-response-map-thumbnail", requestId: data.requestId, dataUrl: null },
      "*",
    );
    return;
  }

  // WebGL の preserveDrawingBuffer が false のため、rAF 内でキャプチャする必要がある
  requestAnimationFrame(async () => {
    try {
      const w = mapCanvas.width;
      const h = mapCanvas.height;
      const size = Math.min(w, h);
      const sx = Math.floor((w - size) / 2);
      const sy = Math.floor((h - size) / 2);

      const offscreen = new OffscreenCanvas(MAP_THUMBNAIL_SIZE, MAP_THUMBNAIL_SIZE);
      const ctx = offscreen.getContext("2d")!;
      ctx.drawImage(mapCanvas, sx, sy, size, size, 0, 0, MAP_THUMBNAIL_SIZE, MAP_THUMBNAIL_SIZE);

      const blob = await offscreen.convertToBlob({ type: "image/jpeg", quality: 0.82 });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      window.postMessage(
        { source: "mr-wplace-response-map-thumbnail", requestId: data.requestId, dataUrl },
        "*",
      );
      console.log(`🧑‍🎨 : Map thumbnail captured (request: ${data.requestId})`);
    } catch (error) {
      console.error("🧑‍🎨 : Failed to capture map thumbnail:", error);
      window.postMessage(
        { source: "mr-wplace-response-map-thumbnail", requestId: data.requestId, dataUrl: null },
        "*",
      );
    }
  });
};

export const handleMapCenterRequest = (data: { requestId: string }): void => {
  const { getMapInstanceFromWplace } = require(
    "../features/map-instance/get-map-instance",
  );
  const mapInstance = getMapInstanceFromWplace();

  let center = null;
  if (mapInstance) {
    center = mapInstance.getCenter();
  }

  window.postMessage(
    {
      source: "mr-wplace-response-map-center",
      requestId: data.requestId,
      center,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent map center: ${center ? `${center.lat}, ${center.lng}` : "null"} (request: ${data.requestId})`
  );
};

interface MapProjectPoint {
  x: number;
  y: number;
}

interface MapProjectResult {
  pixelX: number;
  pixelY: number;
}

/**
 * Handle screen point -> wplace pixel projection request
 */
export const handleMapPixelsFromScreenRequest = (data: {
  requestId: string;
  points: MapProjectPoint[];
}): void => {
  const { getMapInstanceFromWplace } = require("../features/map-instance/get-map-instance");
  const mapInstance = getMapInstanceFromWplace() as {
    unproject?: (point: { x: number; y: number }) => { lat: number; lng: number };
    getContainer?: () => HTMLElement;
  } | null;

  const mapContainer =
    mapInstance?.getContainer?.() ??
    document.querySelector<HTMLElement>(".maplibregl-map") ??
    document.querySelector<HTMLElement>(".maplibregl-canvas-container");
  const rect = mapContainer?.getBoundingClientRect();

  if (!mapInstance?.unproject || !rect || !data.points?.length) {
    window.postMessage(
      {
        source: "mr-wplace-response-map-pixels-from-screen",
        requestId: data.requestId,
        points: [],
      },
      "*",
    );
    return;
  }

  const points: MapProjectResult[] = data.points.map((point) => {
    const localX = point.x - rect.left;
    const localY = point.y - rect.top;
    const lngLat = mapInstance.unproject!({ x: localX, y: localY });
    const [pixelX, pixelY] = latLonToPixels(lngLat.lat, lngLat.lng);
    return { pixelX, pixelY };
  });

  window.postMessage(
    {
      source: "mr-wplace-response-map-pixels-from-screen",
      requestId: data.requestId,
      points,
    },
    "*",
  );
};

/**
 * Handle wplace pixel -> screen point projection request
 */
export const handleScreenPointsFromMapPixelsRequest = (data: {
  requestId: string;
  points: MapProjectResult[];
}): void => {
  const { getMapInstanceFromWplace } = require("../features/map-instance/get-map-instance");
  const mapInstance = getMapInstanceFromWplace() as {
    project?: (lngLat: { lng: number; lat: number }) => { x: number; y: number };
    getContainer?: () => HTMLElement;
  } | null;

  const mapContainer =
    mapInstance?.getContainer?.() ??
    document.querySelector<HTMLElement>(".maplibregl-map") ??
    document.querySelector<HTMLElement>(".maplibregl-canvas-container");
  const rect = mapContainer?.getBoundingClientRect();

  if (!mapInstance?.project || !rect || !data.points?.length) {
    window.postMessage(
      {
        source: "mr-wplace-response-screen-points-from-map-pixels",
        requestId: data.requestId,
        points: [],
      },
      "*",
    );
    return;
  }

  const points = data.points.map((point) => {
    const [metersX, metersY] = pixelsToMeters(point.pixelX, point.pixelY);
    const [lat, lng] = metersToLatLon(metersX, metersY);
    const localPoint = mapInstance.project!({ lat, lng });
    return {
      x: rect.left + localPoint.x,
      y: rect.top + localPoint.y,
    };
  });

  window.postMessage(
    {
      source: "mr-wplace-response-screen-points-from-map-pixels",
      requestId: data.requestId,
      points,
    },
    "*",
  );
};

/**
 * Enable/disable map projection tracking notifications.
 */
export const handleMapProjectionTrackingUpdate = (data: {
  enabled: boolean;
}): void => {
  projectionTrackingEnabled = Boolean(data.enabled);
  if (!projectionTrackingEnabled) {
    detachMapProjectionTracking();
    return;
  }
  attachMapProjectionTracking();
  notifyMapViewChanged(true);
};

/**
 * Handle original tile image request
 * Returns original tile image as dataUrl from cache, or fetches from backend as fallback.
 */
export const handleOriginalTileRequest = async (data: {
  tileX: number;
  tileY: number;
  requestId: string;
}): Promise<void> => {
  const { tileX, tileY, requestId } = data;
  const cacheKey = `${tileX},${tileY}`;

  try {
    let blob = getOriginalBlob(cacheKey);
    let fromCache = true;

    if (!blob) {
      fromCache = false;
      blob = await fetchOriginalTileBlob(tileX, tileY);
      if (blob) setOriginalBlob(cacheKey, blob);
    }

    const dataUrl = blob ? await blobToDataUrl(blob) : null;

    window.postMessage(
      {
        source: "mr-wplace-response-original-tile",
        requestId,
        dataUrl,
      },
      "*",
    );

    console.log(
      `🧑‍🎨 : Sent original tile (${tileX}, ${tileY}) ${dataUrl ? (fromCache ? "from cache" : "from fetch") : "not found"} (request: ${requestId})`,
    );
  } catch (error) {
    console.error("🧑‍🎨 : Failed to get original tile image:", error);
    window.postMessage(
      {
        source: "mr-wplace-response-original-tile",
        requestId,
        dataUrl: null,
      },
      "*",
    );
  }
};
