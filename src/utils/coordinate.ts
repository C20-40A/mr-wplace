export function llzToTilePixel(lat: number, lng: number) {
  const tileSize = 1000;
  const zoom = 11;

  // 世界ピクセル座標（tileSize * 2^z が世界全体のピクセル幅/高さ）
  const scale = tileSize * Math.pow(2, zoom);

  // 経度→X は線形
  const worldX = ((lng + 180) / 360) * scale;

  // 緯度→Y はメルカトル（XYZは上原点なので0.5-...）
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const worldY =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;

  // タイル番号（左上=TL）
  const TLX = Math.floor(worldX / tileSize);
  const TLY = Math.floor(worldY / tileSize);

  // タイル内ピクセル
  const PxX = Math.floor(worldX - TLX * tileSize);
  const PxY = Math.floor(worldY - TLY * tileSize);

  return { TLX, TLY, PxX, PxY, worldX, worldY };
}

// タイル座標から緯度経度への逆変換
export function tileToLatLng(tileX: number, tileY: number) {
  const tileSize = 1000;
  const zoom = 11;
  const N = tileSize * Math.pow(2, zoom); // 世界全体のピクセル数

  // タイル中央のワールドピクセル座標
  const worldX = tileX * tileSize + tileSize / 2;
  const worldY = tileY * tileSize + tileSize / 2;

  // Web Mercator 逆変換
  const lng = (worldX / N) * 360 - 180;
  const lat =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / N))) * 180) / Math.PI;

  return { lat, lng };
}
