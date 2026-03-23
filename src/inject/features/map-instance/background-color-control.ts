import { getMapInstanceFromWplace } from "./get-map-instance";

const PIXEL_ART_LAYER_ID = "pixel-art-layer";

type HiddenLayerState = {
  id: string;
  visibility: unknown;
};

type BackgroundLayerState = {
  backgroundId: string;
  backgroundColor: unknown;
  backgroundOpacity: unknown;
  hiddenLayers: HiddenLayerState[];
};

let backgroundLayerState: BackgroundLayerState | null = null;

const getLayersBeforePixelArt = (mapInstance: any): any[] => {
  const layers = mapInstance.getStyle?.()?.layers;
  if (!Array.isArray(layers)) return [];

  const pixelArtIndex = layers.findIndex(
    (layer) => layer?.id === PIXEL_ART_LAYER_ID,
  );
  if (pixelArtIndex === -1) return [];

  return layers.slice(0, pixelArtIndex);
};

const resolveBackgroundLayer = (mapInstance: any): any | null => {
  const layersBeforePixelArt = getLayersBeforePixelArt(mapInstance);
  if (layersBeforePixelArt.length === 0) return null;

  return (
    layersBeforePixelArt.find((layer) => layer?.type === "background") ?? null
  );
};

const restoreBackgroundLayerState = (mapInstance: any): void => {
  if (!backgroundLayerState) return;

  for (const layer of backgroundLayerState.hiddenLayers) {
    if (!mapInstance.getLayer(layer.id)) continue;
    mapInstance.setLayoutProperty(
      layer.id,
      "visibility",
      layer.visibility ?? "visible",
    );
  }

  if (mapInstance.getLayer(backgroundLayerState.backgroundId)) {
    mapInstance.setLayoutProperty(
      backgroundLayerState.backgroundId,
      "visibility",
      "visible",
    );
    mapInstance.setPaintProperty(
      backgroundLayerState.backgroundId,
      "background-color",
      backgroundLayerState.backgroundColor ?? "#f8f4f0",
    );
    mapInstance.setPaintProperty(
      backgroundLayerState.backgroundId,
      "background-opacity",
      backgroundLayerState.backgroundOpacity ?? 1,
    );
  }

  backgroundLayerState = null;
};

const applySolidBackground = (mapInstance: any, color: string): void => {
  const backgroundLayer = resolveBackgroundLayer(mapInstance);
  if (!backgroundLayer?.id) {
    console.warn("🧑‍🎨 : Background layer not found");
    return;
  }

  const layersBeforePixelArt = getLayersBeforePixelArt(mapInstance);
  if (layersBeforePixelArt.length === 0) {
    console.warn("🧑‍🎨 : pixel-art-layer not found");
    return;
  }

  const hiddenLayers: HiddenLayerState[] = [];

  for (const layer of layersBeforePixelArt) {
    if (!layer?.id || layer.id === backgroundLayer.id) continue;
    if (!mapInstance.getLayer(layer.id)) continue;

    const visibility = mapInstance.getLayoutProperty(layer.id, "visibility");
    hiddenLayers.push({ id: layer.id, visibility });
    mapInstance.setLayoutProperty(layer.id, "visibility", "none");
  }

  backgroundLayerState = {
    backgroundId: backgroundLayer.id,
    backgroundColor: mapInstance.getPaintProperty(
      backgroundLayer.id,
      "background-color",
    ),
    backgroundOpacity: mapInstance.getPaintProperty(
      backgroundLayer.id,
      "background-opacity",
    ),
    hiddenLayers,
  };

  mapInstance.setLayoutProperty(backgroundLayer.id, "visibility", "visible");
  mapInstance.setPaintProperty(backgroundLayer.id, "background-color", color);
  mapInstance.setPaintProperty(backgroundLayer.id, "background-opacity", 1);
};

export const changeBackgroundColor = (color: string | null): void => {
  const mapInstance = getMapInstanceFromWplace();
  if (!mapInstance) {
    console.log("🧑‍🎨 : Map instance not available");
    return;
  }

  try {
    restoreBackgroundLayerState(mapInstance);

    if (color == null) {
      console.log("🧑‍🎨 : Background color reset");
      return;
    }

    applySolidBackground(mapInstance, color);
    console.log("🧑‍🎨 : Background color updated to:", color);
  } catch (error) {
    console.error("🧑‍🎨 : Error changing background color:", error);
  }
};
