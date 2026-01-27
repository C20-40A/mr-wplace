import { getMapInstanceFromWplace } from "./map-instance";
import {
  latLonToPixels,
  pixelsToMeters,
  metersToLatLon,
  ZOOM_LEVEL,
} from "@/utils/geo-converter";

const GRID_LAYER_ID = "mr-wplace-grid-layer";
const GRID_SOURCE_ID = "mr-wplace-grid-source";
const GRID_MIN_ZOOM = 14; // Zoom level to show grid

let gridEnabled = false;
let layerAdded = false;
let moveEndHandler: (() => void) | null = null;

// Pixel range cache for differential updates
let prevPixelRange: {
  sx: number;
  ex: number;
  sy: number;
  ey: number;
} | null = null;

/**
 * ワールドピクセル座標から緯度経度へ変換
 */
const pixelToLatLng = (pixelX: number, pixelY: number) => {
  const [metersX, metersY] = pixelsToMeters(pixelX, pixelY, ZOOM_LEVEL);
  const [lat, lng] = metersToLatLon(metersX, metersY);
  return { lat, lng };
};

/**
 * 現在のビューポートに基づいてグリッド線を生成（最適化版：Feature 1個に統合）
 */
const generateGridGeoJSON = (
  startPxX: number,
  endPxX: number,
  startPxY: number,
  endPxY: number
) => {
  const allLines: number[][][] = [];

  // 縦線（X方向のピクセル境界）
  for (let pxX = startPxX; pxX <= endPxX; pxX++) {
    const top = pixelToLatLng(pxX, startPxY);
    const bottom = pixelToLatLng(pxX, endPxY);
    allLines.push([
      [top.lng, top.lat],
      [bottom.lng, bottom.lat],
    ]);
  }

  // 横線（Y方向のピクセル境界）
  for (let pxY = startPxY; pxY <= endPxY; pxY++) {
    const left = pixelToLatLng(startPxX, pxY);
    const right = pixelToLatLng(endPxX, pxY);
    allLines.push([
      [left.lng, left.lat],
      [right.lng, right.lat],
    ]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiLineString",
          coordinates: allLines,
        },
      },
    ],
  };
};

const EMPTY_GRID = {
  type: "FeatureCollection",
  features: [],
};

/**
 * グリッドソースを更新（差分チェック最適化版）
 */
const updateGridSource = (map: any): void => {
  // zoom < 14 は完全スキップ（最重要最適化）
  if (map.getZoom() < GRID_MIN_ZOOM) return;

  const source = map.getSource(GRID_SOURCE_ID) as any;
  if (!source) return;

  // Pixel range 計算
  const bounds = map.getBounds();
  // latLonToPixels returns [pixelX, pixelY]
  // North = 高緯度 = 小さい pixelY, South = 低緯度 = 大きい pixelY
  // West = 小さい pixelX, East = 大きい pixelX
  const [westPx, northPy] = latLonToPixels(
    bounds.getNorth(),
    bounds.getWest(),
    ZOOM_LEVEL
  );
  const [eastPx, southPy] = latLonToPixels(
    bounds.getSouth(),
    bounds.getEast(),
    ZOOM_LEVEL
  );

  const sx = Math.floor(westPx);
  const ex = Math.ceil(eastPx);
  const sy = Math.floor(northPy);
  const ey = Math.ceil(southPy);

  // 差分チェック - 前回と同じ範囲なら何もしない（最大の最適化）
  if (
    prevPixelRange &&
    prevPixelRange.sx === sx &&
    prevPixelRange.ex === ex &&
    prevPixelRange.sy === sy &&
    prevPixelRange.ey === ey
  ) {
    return;
  }

  // 範囲を保存
  prevPixelRange = { sx, ex, sy, ey };

  // GeoJSON 生成 & 更新
  const data = generateGridGeoJSON(sx, ex, sy, ey);
  source.setData(data);
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
      data: EMPTY_GRID,
    });
  }

  // lineレイヤーを追加
  map.addLayer({
    id: GRID_LAYER_ID,
    type: "line",
    source: GRID_SOURCE_ID,
    minzoom: GRID_MIN_ZOOM,
    paint: {
      "line-color": "rgba(100, 100, 100, 0.5)",
      "line-width": 1,
    },
  });

  // 移動時にグリッドを更新
  moveEndHandler = () => updateGridSource(map);
  map.on("moveend", moveEndHandler);

  layerAdded = true;

  // 初回更新（zoom >= 14 なら即座に表示）
  updateGridSource(map);

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

  // キャッシュクリア
  prevPixelRange = null;
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
    // キャッシュクリアして再描画
    prevPixelRange = null;
    layerAdded = false;
    addGridLayer(map);
  };

  map.on("styledata", onStyleData);
  console.log("🧑‍🎨 : Grid display listener setup complete");
};
