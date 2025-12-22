import { getMapInstanceFromWplace } from "./get-map-instance";

const LAYER_PREFIX_TO_MOVE = "paint-preview-";
const BEFORE_LAYER_ID = "pixel-art-layer";

/**
 * Check and move layer if needed
 */
const checkAndMoveLayer = (map: any): void => {
  const layers = map.getStyle()?.layers;
  if (!layers) return;

  const paintPreviewLayer = layers.find((layer: any) =>
    layer.id.startsWith(LAYER_PREFIX_TO_MOVE)
  );

  if (!paintPreviewLayer) return;

  const currentIndex = layers.findIndex(
    (layer: any) => layer.id === paintPreviewLayer.id
  );
  const beforeIndex = layers.findIndex(
    (layer: any) => layer.id === BEFORE_LAYER_ID
  );

  // Only move if paint-preview is not already before pixel-art-layer
  if (currentIndex > beforeIndex) {
    try {
      map.moveLayer(paintPreviewLayer.id, BEFORE_LAYER_ID);
      console.log(
        `🧑‍🎨 : Layer "${paintPreviewLayer.id}" moved before "${BEFORE_LAYER_ID}"`
      );
    } catch (error) {
      console.warn("🧑‍🎨 : Failed to move layer:", error);
    }
  }
};

/**
 * Sort map layers by moving paint-preview layer before pixel-art-layer
 */
export const sortMapLayers = (): void => {
  const map = getMapInstanceFromWplace() as any;

  if (!map || !map.isStyleLoaded()) {
    console.warn("🧑‍🎨 : Map instance not ready or style not loaded");
    return;
  }

  checkAndMoveLayer(map);
};

/**
 * Setup layer sort on map ready with styledata event listener
 */
export const setupLayerSortOnMapReady = (mapInstance: any): void => {
  if (!window.mrWplaceLayerSortEnabled) return;

  const map = mapInstance as any;

  // Monitor for style changes (when layers are added/modified)
  const onStyleData = () => {
    if (!window.mrWplaceLayerSortEnabled) return;
    checkAndMoveLayer(map);
  };

  map.on("styledata", onStyleData);
  console.log("🧑‍🎨 : Layer sort listener setup complete");

  // Initial sort if style is already loaded
  if (map.isStyleLoaded && map.isStyleLoaded()) {
    checkAndMoveLayer(map);
  }
};