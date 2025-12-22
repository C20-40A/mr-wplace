import { getMapInstanceFromWplace } from "./get-map-instance";

let isLayerSortListenerSetup = false;

/**
 * Sort map layers by moving paint-preview layer before pixel-art-layer
 */
export const sortMapLayers = (): void => {
  const map = getMapInstanceFromWplace() as any;

  if (!map || !map.isStyleLoaded()) {
    console.warn("🧑‍🎨 : Map instance not ready or style not loaded");
    return;
  }

  const layerPrefixToMove = "paint-preview-";
  const beforeLayerId = "pixel-art-layer";

  const allLayerIds = map.getStyle().layers.map((layer: any) => layer.id);
  const layerToMoveId = allLayerIds.find((id: string) =>
    id.startsWith(layerPrefixToMove)
  );

  if (layerToMoveId) {
    try {
      map.moveLayer(layerToMoveId, beforeLayerId);
      console.log(
        `🧑‍🎨 : Layer "${layerToMoveId}" moved before "${beforeLayerId}"`
      );
    } catch (error) {
      console.warn("🧑‍🎨 : Failed to move layer:", error);
    }
  } else {
    console.log(
      `🧑‍🎨 : No layer starting with "${layerPrefixToMove}" found yet`
    );
  }

  // Setup listener for layer additions if not already setup
  if (!isLayerSortListenerSetup && window.mrWplaceLayerSortEnabled) {
    isLayerSortListenerSetup = true;

    // Monitor for layer additions via sourcedata event
    map.on("sourcedata", () => {
      if (!window.mrWplaceLayerSortEnabled) return;

      const layers = map.getStyle()?.layers;
      if (!layers) return;

      const paintPreviewLayer = layers.find((layer: any) =>
        layer.id.startsWith(layerPrefixToMove)
      );

      if (paintPreviewLayer) {
        const currentIndex = layers.findIndex(
          (layer: any) => layer.id === paintPreviewLayer.id
        );
        const beforeIndex = layers.findIndex(
          (layer: any) => layer.id === beforeLayerId
        );

        // Only move if paint-preview is not already before pixel-art-layer
        if (currentIndex > beforeIndex) {
          try {
            map.moveLayer(paintPreviewLayer.id, beforeLayerId);
            console.log(
              `🧑‍🎨 : Layer "${paintPreviewLayer.id}" auto-moved before "${beforeLayerId}"`
            );
          } catch (error) {
            // Ignore errors during auto-sort
          }
        }
      }
    });

    console.log("🧑‍🎨 : Layer sort listener setup complete");
  }
};