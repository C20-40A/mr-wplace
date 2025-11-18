const TILE_SIZE = 256;
const ZOOM = 11;
const EARTH_RADIUS_METERS = (2 * Math.PI * 6378137) / 2;
const initialResolution = (2 * EARTH_RADIUS_METERS) / TILE_SIZE;

// -----------------------------------------------
// lat/lon -> meters
// -----------------------------------------------
const latLonToMeters = (lat, lon, earthHalfCircumferenceMeters) => {
  const metersX = (lon / 180) * earthHalfCircumferenceMeters;

  const metersY =
    ((Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
      earthHalfCircumferenceMeters) /
    180;

  return [metersX, metersY];
};

// -----------------------------------------------
// meters -> lat/lon
// -----------------------------------------------
const metersToLatLon = (metersX, metersY, earthHalfCircumferenceMeters) => {
  const lon = (metersX / earthHalfCircumferenceMeters) * 180;

  let lat = (metersY / earthHalfCircumferenceMeters) * 180;
  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);

  return [lat, lon];
};

// -----------------------------------------------
// pixels -> meters
// -----------------------------------------------
const pixelsToMeters = (
  pixelX,
  pixelY,
  zoom,
  resolution,
  earthHalfCircumferenceMeters
) => {
  const res = resolution(zoom);
  const metersX = pixelX * res - earthHalfCircumferenceMeters;
  const metersY = earthHalfCircumferenceMeters - pixelY * res;
  return [metersX, metersY];
};

// -----------------------------------------------
// meters -> pixels
// -----------------------------------------------
const metersToPixels = (
  metersX,
  metersY,
  zoom,
  resolution,
  earthHalfCircumferenceMeters
) => {
  const res = resolution(zoom);
  const pixelX = (metersX + earthHalfCircumferenceMeters) / res;
  const pixelY = (earthHalfCircumferenceMeters - metersY) / res;
  return [pixelX, pixelY];
};

// -----------------------------------------------
// lat/lon -> pixels (Floor)
// -----------------------------------------------
const latLonToPixelsFloor = (
  lat,
  lon,
  zoom,
  latLonToPixels,
  resolution,
  earthHalfCircumferenceMeters
) => {
  const [px, py] = latLonToPixels(
    lat,
    lon,
    zoom,
    resolution,
    earthHalfCircumferenceMeters
  );
  return [Math.floor(px), Math.floor(py)];
};

// -----------------------------------------------
// lat/lon -> pixels
// -----------------------------------------------
const latLonToPixels = (
  lat,
  lon,
  zoom,
  resolution,
  earthHalfCircumferenceMeters
) => {
  const [metersX, metersY] = latLonToMeters(
    lat,
    lon,
    earthHalfCircumferenceMeters
  );
  return metersToPixels(
    metersX,
    metersY,
    zoom,
    resolution,
    earthHalfCircumferenceMeters
  );
};

// -----------------------------------------------
// lat/lon -> tile index
// -----------------------------------------------
const latLonToTile = (
  lat,
  lon,
  zoom,
  tileSize,
  earthHalfCircumferenceMeters,
  resolution
) => {
  const [pixelX, pixelY] = latLonToPixels(
    lat,
    lon,
    zoom,
    resolution,
    earthHalfCircumferenceMeters
  );

  return [Math.floor(pixelX / tileSize), Math.floor(pixelY / tileSize)];
};

// -----------------------------------------------
// pixels -> tile index
// -----------------------------------------------
const pixelsToTile = (pixelX, pixelY, tileSize) => {
  return [Math.floor(pixelX / tileSize), Math.floor(pixelY / tileSize)];
};

// -----------------------------------------------
// pixels -> tile + local pixel
// -----------------------------------------------
const pixelsToTileLocal = (pixelX, pixelY, tileSize) => {
  return {
    tile: pixelsToTile(pixelX, pixelY, tileSize),
    pixel: [pixelX % tileSize, pixelY % tileSize],
  };
};

// -----------------------------------------------
// tile -> meters bounding box
// -----------------------------------------------
const tileBounds = (
  tileX,
  tileY,
  zoom,
  pixelsToMeters,
  resolution,
  earthHalfCircumferenceMeters,
  tileSize
) => {
  const [minMX, minMY] = pixelsToMeters(
    tileX * tileSize,
    tileY * tileSize,
    zoom,
    resolution,
    earthHalfCircumferenceMeters
  );

  const [maxMX, maxMY] = pixelsToMeters(
    (tileX + 1) * tileSize,
    (tileY + 1) * tileSize,
    zoom,
    resolution,
    earthHalfCircumferenceMeters
  );

  return {
    min: [minMX, minMY],
    max: [maxMX, maxMY],
  };
};

// -----------------------------------------------
// tile -> lat/lon bounding box
// -----------------------------------------------
const tileBoundsLatLon = (
  tileX,
  tileY,
  zoom,
  tileBounds,
  metersToLatLon,
  resolution,
  earthHalfCircumferenceMeters,
  tileSize
) => {
  const b = tileBounds(
    tileX,
    tileY,
    zoom,
    pixelsToMeters,
    resolution,
    earthHalfCircumferenceMeters,
    tileSize
  );

  return {
    min: metersToLatLon(b.min[0], b.min[1], earthHalfCircumferenceMeters),
    max: metersToLatLon(b.max[0], b.max[1], earthHalfCircumferenceMeters),
  };
};

// -----------------------------------------------
// resolution (zoom -> meters/pixel)
// -----------------------------------------------
const resolution = (zoom, initialResolution) => {
  return initialResolution / Math.pow(2, zoom);
};

// -----------------------------------------------
// lat/lon -> tile + pixel local index
// -----------------------------------------------
const latLonToTileAndPixel = (
  lat,
  lon,
  zoom,
  latLonToMeters,
  metersToTile,
  metersToPixels,
  resolution,
  earthHalfCircumferenceMeters,
  tileSize
) => {
  const [metersX, metersY] = latLonToMeters(
    lat,
    lon,
    earthHalfCircumferenceMeters
  );

  const [tileX, tileY] = metersToTile(
    metersX,
    metersY,
    zoom,
    metersToPixels,
    pixelsToTile,
    resolution,
    earthHalfCircumferenceMeters,
    tileSize
  );

  const [pixelX, pixelY] = metersToPixels(
    metersX,
    metersY,
    zoom,
    resolution,
    earthHalfCircumferenceMeters
  );

  return {
    tile: [tileX, tileY],
    pixel: [Math.floor(pixelX) % tileSize, Math.floor(pixelY) % tileSize],
  };
};

// -----------------------------------------------
// pixel -> meters bounding
// -----------------------------------------------
const pixelBounds = (
  pixelX,
  pixelY,
  zoom,
  pixelsToMeters,
  resolution,
  earthHalfCircumferenceMeters
) => {
  return {
    min: pixelsToMeters(
      pixelX,
      pixelY,
      zoom,
      resolution,
      earthHalfCircumferenceMeters
    ),
    max: pixelsToMeters(
      pixelX + 1,
      pixelY + 1,
      zoom,
      resolution,
      earthHalfCircumferenceMeters
    ),
  };
};

// -----------------------------------------------
// pixel -> lat/lon bounding box（補正付き）
// -----------------------------------------------
const pixelToBoundsLatLon = (
  pixelX,
  pixelY,
  zoom,
  pixelBounds,
  metersToLatLon,
  pixelsToMeters,
  resolution,
  earthHalfCircumferenceMeters
) => {
  const b = pixelBounds(
    pixelX,
    pixelY,
    zoom,
    pixelsToMeters,
    resolution,
    earthHalfCircumferenceMeters
  );

  const adjust = 0.001885;
  const widthMeters = (b.max[0] - b.min[0]) * adjust;
  const heightMeters = (b.max[1] - b.min[1]) * adjust;

  b.min[0] -= widthMeters;
  b.max[0] -= widthMeters;
  b.min[1] -= heightMeters;
  b.max[1] -= heightMeters;

  return {
    min: metersToLatLon(b.min[0], b.min[1], earthHalfCircumferenceMeters),
    max: metersToLatLon(b.max[0], b.max[1], earthHalfCircumferenceMeters),
  };
};

// -----------------------------------------------
// lat/lon -> region + pixel local index
// -----------------------------------------------
const latLonToRegionAndPixel = (
  lat,
  lon,
  zoom,
  latLonToPixelsFloor,
  tileSize,
  regionSizeTiles,
  resolution,
  earthHalfCircumferenceMeters
) => {
  const [pixelX, pixelY] = latLonToPixelsFloor(
    lat,
    lon,
    zoom,
    latLonToPixels,
    resolution,
    earthHalfCircumferenceMeters
  );

  const regionPixelSpan = tileSize * regionSizeTiles;

  return {
    region: [
      Math.floor(pixelX / regionPixelSpan),
      Math.floor(pixelY / regionPixelSpan),
    ],
    pixel: [pixelX % regionPixelSpan, pixelY % regionPixelSpan],
  };
};
