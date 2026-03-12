import { getMapInstanceFromWplace } from "../get-map-instance";
import { getStateVersion, incrementStateVersion } from "./state-version";
import { tilePixelToLatLng } from "@/utils/coordinate";
import {
  buildFrontLayerTileUrl,
  invalidateFrontRenderedTile,
} from "./fetch-handler";

const FRONT_LAYER_ID = "pixel-art-layer-overlay";
const FRONT_SOURCE_ID = "mr-wplace-overlay-source";
const PIXEL_ART_LAYER = "pixel-art-layer";
const PIXEL_HOVER_LAYER = "pixel-hover";
const PENDING_REFRESH_DEBOUNCE_MS = 120;
const MAX_PENDING_COMPARISON_TILES = 256;
const GUIDE_SOURCE_ID = "mr-wplace-paint-guide-source";
const GUIDE_MISMATCH_LAYER_ID = "mr-wplace-paint-guide-mismatch";
const GUIDE_ALREADY_LAYER_ID = "mr-wplace-paint-guide-already";
const LEGACY_GUIDE_MATCH_LAYER_ID = "mr-wplace-paint-guide-match";
const GUIDE_SYNC_DEBOUNCE_MS = 50;
const MAX_GUIDE_POINTS = 1500;
const FRONT_LAYER_MIN_ZOOM = 9;
const FRONT_LAYER_MAX_ZOOM = 11;

let layerAdded = false;
let sourceAdded = false;
let currentSourceVersion = 0;
let frontLayerOperational = false;
const pendingComparisonTiles = new Set<string>();
let pendingComparisonRefreshQueued = false;
let deferredRefreshQueued = false;
let pendingRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let guideSyncTimer: ReturnType<typeof setTimeout> | null = null;

interface PaintGuidePoint {
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  lat: number;
  lng: number;
  kind: "mismatch" | "already";
  colorRgbInt: number;
  colorHex: string;
}

const paintGuidePoints = new Map<string, PaintGuidePoint>();
let paintGuideActive = false;

const isEnabled = () => window.mrWplaceFrontTileLayerEnabled ?? false;
const getFrontSourceTileUrl = (version: number): string =>
  buildFrontLayerTileUrl(version);
const getGuidePointKey = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
): string => `${tileX},${tileY},${pixelX},${pixelY}`;
const rgbIntToHex = (rgbInt: number): string =>
  `#${(rgbInt & 0xffffff).toString(16).padStart(6, "0")}`;

const clearGuideSyncTimer = (): void => {
  if (guideSyncTimer === null) return;
  clearTimeout(guideSyncTimer);
  guideSyncTimer = null;
};

const removeGuideLayersAndSource = (map: any): void => {
  if (map.getLayer(LEGACY_GUIDE_MATCH_LAYER_ID))
    map.removeLayer(LEGACY_GUIDE_MATCH_LAYER_ID);
  if (map.getLayer(GUIDE_ALREADY_LAYER_ID)) map.removeLayer(GUIDE_ALREADY_LAYER_ID);
  if (map.getLayer(GUIDE_MISMATCH_LAYER_ID)) map.removeLayer(GUIDE_MISMATCH_LAYER_ID);
  if (map.getSource(GUIDE_SOURCE_ID)) map.removeSource(GUIDE_SOURCE_ID);
};

const findPaintCrosshairLayerId = (map: any): string | undefined => {
  const layers = map.getStyle?.()?.layers;
  if (!Array.isArray(layers)) return undefined;
  for (const layer of layers) {
    const id = layer?.id;
    if (typeof id === "string" && id.startsWith("paint-crosshair")) return id;
  }
  return undefined;
};

const findPaintPreviewLayerId = (map: any): string | undefined => {
  const layers = map.getStyle?.()?.layers;
  if (!Array.isArray(layers)) return undefined;
  for (const layer of layers) {
    const id = layer?.id;
    if (typeof id === "string" && id.startsWith("paint-preview-")) return id;
  }
  return undefined;
};

const resolveOverlayBeforeId = (map: any): string | undefined => {
  const paintPreviewId = findPaintPreviewLayerId(map);
  if (paintPreviewId) return paintPreviewId;
  if (map.getLayer(PIXEL_HOVER_LAYER)) return PIXEL_HOVER_LAYER;
  return undefined;
};

const ensureOverlayLayerOrder = (map: any): void => {
  if (!map.getLayer(FRONT_LAYER_ID)) return;
  const beforeId = resolveOverlayBeforeId(map);
  if (!beforeId || beforeId === FRONT_LAYER_ID) return;
  if (typeof map.moveLayer !== "function") return;
  try {
    map.moveLayer(FRONT_LAYER_ID, beforeId);
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to move front overlay layer:", error);
  }
};

const ensureGuideSourceAndLayers = (map: any): void => {
  if (map.getLayer(LEGACY_GUIDE_MATCH_LAYER_ID))
    map.removeLayer(LEGACY_GUIDE_MATCH_LAYER_ID);

  if (!map.getSource(GUIDE_SOURCE_ID)) {
    map.addSource(GUIDE_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  const beforeId = findPaintCrosshairLayerId(map);

  if (!map.getLayer(GUIDE_MISMATCH_LAYER_ID)) {
    map.addLayer(
      {
        id: GUIDE_MISMATCH_LAYER_ID,
        type: "circle",
        source: GUIDE_SOURCE_ID,
        filter: ["==", ["get", "kind"], "mismatch"],
        paint: {
          "circle-color": "#ffbf00",
          "circle-radius": 3.2,
          "circle-opacity": 1,
          "circle-stroke-color": "#000000",
          "circle-stroke-width": 1,
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(GUIDE_ALREADY_LAYER_ID)) {
    map.addLayer(
      {
        id: GUIDE_ALREADY_LAYER_ID,
        type: "circle",
        source: GUIDE_SOURCE_ID,
        filter: ["==", ["get", "kind"], "already"],
        paint: {
          "circle-color": "#00d4ff",
          "circle-radius": 2.8,
          "circle-opacity": 0.95,
          "circle-stroke-color": "#002433",
          "circle-stroke-width": 1,
        },
      },
      beforeId,
    );
  }
};

const buildGuideFeatureCollection = (): any => {
  const features: any[] = [];

  for (const point of paintGuidePoints.values()) {
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lng, point.lat],
      },
      properties: {
        kind: point.kind,
        color: point.colorHex,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

const syncPaintGuideLayer = (): void => {
  if (!isEnabled()) return;

  const map = getMapInstanceFromWplace() as any;
  if (!map || !frontLayerOperational) return;

  try {
    ensureGuideSourceAndLayers(map);
    const source = map.getSource(GUIDE_SOURCE_ID) as any;
    if (!source || typeof source.setData !== "function") return;
    source.setData(buildGuideFeatureCollection());
  } catch (error) {
    console.error("🧑‍🎨 : Failed to sync paint guide layer:", error);
  }
};

const scheduleGuideSync = (): void => {
  if (guideSyncTimer !== null) return;
  guideSyncTimer = setTimeout(() => {
    guideSyncTimer = null;
    syncPaintGuideLayer();
  }, GUIDE_SYNC_DEBOUNCE_MS);
};

const updateFrontLayerOperational = (map?: any): void => {
  if (!isEnabled()) {
    frontLayerOperational = false;
    return;
  }

  const mapInstance = map ?? (getMapInstanceFromWplace() as any);
  if (!mapInstance) {
    frontLayerOperational = false;
    return;
  }

  frontLayerOperational = Boolean(
    mapInstance.getLayer(FRONT_LAYER_ID) && mapInstance.getSource(FRONT_SOURCE_ID),
  );
  if (frontLayerOperational && pendingComparisonRefreshQueued) {
    schedulePendingComparisonRefresh();
  }
  if (frontLayerOperational && paintGuidePoints.size > 0) scheduleGuideSync();
};

const clearPendingRefreshTimer = (): void => {
  if (pendingRefreshTimer === null) return;
  clearTimeout(pendingRefreshTimer);
  pendingRefreshTimer = null;
};

const isMapInteracting = (map: any): boolean => {
  if (!map) return false;
  try {
    if (typeof map.isMoving === "function" && map.isMoving()) return true;
    if (typeof map.isZooming === "function" && map.isZooming()) return true;
    if (typeof map.isRotating === "function" && map.isRotating()) return true;
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to read map interaction state:", error);
  }
  return false;
};

const schedulePendingComparisonRefresh = (): void => {
  if (pendingRefreshTimer !== null) return;

  pendingRefreshTimer = setTimeout(() => {
    pendingRefreshTimer = null;
    if (!pendingComparisonRefreshQueued) return;
    if (!isFrontTileLayerOperational()) return;
    const map = getMapInstanceFromWplace() as any;
    if (isMapInteracting(map)) {
      schedulePendingComparisonRefresh();
      return;
    }
    pendingComparisonRefreshQueued = false;
    refreshFrontTileLayer();
  }, PENDING_REFRESH_DEBOUNCE_MS);
};

const flushDeferredRefresh = (): void => {
  if (!deferredRefreshQueued) return;
  const map = getMapInstanceFromWplace() as any;
  if (!map || !isEnabled()) {
    deferredRefreshQueued = false;
    return;
  }
  if (isMapInteracting(map)) return;
  deferredRefreshQueued = false;
  refreshFrontTileLayer();
};

const trySoftRefreshSource = (source: any, version: number): boolean => {
  const tileUrl = getFrontSourceTileUrl(version);
  if (typeof source?.setTiles === "function") {
    source.setTiles([tileUrl]);
    return true;
  }

  if (source && Array.isArray(source.tiles) && source.tiles.length > 0) {
    source.tiles = [tileUrl];
    if (typeof source?.reload === "function") source.reload();
    return true;
  }

  return false;
};

export const isFrontTileLayerOperational = (): boolean => frontLayerOperational;

export const markFrontTileComparisonPending = (
  tileX: number,
  tileY: number,
): void => {
  if (!isEnabled()) return;
  const key = `${tileX},${tileY}`;
  pendingComparisonTiles.add(key);
  if (pendingComparisonTiles.size <= MAX_PENDING_COMPARISON_TILES) return;
  const oldest = pendingComparisonTiles.values().next().value;
  if (!oldest) return;
  pendingComparisonTiles.delete(oldest);
};

export const notifyFrontTileComparisonReady = (
  tileX: number,
  tileY: number,
): void => {
  if (!isEnabled()) return;
  const key = `${tileX},${tileY}`;
  const wasPending = pendingComparisonTiles.delete(key);
  const invalidated = invalidateFrontRenderedTile(tileX, tileY);

  // Only schedule refresh when there's actual work:
  // - wasPending: tile was waiting for comparison background
  // - invalidated: cached front tile was evicted (background changed)
  if (!wasPending && !invalidated) return;
  pendingComparisonRefreshQueued = true;
  schedulePendingComparisonRefresh();
};

export const upsertFrontTilePaintGuide = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
  kind: "mismatch" | "already",
  templateRgbInt: number,
): void => {
  if (!isEnabled()) return;
  if (!paintGuideActive) return;
  if (pixelX < 0 || pixelY < 0 || pixelX >= 1000 || pixelY >= 1000) return;
  const key = getGuidePointKey(tileX, tileY, pixelX, pixelY);
  const existing = paintGuidePoints.get(key);
  if (existing && existing.kind === kind && existing.colorRgbInt === templateRgbInt) return;

  const { lat, lng } = tilePixelToLatLng(tileX, tileY, pixelX + 0.5, pixelY + 0.5);
  const colorHex = rgbIntToHex(templateRgbInt);
  paintGuidePoints.set(key, {
    tileX,
    tileY,
    pixelX,
    pixelY,
    lat,
    lng,
    kind,
    colorRgbInt: templateRgbInt,
    colorHex,
  });

  if (paintGuidePoints.size > MAX_GUIDE_POINTS) {
    const oldest = paintGuidePoints.keys().next().value;
    if (oldest) paintGuidePoints.delete(oldest);
  }

  scheduleGuideSync();
};

export const clearFrontTilePaintGuideAll = (): void => {
  if (paintGuidePoints.size === 0) return;
  paintGuidePoints.clear();
  scheduleGuideSync();
};

export const clearFrontTilePaintGuide = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
): void => {
  if (!isEnabled()) return;
  if (!paintGuideActive) return;
  const key = getGuidePointKey(tileX, tileY, pixelX, pixelY);
  if (!paintGuidePoints.delete(key)) return;
  scheduleGuideSync();
};

export const clearFrontTilePaintGuideTile = (
  tileX: number,
  tileY: number,
): void => {
  if (!isEnabled()) return;
  if (!paintGuideActive) return;
  let removed = false;
  for (const [key, point] of paintGuidePoints.entries()) {
    if (point.tileX !== tileX || point.tileY !== tileY) continue;
    paintGuidePoints.delete(key);
    removed = true;
  }
  if (!removed) return;
  scheduleGuideSync();
};

export const setFrontTilePaintGuideActive = (
  active: boolean,
  options?: { clearNow?: boolean },
): void => {
  paintGuideActive = active;
  if (active) return;
  if (paintGuidePoints.size === 0) return;
  paintGuidePoints.clear();
  if (options?.clearNow) {
    clearGuideSyncTimer();
    syncPaintGuideLayer();
    return;
  }
  scheduleGuideSync();
};

/**
 * Add custom overlay source to map with state version for cache busting
 */
const addOverlaySource = (map: any): void => {
  if (map.getSource(FRONT_SOURCE_ID)) {
    sourceAdded = true;
    updateFrontLayerOperational(map);
    return;
  }
  sourceAdded = false;

  try {
    const version = getStateVersion();
    currentSourceVersion = version;

    map.addSource(FRONT_SOURCE_ID, {
      type: "raster",
      tiles: [getFrontSourceTileUrl(version)],
      tileSize: 1000,
      minzoom: FRONT_LAYER_MIN_ZOOM,
      maxzoom: FRONT_LAYER_MAX_ZOOM,
    });
    sourceAdded = true;
    updateFrontLayerOperational(map);
    console.log(`🧑‍🎨 : Front tile source added (version: ${version})`);
  } catch (e) {
    updateFrontLayerOperational(map);
    console.error("🧑‍🎨 : Failed to add overlay source:", e);
  }
};

/**
 * Check and add overlay layer if pixel-hover exists
 * Creates sandwich: pixel-art-layer -> pixel-hover -> pixel-art-layer-overlay
 */
const checkAndAddOverlay = (map: any): void => {
  if (!isEnabled()) {
    updateFrontLayerOperational(map);
    return;
  }

  // Add source first
  addOverlaySource(map);

  if (map.getLayer(FRONT_LAYER_ID)) {
    layerAdded = true;
    ensureOverlayLayerOrder(map);
    updateFrontLayerOperational(map);
    return;
  }
  layerAdded = false;

  if (!map.getLayer(PIXEL_ART_LAYER)) return;

  // Add overlay layer at the end (after pixel-hover)
  try {
    const beforeId = resolveOverlayBeforeId(map);
    map.addLayer({
      id: FRONT_LAYER_ID,
      type: "raster",
      source: FRONT_SOURCE_ID,
      paint: {
        "raster-opacity": 1,
        "raster-resampling": "nearest",
      },
    }, beforeId);
    layerAdded = true;
    ensureOverlayLayerOrder(map);
    updateFrontLayerOperational(map);
    console.log("🧑‍🎨 : Front tile layer added (sandwich created)");

    // Verify
    const layers = map.getStyle()?.layers?.map((l: any) => l.id);
    console.log("🧑‍🎨 : Layer order:", layers?.slice(-5));
  } catch (e) {
    updateFrontLayerOperational(map);
    console.error("🧑‍🎨 : Failed to add overlay layer:", e);
  }
};

/**
 * Remove front tile layer and source from map
 */
const removeFrontLayer = (map: any): void => {
  if (map.getLayer(FRONT_LAYER_ID)) {
    map.removeLayer(FRONT_LAYER_ID);
  }
  layerAdded = false;

  if (map.getSource(FRONT_SOURCE_ID)) {
    map.removeSource(FRONT_SOURCE_ID);
  }
  sourceAdded = false;
  frontLayerOperational = false;
  pendingComparisonTiles.clear();
  pendingComparisonRefreshQueued = false;
  deferredRefreshQueued = false;
  paintGuidePoints.clear();
  paintGuideActive = false;
  clearPendingRefreshTimer();
  clearGuideSyncTimer();
  removeGuideLayersAndSource(map);

  console.log("🧑‍🎨 : Front tile layer and source removed");
};

/**
 * Toggle front tile layer visibility
 */
export const setFrontTileLayerEnabled = (enabled: boolean): void => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) {
    frontLayerOperational = false;
    console.warn("🧑‍🎨 : Map instance not available for front tile layer");
    return;
  }

  if (enabled) {
    checkAndAddOverlay(map);
  } else {
    removeFrontLayer(map);
  }

  updateFrontLayerOperational(map);
  console.log("🧑‍🎨 : Front tile layer enabled:", enabled);
};

/**
 * Refresh front tile layer tiles by updating state version
 * Much lighter than remove/re-add approach - only changes URL to trigger re-fetch
 * Called when overlay state changes (color filter, gallery images, etc.)
 */
export const refreshFrontTileLayer = (): void => {
  if (!isEnabled()) {
    frontLayerOperational = false;
    return;
  }

  const map = getMapInstanceFromWplace() as any;
  if (!map) {
    frontLayerOperational = false;
    return;
  }

  if (isMapInteracting(map)) {
    deferredRefreshQueued = true;
    return;
  }

  const source = map.getSource(FRONT_SOURCE_ID);
  if (!source) {
    updateFrontLayerOperational(map);
    return;
  }

  const layer = map.getLayer(FRONT_LAYER_ID);
  if (!layer) {
    updateFrontLayerOperational(map);
    return;
  }

  try {
    // Increment version to change tile URLs
    const newVersion = incrementStateVersion();
    currentSourceVersion = newVersion;

    // Soft refresh: keep layer/source and update source tiles URL only.
    // This avoids visible flicker from layer/source remove-add.
    if (trySoftRefreshSource(source, newVersion)) {
      updateFrontLayerOperational(map);
      console.log(`🧑‍🎨 : Front tile layer soft-refreshed (version: ${newVersion})`);
      scheduleGuideSync();
      return;
    }

    // Fallback: hard refresh when source API is unavailable
    map.removeLayer(FRONT_LAYER_ID);
    map.removeSource(FRONT_SOURCE_ID);

    // Reset state flags
    layerAdded = false;
    sourceAdded = false;
    // Re-add source with new version
    addOverlaySource(map);
    checkAndAddOverlay(map);
    ensureOverlayLayerOrder(map);
    updateFrontLayerOperational(map);
    scheduleGuideSync();

    console.log(`🧑‍🎨 : Front tile layer hard-refreshed (version: ${newVersion})`);
  } catch (error) {
    updateFrontLayerOperational(map);
    console.error("🧑‍🎨 : Failed to refresh front tile layer:", error);
  }
};

/**
 * Setup front tile layer with styledata event listener
 */
export const setupFrontTileLayerOnMapReady = (mapInstance: any): void => {
  console.log("🧑‍🎨 : setupFrontTileLayerOnMapReady called");

  const map = mapInstance as any;

  // Monitor for style changes (when pixel-hover is added)
  const onStyleData = () => {
    if (!isEnabled()) {
      updateFrontLayerOperational(map);
      return;
    }
    // style reload can invalidate source/layer while flags remain true
    sourceAdded = false;
    layerAdded = false;
    checkAndAddOverlay(map);
    ensureOverlayLayerOrder(map);
    scheduleGuideSync();
  };
  const onMapSettled = () => {
    flushDeferredRefresh();
  };

  map.on("styledata", onStyleData);
  map.on("moveend", onMapSettled);
  map.on("idle", onMapSettled);
  console.log("🧑‍🎨 : Front tile layer listener setup complete");

  // Initial check if style is already loaded
  if (isEnabled() && map.isStyleLoaded && map.isStyleLoaded()) {
    checkAndAddOverlay(map);
    updateFrontLayerOperational(map);
  }
};
