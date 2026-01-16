import { getMapInstanceFromWplace } from "./map-instance";
import {
  latLonToPixels,
  pixelsToMeters,
  metersToLatLon,
  ZOOM_LEVEL,
} from "@/utils/geo-converter";

const GRID_LAYER_ID = "mr-wplace-grid-layer";
const GRID_SOURCE_ID = "mr-wplace-grid-source";

let gridEnabled = false;
let layerAdded = false;
let moveEndHandler: (() => void) | null = null;

/**
 * ワールドピクセル座標から緯度経度へ変換
 */
const pixelToLatLng = (pixelX: number, pixelY: number) => {
  const [metersX, metersY] = pixelsToMeters(pixelX, pixelY, ZOOM_LEVEL);
  const [lat, lng] = metersToLatLon(metersX, metersY);
  return { lat, lng };
};

/**
 * 緯度経度からワールドピクセル座標へ変換
 */
const latLngToPixel = (lat: number, lng: number) => {
  const [pixelX, pixelY] = latLonToPixels(lat, lng, ZOOM_LEVEL);
  return { pixelX, pixelY };
};

/**
 * 現在のビューポートに基づいてグリッド線を生成
 */
const generateGridForBounds = (map: any) => {
  const bounds = map.getBounds();
  const minLng = bounds.getWest();
  const maxLng = bounds.getEast();
  const minLat = bounds.getSouth();
  const maxLat = bounds.getNorth();

  // ビューポートの四隅をピクセル座標に変換
  const topLeft = latLngToPixel(maxLat, minLng);
  const bottomRight = latLngToPixel(minLat, maxLng);

  // ピクセル座標の範囲（整数に丸める）
  const startPxX = Math.floor(topLeft.pixelX);
  const endPxX = Math.ceil(bottomRight.pixelX);
  const startPxY = Math.floor(topLeft.pixelY);
  const endPxY = Math.ceil(bottomRight.pixelY);

  const features: any[] = [];

  // 縦線（X方向のピクセル境界）
  for (let pxX = startPxX; pxX <= endPxX; pxX++) {
    const top = pixelToLatLng(pxX, startPxY);
    const bottom = pixelToLatLng(pxX, endPxY);
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [top.lng, top.lat],
          [bottom.lng, bottom.lat],
        ],
      },
    });
  }

  // 横線（Y方向のピクセル境界）
  for (let pxY = startPxY; pxY <= endPxY; pxY++) {
    const left = pixelToLatLng(startPxX, pxY);
    const right = pixelToLatLng(endPxX, pxY);
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [left.lng, left.lat],
          [right.lng, right.lat],
        ],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

/**
 * グリッドソースを更新
 */
const updateGridSource = (map: any): void => {
  const source = map.getSource(GRID_SOURCE_ID);
  if (source) {
    source.setData(generateGridForBounds(map));
  }
};

/**
 * グリッドレイヤーを追加
 */
const addGridLayer = (map: any): void => {
  if (layerAdded) return;
  if (map.getLayer(GRID_LAYER_ID)) {
    layerAdded = true;
    return;
  }

  // ソースを追加
  if (!map.getSource(GRID_SOURCE_ID)) {
    map.addSource(GRID_SOURCE_ID, {
      type: "geojson",
      data: generateGridForBounds(map),
    });
  }

  // lineレイヤーを追加
  map.addLayer({
    id: GRID_LAYER_ID,
    type: "line",
    source: GRID_SOURCE_ID,
    minzoom: 15,
    paint: {
      "line-color": "rgba(100, 100, 100, 0.5)",
      "line-width": 1,
    },
  });

  // 移動時にグリッドを更新
  moveEndHandler = () => updateGridSource(map);
  map.on("moveend", moveEndHandler);

  layerAdded = true;
  console.log("🧑‍🎨 : Grid layer added");
};

/**
 * グリッドレイヤーを削除
 */
const removeGridLayer = (map: any): void => {
  if (!layerAdded) return;

  if (moveEndHandler) {
    map.off("moveend", moveEndHandler);
    moveEndHandler = null;
  }

  if (map.getLayer(GRID_LAYER_ID)) {
    map.removeLayer(GRID_LAYER_ID);
  }
  if (map.getSource(GRID_SOURCE_ID)) {
    map.removeSource(GRID_SOURCE_ID);
  }

  layerAdded = false;
  console.log("🧑‍🎨 : Grid layer removed");
};

/**
 * グリッド表示を切り替え
 */
export const setGridDisplayEnabled = (enabled: boolean): void => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for grid display");
    return;
  }

  gridEnabled = enabled;

  if (enabled) {
    addGridLayer(map);
  } else {
    removeGridLayer(map);
  }

  console.log("🧑‍🎨 : Grid display enabled:", enabled);
};

/**
 * styledataイベントでレイヤー再適用
 */
export const setupGridDisplayOnMapReady = (mapInstance: any): void => {
  const map = mapInstance as any;

  const onStyleData = () => {
    if (!gridEnabled) return;
    layerAdded = false;
    addGridLayer(map);
  };

  map.on("styledata", onStyleData);
  console.log("🧑‍🎨 : Grid display listener setup complete");
};
