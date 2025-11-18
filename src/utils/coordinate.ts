import {
  latLonToTileAndPixel,
  pixelsToMeters,
  metersToLatLon,
  TILE_SIZE,
} from "./geo-converter";

/**
 * 緯度・経度からタイルインデックスとタイル内ピクセル座標へ変換
 */
export const latLngToTilePixel = (lat: number, lng: number) => {
  const { tile, pixel } = latLonToTileAndPixel(lat, lng);
  return { TLX: tile[0], TLY: tile[1], PxX: pixel[0], PxY: pixel[1] };
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
