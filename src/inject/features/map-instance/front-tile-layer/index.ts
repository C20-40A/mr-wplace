import { getMapInstanceFromWplace } from "../get-map-instance";
import { getStateVersion, incrementStateVersion } from "./state-version";

const FRONT_LAYER_ID = "pixel-art-layer-overlay";
const FRONT_SOURCE_ID = "mr-wplace-overlay-source";
const PIXEL_ART_LAYER = "pixel-art-layer";
const PIXEL_HOVER_LAYER = "pixel-hover";
const FAKE_TILE_PROTOCOL = "mr-wplace-overlay";

let layerAdded = false;
let sourceAdded = false;
let currentSourceVersion = 0;

const isEnabled = () => window.mrWplaceFrontTileLayerEnabled ?? false;

/**
 * Add custom overlay source to map with state version for cache busting
 */
const addOverlaySource = (map: any): void => {
  if (sourceAdded) return;
  if (map.getSource(FRONT_SOURCE_ID)) {
    sourceAdded = true;
    return;
  }

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
    console.log(`🧑‍🎨 : Front tile source added (version: ${version})`);
  } catch (e) {
    console.error("🧑‍🎨 : Failed to add overlay source:", e);
  }
};

/**
 * Check and add overlay layer if pixel-hover exists
 * Creates sandwich: pixel-art-layer -> pixel-hover -> pixel-art-layer-overlay
 */
const checkAndAddOverlay = (map: any): void => {
  if (!isEnabled()) return;

  // Add source first
  addOverlaySource(map);

  if (layerAdded) return;
  if (!map.getLayer(PIXEL_HOVER_LAYER)) return;
  if (!map.getLayer(PIXEL_ART_LAYER)) return;
  if (map.getLayer(FRONT_LAYER_ID)) {
    layerAdded = true;
    return;
  }

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
    console.log("🧑‍🎨 : Front tile layer added (sandwich created)");

    // Verify
    const layers = map.getStyle()?.layers?.map((l: any) => l.id);
    console.log("🧑‍🎨 : Layer order:", layers?.slice(-5));
  } catch (e) {
    console.error("🧑‍🎨 : Failed to add overlay layer:", e);
  }
};

/**
 * Remove front tile layer and source from map
 */
const removeFrontLayer = (map: any): void => {
  if (layerAdded && map.getLayer(FRONT_LAYER_ID)) {
    map.removeLayer(FRONT_LAYER_ID);
    layerAdded = false;
  }

  if (sourceAdded && map.getSource(FRONT_SOURCE_ID)) {
    map.removeSource(FRONT_SOURCE_ID);
    sourceAdded = false;
  }

  console.log("🧑‍🎨 : Front tile layer and source removed");
};

/**
 * Toggle front tile layer visibility
 */
export const setFrontTileLayerEnabled = (enabled: boolean): void => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for front tile layer");
    return;
  }

  if (enabled) {
    checkAndAddOverlay(map);
  } else {
    removeFrontLayer(map);
  }

  console.log("🧑‍🎨 : Front tile layer enabled:", enabled);
};

/**
 * Refresh front tile layer tiles by updating state version
 * Much lighter than remove/re-add approach - only changes URL to trigger re-fetch
 * Called when overlay state changes (color filter, gallery images, etc.)
 */
export const refreshFrontTileLayer = (): void => {
  if (!isEnabled()) return;

  const map = getMapInstanceFromWplace() as any;
  if (!map) return;

  const source = map.getSource(FRONT_SOURCE_ID);
  if (!source) return;

  const layer = map.getLayer(FRONT_LAYER_ID);
  if (!layer) return;

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

    console.log(`🧑‍🎨 : Front tile layer refreshed (version: ${newVersion})`);
  } catch (error) {
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
    if (!isEnabled()) return;
    checkAndAddOverlay(map);
  };

  map.on("styledata", onStyleData);
  console.log("🧑‍🎨 : Front tile layer listener setup complete");

  // Initial check if style is already loaded
  if (isEnabled() && map.isStyleLoaded && map.isStyleLoaded()) {
    checkAndAddOverlay(map);
  }
};
