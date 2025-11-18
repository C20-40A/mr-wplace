// -----------------------------------------------
// 定数
// -----------------------------------------------
const TILE_SIZE = 256; // タイルのピクセルサイズ (デフォルト値)
const REGION_SIZE_TILES = 4; // 地域のタイルサイズ (例: 4x4タイル)
const ZOOM_LEVEL = 11; // デフォルトのズームレベル (デフォルト値)
// 地球の半径 (メートル)
// 6378137mはWGS 84における長半径
const EARTH_RADIUS_METERS = 6378137;
// 地球の半周長（約20,037,508.34m）
// (2 * Math.PI * 6378137) / 2 = Math.PI * 6378137
const EARTH_HALF_CIRCUMFERENCE_METERS: number = Math.PI * EARTH_RADIUS_METERS;
// ズームレベル0での解像度 (メートル/ピクセル)
const initialResolution: number =
  (2 * EARTH_HALF_CIRCUMFERENCE_METERS) / TILE_SIZE;

// -----------------------------------------------
// lat/lon -> meters
// 緯度・経度からメルカトル図法のメートル座標へ変換
// -----------------------------------------------
const latLonToMeters = (lat: number, lon: number): [number, number] => {
  const metersX: number = (lon / 180) * EARTH_HALF_CIRCUMFERENCE_METERS;

  // メルカトル図法のY座標の計算
  // 緯度をラジアンに変換し、Math.tan, Math.logを用いて計算
  const metersY: number =
    ((Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
      EARTH_HALF_CIRCUMFERENCE_METERS) /
    180;

  return [metersX, metersY];
};

// -----------------------------------------------
// meters -> lat/lon
// メルカトル図法のメートル座標から緯度・経度へ変換
// -----------------------------------------------
const metersToLatLon = (metersX: number, metersY: number): [number, number] => {
  const lon: number = (metersX / EARTH_HALF_CIRCUMFERENCE_METERS) * 180;

  // Y座標から緯度への逆変換
  let lat: number = (metersY / EARTH_HALF_CIRCUMFERENCE_METERS) * 180;
  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);

  return [lat, lon];
};

// -----------------------------------------------
// resolution (zoom -> meters/pixel)
// ズームレベルに応じた解像度 (1ピクセルあたりのメートル数) を計算
// -----------------------------------------------
const resolution = (zoom: number): number =>
  initialResolution / Math.pow(2, zoom);

// -----------------------------------------------
// pixels -> meters
// ピクセル座標からメルカトル図法のメートル座標へ変換
// -----------------------------------------------
const pixelsToMeters = (
  pixelX: number,
  pixelY: number,
  zoom: number
): [number, number] => {
  const res: number = resolution(zoom);
  // (0,0)が中心ではなく、左上原点からのピクセル座標と解像度からメートル座標を計算
  const metersX: number = pixelX * res - EARTH_HALF_CIRCUMFERENCE_METERS;
  const metersY: number = EARTH_HALF_CIRCUMFERENCE_METERS - pixelY * res;
  return [metersX, metersY];
};

// -----------------------------------------------
// meters -> pixels
// メルカトル図法のメートル座標からピクセル座標へ変換
// -----------------------------------------------
const metersToPixels = (
  metersX: number,
  metersY: number,
  zoom: number
): [number, number] => {
  const res: number = resolution(zoom);
  const pixelX: number = (metersX + EARTH_HALF_CIRCUMFERENCE_METERS) / res;
  const pixelY: number = (EARTH_HALF_CIRCUMFERENCE_METERS - metersY) / res;
  return [pixelX, pixelY];
};

// -----------------------------------------------
// lat/lon -> pixels
// 緯度・経度からピクセル座標へ変換
// -----------------------------------------------
const latLonToPixels = (
  lat: number,
  lon: number,
  zoom: number
): [number, number] => {
  const [metersX, metersY]: [number, number] = latLonToMeters(lat, lon);
  return metersToPixels(metersX, metersY, zoom);
};

// -----------------------------------------------
// lat/lon -> pixels (Floor)
// 緯度・経度からピクセル座標へ変換し、小数点以下を切り捨て
// -----------------------------------------------
const latLonToPixelsFloor = (
  lat: number,
  lon: number,
  zoom: number
): [number, number] => {
  const [px, py]: [number, number] = latLonToPixels(lat, lon, zoom);
  return [Math.floor(px), Math.floor(py)];
};

// -----------------------------------------------
// pixels -> tile index
// ピクセル座標からタイルインデックスへ変換
// -----------------------------------------------
const pixelsToTile = (pixelX: number, pixelY: number): [number, number] => {
  return [Math.floor(pixelX / TILE_SIZE), Math.floor(pixelY / TILE_SIZE)];
};

// -----------------------------------------------
// lat/lon -> tile index
// 緯度・経度からタイルインデックスへ変換
// -----------------------------------------------
export const latLonToTile = (
  lat: number,
  lon: number,
  zoom: number = ZOOM_LEVEL
): [number, number] => {
  const [pixelX, pixelY]: [number, number] = latLonToPixels(lat, lon, zoom);
  return [Math.floor(pixelX / TILE_SIZE), Math.floor(pixelY / TILE_SIZE)];
};

// -----------------------------------------------
// pixels -> tile + local pixel
// ピクセル座標からタイルインデックスとタイル内のローカルピクセル座標へ変換
// -----------------------------------------------
export const pixelsToTileLocal = (
  pixelX: number,
  pixelY: number
): { tile: [number, number]; pixel: [number, number] } => {
  return {
    tile: pixelsToTile(pixelX, pixelY),
    pixel: [pixelX % TILE_SIZE, pixelY % TILE_SIZE],
  };
};

// -----------------------------------------------
// tile -> meters bounding box
// タイルインデックスからメートル座標のバウンディングボックスへ変換
// -----------------------------------------------
const tileBounds = (
  tileX: number,
  tileY: number,
  zoom: number
): { min: [number, number]; max: [number, number] } => {
  const [minMX, minMY]: [number, number] = pixelsToMeters(
    tileX * TILE_SIZE,
    tileY * TILE_SIZE,
    zoom
  );
  const [maxMX, maxMY]: [number, number] = pixelsToMeters(
    (tileX + 1) * TILE_SIZE,
    (tileY + 1) * TILE_SIZE,
    zoom
  );

  return {
    min: [minMX, minMY],
    max: [maxMX, maxMY],
  };
};

// -----------------------------------------------
// tile -> lat/lon bounding box
// タイルインデックスから緯度・経度のバウンディングボックスへ変換
// -----------------------------------------------
export const tileBoundsLatLon = (
  tileX: number,
  tileY: number,
  zoom: number = ZOOM_LEVEL
): { min: [number, number]; max: [number, number] } => {
  const b: { min: [number, number]; max: [number, number] } = tileBounds(
    tileX,
    tileY,
    zoom
  );
  return {
    min: metersToLatLon(b.min[0], b.max[1]), // 最大緯度、最小経度 (MercatorではYの最小が南、最大が北)
    max: metersToLatLon(b.max[0], b.min[1]), // 最小緯度、最大経度
  };
};

// -----------------------------------------------
// meters -> tile
// メートル座標からタイルインデックスへ変換 (ヘルパー関数としてのみ使用)
// -----------------------------------------------
const metersToTile = (
  metersX: number,
  metersY: number,
  zoom: number
): [number, number] => {
  const [pixelX, pixelY]: [number, number] = metersToPixels(
    metersX,
    metersY,
    zoom
  );
  return pixelsToTile(pixelX, pixelY);
};

// -----------------------------------------------
// lat/lon -> tile + pixel local index
// 緯度・経度からタイルインデックスとタイル内のローカルピクセル座標へ変換
// -----------------------------------------------
export const latLonToTileAndPixel = (
  lat: number,
  lon: number,
  zoom: number = ZOOM_LEVEL
): { tile: [number, number]; pixel: [number, number] } => {
  const [metersX, metersY]: [number, number] = latLonToMeters(lat, lon);
  const [tileX, tileY]: [number, number] = metersToTile(metersX, metersY, zoom);
  const [pixelX, pixelY]: [number, number] = metersToPixels(
    metersX,
    metersY,
    zoom
  );

  return {
    tile: [tileX, tileY],
    // TILE_SIZE を使用。ピクセル座標は浮動小数点数の可能性があるため、一度Math.floorしてから剰余を計算
    pixel: [Math.floor(pixelX) % TILE_SIZE, Math.floor(pixelY) % TILE_SIZE],
  };
};

// -----------------------------------------------
// pixel -> meters bounding
// ピクセル座標からメートル座標のバウンディングボックスへ変換
// -----------------------------------------------
const pixelBounds = (
  pixelX: number,
  pixelY: number,
  zoom: number
): { min: [number, number]; max: [number, number] } => {
  return {
    min: pixelsToMeters(pixelX, pixelY, zoom),
    max: pixelsToMeters(pixelX + 1, pixelY + 1, zoom),
  };
};

// -----------------------------------------------
// pixel -> lat/lon bounding box（補正付き）
// ピクセル座標から緯度・経度のバウンディングボックスへ変換（補正あり）
// -----------------------------------------------
export const pixelToBoundsLatLon = (
  pixelX: number,
  pixelY: number,
  zoom: number = ZOOM_LEVEL
): { min: [number, number]; max: [number, number] } => {
  const b: { min: [number, number]; max: [number, number] } = pixelBounds(
    pixelX,
    pixelY,
    zoom
  );

  const adjust: number = 0.001885; // 補正係数
  const widthMeters: number = (b.max[0] - b.min[0]) * adjust;
  const heightMeters: number = (b.max[1] - b.min[1]) * adjust;

  // バウンディングボックスの座標を補正
  b.min[0] -= widthMeters;
  b.max[0] -= widthMeters;
  b.min[1] -= heightMeters;
  b.max[1] -= heightMeters;

  return {
    min: metersToLatLon(b.min[0], b.max[1]), // 最大緯度、最小経度
    max: metersToLatLon(b.max[0], b.min[1]), // 最小緯度、最大経度
  };
};

// -----------------------------------------------
// lat/lon -> region + pixel local index
// 緯度・経度からリージョンインデックスとリージョン内のローカルピクセル座標へ変換
// -----------------------------------------------
export const latLonToRegionAndPixel = (
  lat: number,
  lon: number,
  zoom: number = ZOOM_LEVEL,
  regionSizeTiles: number = REGION_SIZE_TILES
): { region: [number, number]; pixel: [number, number] } => {
  const [pixelX, pixelY]: [number, number] = latLonToPixelsFloor(
    lat,
    lon,
    zoom
  );

  // TILE_SIZE を使用
  const regionPixelSpan: number = TILE_SIZE * regionSizeTiles;

  return {
    region: [
      Math.floor(pixelX / regionPixelSpan),
      Math.floor(pixelY / regionPixelSpan),
    ],
    pixel: [pixelX % regionPixelSpan, pixelY % regionPixelSpan],
  };
};
