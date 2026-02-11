import { getMapInstanceFromWplace } from "../get-map-instance";
import { getStateVersion, incrementStateVersion } from "./state-version";

const FRONT_LAYER_ID = "pixel-art-layer-overlay";
const FRONT_SOURCE_ID = "mr-wplace-overlay-source";
const PIXEL_ART_LAYER = "pixel-art-layer";
const PIXEL_HOVER_LAYER = "pixel-hover";
const FAKE_TILE_PROTOCOL = "mr-wplace-overlay";
const PENDING_REFRESH_DEBOUNCE_MS = 120;
const MAX_PENDING_COMPARISON_TILES = 256;
const MAX_PENDING_PAINT_TILES = 256;

let layerAdded = false;
let sourceAdded = false;
let currentSourceVersion = 0;
let frontLayerOperational = false;
const pendingComparisonTiles = new Set<string>();
const pendingPaintTiles = new Set<string>();
let pendingComparisonRefreshQueued = false;
let pendingRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const isEnabled = () => window.mrWplaceFrontTileLayerEnabled ?? false;

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
  if (
    frontLayerOperational &&
    (pendingComparisonRefreshQueued || pendingPaintTiles.size > 0)
  ) {
    schedulePendingComparisonRefresh();
  }
};

const clearPendingRefreshTimer = (): void => {
  if (pendingRefreshTimer === null) return;
  clearTimeout(pendingRefreshTimer);
  pendingRefreshTimer = null;
};

const schedulePendingComparisonRefresh = (): void => {
  if (pendingRefreshTimer !== null) return;

  pendingRefreshTimer = setTimeout(() => {
    pendingRefreshTimer = null;
    const shouldRefresh =
      pendingComparisonRefreshQueued || pendingPaintTiles.size > 0;
    if (!shouldRefresh) return;
    if (!isFrontTileLayerOperational()) return;
    pendingComparisonRefreshQueued = false;
    pendingPaintTiles.clear();
    refreshFrontTileLayer();
  }, PENDING_REFRESH_DEBOUNCE_MS);
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
  if (!pendingComparisonTiles.delete(key)) return;
  pendingComparisonRefreshQueued = true;
  schedulePendingComparisonRefresh();
};

export const notifyFrontTilePendingPaintChanged = (
  tileX: number,
  tileY: number,
): void => {
  if (!isEnabled()) return;
  const key = `${tileX},${tileY}`;
  pendingPaintTiles.add(key);
  if (pendingPaintTiles.size > MAX_PENDING_PAINT_TILES) {
    const oldest = pendingPaintTiles.values().next().value;
    if (oldest) pendingPaintTiles.delete(oldest);
  }
  schedulePendingComparisonRefresh();
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
      tiles: [`${FAKE_TILE_PROTOCOL}://{z}/{x}/{y}.png?v=${version}`],
      tileSize: 1000,
      minzoom: 11,
      maxzoom: 11,
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
    updateFrontLayerOperational(map);
    return;
  }
  layerAdded = false;

  if (!map.getLayer(PIXEL_HOVER_LAYER)) return;
  if (!map.getLayer(PIXEL_ART_LAYER)) return;

  // Add overlay layer at the end (after pixel-hover)
  try {
    map.addLayer({
      id: FRONT_LAYER_ID,
      type: "raster",
      source: FRONT_SOURCE_ID,
      paint: {
        "raster-opacity": 1,
        "raster-resampling": "nearest",
      },
    });
    layerAdded = true;
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
  pendingPaintTiles.clear();
  pendingComparisonRefreshQueued = false;
  clearPendingRefreshTimer();

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

    // Remove and re-add source with new version URL
    // This is lighter than full layer reconstruction
    map.removeLayer(FRONT_LAYER_ID);
    map.removeSource(FRONT_SOURCE_ID);

    // Reset state flags
    layerAdded = false;
    sourceAdded = false;
    currentSourceVersion = newVersion;

    // Re-add source with new version
    addOverlaySource(map);
    checkAndAddOverlay(map);
    updateFrontLayerOperational(map);

    console.log(`🧑‍🎨 : Front tile layer refreshed (version: ${newVersion})`);
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
  };

  map.on("styledata", onStyleData);
  console.log("🧑‍🎨 : Front tile layer listener setup complete");

  // Initial check if style is already loaded
  if (isEnabled() && map.isStyleLoaded && map.isStyleLoaded()) {
    checkAndAddOverlay(map);
    updateFrontLayerOperational(map);
  }
};
