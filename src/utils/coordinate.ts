import {
  latLonToTileAndPixel,
  latLonToPixels,
  pixelsToMeters,
  metersToLatLon,
  TILE_SIZE,
} from "./geo-converter";

interface LngLatLike {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6378137;

const toRadians = (value: number): number => (value * Math.PI) / 180;

const normalizeLngDeltaRadians = (delta: number): number => {
  let out = delta;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
};

const normalizeLngNear = (lng: number, baseLng: number): number => {
  let out = lng;
  while (out - baseLng > 180) out -= 360;
  while (out - baseLng < -180) out += 360;
  return out;
};

/**
 * 緯度・経度からタイルインデックスとタイル内ピクセル座標へ変換
 */
export const latLngToTilePixel = (lat: number, lng: number) => {
  const { tile, pixel } = latLonToTileAndPixel(lat, lng);
  return { TLX: tile[0], TLY: tile[1], PxX: pixel[0], PxY: pixel[1] };
};

/**
 * 緯度・経度からタイルインデックスとタイル内ピクセル座標へ変換（round版）
 * wplace本体は整数pixelにroundしてからtile/pixelへ分解するため、
 * 「整数pixel由来のlat/lngをpixelへ戻す往復」ではfloorではなくこちらを使う
 * (floorだと浮動小数点誤差で整数の下側に出た際に1pxずれる)
 */
export const latLngToTilePixelRound = (lat: number, lng: number) => {
  const [px, py] = latLonToPixels(lat, lng);
  const worldX = Math.round(px);
  const worldY = Math.round(py);
  return {
    TLX: Math.floor(worldX / TILE_SIZE),
    TLY: Math.floor(worldY / TILE_SIZE),
    PxX: worldX % TILE_SIZE,
    PxY: worldY % TILE_SIZE,
  };
};

/**
 * 緯度・経度からタイルインデックスとタイル内ピクセル座標へ変換（浮動小数点版）
 * ピクセル境界判定に使用
 */
export const latLngToTilePixelFloat = (lat: number, lng: number) => {
  const [pixelX, pixelY] = latLonToPixels(lat, lng);
  const tileX = Math.floor(pixelX / TILE_SIZE);
  const tileY = Math.floor(pixelY / TILE_SIZE);
  const localPixelX = pixelX - tileX * TILE_SIZE;
  const localPixelY = pixelY - tileY * TILE_SIZE;

  return {
    TLX: tileX,
    TLY: tileY,
    PxX: Math.floor(localPixelX),
    PxY: Math.floor(localPixelY),
    // 元の浮動小数点座標を保持
    pixelXFrac: localPixelX,
    pixelYFrac: localPixelY,
  };
};

/**
 * タイル座標とタイル内ピクセルオフセットから緯度・経度へ逆変換
 */
export const tilePixelToLatLng = (
  tileX: number,
  tileY: number,
  pxX?: number,
  pxY?: number
) => {
  // 1. ワールドピクセル座標を計算: タイル座標 * TILE_SIZE + タイル内オフセット
  const worldX = tileX * TILE_SIZE + (pxX ?? 0);
  const worldY = tileY * TILE_SIZE + (pxY ?? 0);

  // 2. ピクセル座標からメルカトル図法のメートル座標へ変換
  const [metersX, metersY] = pixelsToMeters(worldX, worldY);

  // 3. メートル座標から緯度・経度へ逆変換
  const [lat, lng] = metersToLatLon(metersX, metersY);

  return { lat, lng };
};

/**
 * 緯度経度ポリゴンの測地面積を球面近似で計算 (m²)
 */
export const calculateGeodesicAreaSquareMeters = (
  vertices: LngLatLike[]
): number => {
  const n = vertices.length;
  if (n < 3) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    const lat1 = toRadians(curr.lat);
    const lat2 = toRadians(next.lat);
    const lng1 = toRadians(curr.lng);
    const lng2 = toRadians(next.lng);
    const deltaLng = normalizeLngDeltaRadians(lng2 - lng1);
    sum += deltaLng * (Math.sin(lat1) + Math.sin(lat2));
  }

  const sphereArea = 4 * Math.PI * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS;
  const area = Math.abs(sum) * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS * 0.5;
  const normalized = Math.min(area, sphereArea - area);
  return Number.isFinite(normalized) ? Math.max(0, normalized) : 0;
};

/**
 * Wplace world pixel 座標系でのポリゴン面積 (px²)
 */
export const calculatePixelAreaSquare = (vertices: LngLatLike[]): number => {
  const n = vertices.length;
  if (n < 3) return 0;

  let prevLng = vertices[n - 1].lng;
  let prev = latLonToPixels(vertices[n - 1].lat, prevLng);
  if (!Number.isFinite(prev[0]) || !Number.isFinite(prev[1])) return 0;

  let sum = 0;

  for (let i = 0; i < n; i++) {
    const v = vertices[i];
    const lng = normalizeLngNear(v.lng, prevLng);
    const curr = latLonToPixels(v.lat, lng);
    if (!Number.isFinite(curr[0]) || !Number.isFinite(curr[1])) return 0;

    sum += prev[0] * curr[1] - curr[0] * prev[1];
    prev = curr;
    prevLng = lng;
  }

  return Math.max(0, Math.abs(sum) * 0.5);
};
