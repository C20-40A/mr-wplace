import { getMapInstanceFromWplace } from "../get-map-instance";
import { changeBackgroundColor } from "../background-color-control";

const PIXEL_ART_LAYER_ID = "pixel-art-layer";
const HIGHLIGHT_COLOR = "#ff4040";
const DARK_BRIGHTNESS = 0.25;

let savedBrightness: number | null = null;

const applyFilter = (map: any): void => {
  if (!map.getLayer(PIXEL_ART_LAYER_ID)) return;

  // 既にfilter適用済みなら savedBrightness を上書きしない
  if (savedBrightness === null) {
    savedBrightness = map.getPaintProperty(PIXEL_ART_LAYER_ID, "raster-brightness-max") ?? 1;
  }
  map.setPaintProperty(PIXEL_ART_LAYER_ID, "raster-brightness-max", DARK_BRIGHTNESS);
  changeBackgroundColor(HIGHLIGHT_COLOR);
};

const removeFilter = (map: any): void => {
  if (map.getLayer(PIXEL_ART_LAYER_ID)) {
    map.setPaintProperty(PIXEL_ART_LAYER_ID, "raster-brightness-max", savedBrightness ?? 1);
  }
  savedBrightness = null;
  changeBackgroundColor(null);
};

export const setTransparentPixelFilterEnabled = (enabled: boolean): void => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) return;

  if (enabled) {
    applyFilter(map);
  } else {
    removeFilter(map);
  }
};

// no-op: refresh not needed (no custom tile source)
export const refreshTransparentPixelFilter = (): void => {};
export const scheduleTransparentPixelFilterRefresh = (): void => {};

export const setupTransparentPixelFilterOnMapReady = (mapInstance: any): void => {
  const map = mapInstance as any;

  map.on("styledata", () => {
    if (window.mrWplaceTransparentPixelFilterEnabled) applyFilter(map);
  });

  if (window.mrWplaceTransparentPixelFilterEnabled) applyFilter(map);
};
