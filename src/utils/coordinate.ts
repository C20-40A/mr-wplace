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
