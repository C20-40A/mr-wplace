import { getMapInstanceFromWplace } from "./get-map-instance";

const FRONT_LAYER_ID = "pixel-art-layer-overlay";
const PIXEL_ART_LAYER = "pixel-art-layer";
const PIXEL_HOVER_LAYER = "pixel-hover";

let layerAdded = false;

let mrWplaceFrontTileLayerEnabled: boolean = true;

/**
 * Check and add overlay layer if pixel-hover exists
 * Creates sandwich: pixel-art-layer -> pixel-hover -> pixel-art-layer-overlay
 */
const checkAndAddOverlay = (map: any): void => {
  if (layerAdded) return;
  if (!mrWplaceFrontTileLayerEnabled) return;

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
      source: PIXEL_ART_LAYER, // source is same as layer id
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
 * Remove front tile layer from map
 */
const removeFrontLayer = (map: any): void => {
  if (!layerAdded) return;

  if (map.getLayer(FRONT_LAYER_ID)) {
    map.removeLayer(FRONT_LAYER_ID);
  }

  layerAdded = false;
  console.log("🧑‍🎨 : Front tile layer removed");
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

  mrWplaceFrontTileLayerEnabled = enabled;

  if (enabled) {
    checkAndAddOverlay(map);
  } else {
    removeFrontLayer(map);
  }

  console.log("🧑‍🎨 : Front tile layer enabled:", enabled);
};

/**
 * Setup front tile layer with styledata event listener
 */
export const setupFrontTileLayerOnMapReady = (mapInstance: any): void => {
  console.log("🧑‍🎨 : setupFrontTileLayerOnMapReady called");

  // Enable by default
  mrWplaceFrontTileLayerEnabled = true;

  const map = mapInstance as any;

  // Monitor for style changes (when pixel-hover is added)
  const onStyleData = () => {
    if (!mrWplaceFrontTileLayerEnabled) return;
    checkAndAddOverlay(map);
  };

  map.on("styledata", onStyleData);
  console.log("🧑‍🎨 : Front tile layer listener setup complete");

  // Initial check if style is already loaded
  if (map.isStyleLoaded && map.isStyleLoaded()) {
    checkAndAddOverlay(map);
  }
};
