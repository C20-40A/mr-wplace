// 必要な定数や外部依存プロパティを引数として追加
const latLonToMeters = (a, d, hs) => {
  const x = (d / 180) * hs;
  const k =
    ((Math.log(Math.tan(((90 + a) * Math.PI) / 360)) / (Math.PI / 180)) * hs) /
    180;
  return [x, k];
};

const metersToLatLon = (a, d, hs) => {
  const x = (a / hs) * 180;
  let k = (d / hs) * 180;
  k =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((k * Math.PI) / 180)) - Math.PI / 2);
  return [k, x];
};

const pixelsToMeters = (a, d, x, resolution, hs) => {
  // resolution(x)を外部から渡されたresolution関数で呼び出す
  const k = resolution(x);
  const D = a * k - hs;
  const b = hs - d * k;
  return [D, b];
};

const pixelsToLatLon = (
  a,
  d,
  x,
  pixelsToMeters,
  metersToLatLon,
  resolution,
  hs
) => {
  // 依存メソッドも引数として受け取る
  const [k, D] = pixelsToMeters(a, d, x, resolution, hs);
  return metersToLatLon(k, D, hs);
};

const latLonToPixels = (
  a,
  d,
  x,
  latLonToMeters,
  metersToPixels,
  resolution,
  hs
) => {
  const [k, D] = latLonToMeters(a, d, hs);
  return metersToPixels(k, D, x, resolution, hs);
};

const latLonToPixelsFloor = (a, d, x, latLonToPixels, resolution, hs) => {
  const [k, D] = latLonToPixels(a, d, x, resolution, hs);
  return [Math.floor(k), Math.floor(D)];
};

const metersToPixels = (a, d, x, resolution, hs) => {
  // resolution(x)を外部から渡されたresolution関数で呼び出す
  const k = resolution(x);
  const D = (a + hs) / k;
  const b = (hs - d) / k;
  return [D, b];
};

const latLonToTile = (a, d, x, latLonToMeters, metersToTile, hs) => {
  const [k, D] = latLonToMeters(a, d, hs);
  return metersToTile(k, D, x);
};

const metersToTile = (
  a,
  d,
  x,
  metersToPixels,
  pixelsToTile,
  resolution,
  hs,
  tileSize
) => {
  // 依存メソッドも引数として受け取る
  const [k, D] = metersToPixels(a, d, x, resolution, hs);
  return pixelsToTile(k, D, tileSize);
};

const pixelsToTile = (a, d, tileSize) => {
  // this.tileSizeを引数として受け取る
  const x = Math.ceil(a / tileSize) - 1;
  const k = Math.ceil(d / tileSize) - 1;
  return [x, k];
};

const pixelsToTileLocal = (a, d, pixelsToTile, tileSize) => {
  return {
    tile: pixelsToTile(a, d, tileSize),
    pixel: [Math.floor(a) % tileSize, Math.floor(d) % tileSize],
  };
};

const tileBounds = (a, d, x, pixelsToMeters, resolution, hs, tileSize) => {
  // this.tileSizeを引数として受け取る
  const [k, D] = pixelsToMeters(a * tileSize, d * tileSize, x, resolution, hs);
  const [b, s] = pixelsToMeters(
    (a + 1) * tileSize,
    (d + 1) * tileSize,
    x,
    resolution,
    hs
  );
  return {
    min: [k, D],
    max: [b, s],
  };
};

const tileBoundsLatLon = (
  a,
  d,
  x,
  tileBounds,
  metersToLatLon,
  resolution,
  hs,
  tileSize
) => {
  // 依存メソッドも引数として受け取る
  const k = tileBounds(a, d, x, pixelsToMeters, resolution, hs, tileSize);
  return {
    min: metersToLatLon(k.min[0], k.min[1], hs),
    max: metersToLatLon(k.max[0], k.max[1], hs),
  };
};

const resolution = (a, initialResolution) => {
  // this.initialResolutionを引数として受け取る
  return initialResolution / 2 ** a;
};

const latLonToTileAndPixel = (
  a,
  d,
  x,
  latLonToMeters,
  metersToTile,
  metersToPixels,
  resolution,
  hs,
  tileSize
) => {
  const [k, D] = latLonToMeters(a, d, hs);
  // 依存メソッドには必要な引数を渡す
  const [b, s] = metersToTile(
    k,
    D,
    x,
    metersToPixels,
    pixelsToTile,
    resolution,
    hs,
    tileSize
  );
  const [O, V] = metersToPixels(k, D, x, resolution, hs);
  return {
    tile: [b, s],
    pixel: [Math.floor(O) % tileSize, Math.floor(V) % tileSize],
  };
};

const pixelBounds = (a, d, x, pixelsToMeters, resolution, hs) => {
  return {
    min: pixelsToMeters(a, d, x, resolution, hs),
    max: pixelsToMeters(a + 1, d + 1, x, resolution, hs),
  };
};

const pixelToBoundsLatLon = (
  a,
  d,
  x,
  pixelBounds,
  metersToLatLon,
  pixelsToMeters,
  resolution,
  hs
) => {
  // 依存メソッドも引数として受け取る
  const k = pixelBounds(a, d, x, pixelsToMeters, resolution, hs);
  const D = 0.001885;
  const b = (k.max[0] - k.min[0]) * D;
  const s = (k.max[1] - k.min[1]) * D;

  // 変数の代入をアロー関数内で実行
  k.min[0] -= b;
  k.max[0] -= b;
  k.min[1] -= s;
  k.max[1] -= s;

  return {
    min: metersToLatLon(k.min[0], k.min[1], hs),
    max: metersToLatLon(k.max[0], k.max[1], hs),
  };
};

const latLonToTileBoundsLatLon = (
  a,
  d,
  x,
  latLonToMeters,
  metersToTile,
  tileBoundsLatLon,
  resolution,
  hs,
  tileSize
) => {
  // 依存メソッドも引数として受け取る
  const [k, D] = latLonToMeters(a, d, hs);
  const [b, s] = metersToTile(
    k,
    D,
    x,
    metersToPixels,
    pixelsToTile,
    resolution,
    hs,
    tileSize
  );
  return tileBoundsLatLon(
    b,
    s,
    x,
    tileBounds,
    metersToLatLon,
    resolution,
    hs,
    tileSize
  );
};

const latLonToPixelBoundsLatLon = (
  a,
  d,
  x,
  latLonToMeters,
  metersToPixels,
  pixelToBoundsLatLon,
  resolution,
  hs
) => {
  // 依存メソッドも引数として受け取る
  const [k, D] = latLonToMeters(a, d, hs);
  const [b, s] = metersToPixels(k, D, x, resolution, hs);
  return pixelToBoundsLatLon(
    Math.floor(b),
    Math.floor(s),
    x,
    pixelBounds,
    metersToLatLon,
    pixelsToMeters,
    resolution,
    hs
  );
};

const latLonToRegionAndPixel = (
  a,
  d,
  x,
  latLonToPixelsFloor,
  tileSize,
  wa_regionSize,
  resolution,
  hs,
  k = wa_regionSize
) => {
  // 依存メソッド/プロパティも引数として受け取る
  const [D, b] = latLonToPixelsFloor(a, d, x, latLonToPixels, resolution, hs);
  const s = tileSize * k;
  return {
    region: [Math.floor(D / s), Math.floor(b / s)],
    pixel: [D % s, b % s],
  };
};
