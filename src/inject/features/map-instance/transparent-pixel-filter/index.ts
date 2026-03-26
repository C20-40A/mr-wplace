import { getMapInstanceFromWplace } from "../get-map-instance";
import { buildTransparentPixelFilterTileUrl } from "./fetch-handler";

const FILTER_SOURCE_ID = "mr-wplace-transparent-pixel-filter-source";
const FILTER_LAYER_ID = "mr-wplace-transparent-pixel-filter-layer";
const MIN_ZOOM = 11;
const MAX_ZOOM = 11;
const REFRESH_DEBOUNCE_MS = 80;

let currentSourceVersion = 0;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const isEnabled = (): boolean =>
  window.mrWplaceTransparentPixelFilterEnabled === true;

const addSource = (map: any): void => {
  if (map.getSource(FILTER_SOURCE_ID)) return;
  map.addSource(FILTER_SOURCE_ID, {
    type: "raster",
    tiles: [buildTransparentPixelFilterTileUrl(currentSourceVersion)],
    tileSize: 1000,
    minzoom: MIN_ZOOM,
    maxzoom: MAX_ZOOM,
  });
};

const addLayer = (map: any): void => {
  if (map.getLayer(FILTER_LAYER_ID)) return;
  addSource(map);
  map.addLayer(
    {
      id: FILTER_LAYER_ID,
      type: "raster",
      source: FILTER_SOURCE_ID,
      paint: {
        "raster-opacity": 1,
        "raster-resampling": "nearest",
      },
    },
  );
};

const removeLayer = (map: any): void => {
  if (map.getLayer(FILTER_LAYER_ID)) map.removeLayer(FILTER_LAYER_ID);
  if (map.getSource(FILTER_SOURCE_ID)) map.removeSource(FILTER_SOURCE_ID);
};

const trySoftRefreshSource = (source: any): boolean => {
  if (typeof source?.setTiles !== "function") return false;
  source.setTiles([buildTransparentPixelFilterTileUrl(currentSourceVersion)]);
  return true;
};

export const setTransparentPixelFilterEnabled = (enabled: boolean): void => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) return;

  if (enabled) {
    addLayer(map);
  } else {
    removeLayer(map);
  }
};

export const refreshTransparentPixelFilter = (): void => {
  if (!isEnabled()) return;

  const map = getMapInstanceFromWplace() as any;
  if (!map) return;

  const source = map.getSource(FILTER_SOURCE_ID);
  if (!source || !map.getLayer(FILTER_LAYER_ID)) {
    addLayer(map);
    return;
  }

  currentSourceVersion += 1;
  if (trySoftRefreshSource(source)) return;

  removeLayer(map);
  addLayer(map);
};

export const scheduleTransparentPixelFilterRefresh = (): void => {
  if (!isEnabled()) return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshTransparentPixelFilter();
  }, REFRESH_DEBOUNCE_MS);
};

export const setupTransparentPixelFilterOnMapReady = (mapInstance: any): void => {
  const map = mapInstance as any;

  const onStyleData = () => {
    if (!isEnabled()) return;
    addLayer(map);
  };

  map.on("styledata", onStyleData);

  if (isEnabled()) addLayer(map);
};
