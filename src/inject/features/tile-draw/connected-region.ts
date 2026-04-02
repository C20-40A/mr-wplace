import { latLngToTilePixel } from "@/utils/coordinate";
import { TILE_DRAW_CONSTANTS } from "./constants";
import { getOriginalBlob } from "./last-modified-cache";

type TilePixelColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type DecodedTile = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

export type ConnectedTileRegion = {
  dataUrl: string;
  width: number;
  height: number;
  pixelCount: number;
  origin: {
    TLX: number;
    TLY: number;
    PxX: number;
    PxY: number;
  };
};

const MAX_SELECTED_PIXELS = 200_000;
const tileDecodeCache = new Map<string, Promise<DecodedTile | null>>();

const toWorldPixel = (lat: number, lng: number) => {
  const coords = latLngToTilePixel(lat, lng);

  return {
    x: coords.TLX * TILE_DRAW_CONSTANTS.TILE_SIZE + coords.PxX,
    y: coords.TLY * TILE_DRAW_CONSTANTS.TILE_SIZE + coords.PxY,
  };
};

const toTileKey = (tileX: number, tileY: number): string => `${tileX},${tileY}`;
const toVisitedKey = (x: number, y: number): string => `${x},${y}`;
const isTransparentPixel = (pixel: TilePixelColor | null): boolean => !pixel || pixel.a === 0;

const worldToTilePixel = (worldX: number, worldY: number) => {
  const tileSize = TILE_DRAW_CONSTANTS.TILE_SIZE;
  const tileX = Math.floor(worldX / tileSize);
  const tileY = Math.floor(worldY / tileSize);

  return {
    TLX: tileX,
    TLY: tileY,
    PxX: worldX - tileX * tileSize,
    PxY: worldY - tileY * tileSize,
  };
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to convert blob to dataUrl"));
    reader.readAsDataURL(blob);
  });

const createRasterCanvas = (
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const getRasterContext = (
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get tile canvas context");
  if ("drawImage" in ctx && "getImageData" in ctx) return ctx;

  throw new Error("Failed to get raster 2d context");
};

const decodeTileBlob = async (blob: Blob): Promise<DecodedTile> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = createRasterCanvas(bitmap.width, bitmap.height);
  const ctx = getRasterContext(canvas);

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return {
    width: canvas.width,
    height: canvas.height,
    pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
  };
};

const getDecodedTile = async (tileX: number, tileY: number): Promise<DecodedTile | null> => {
  const tileKey = toTileKey(tileX, tileY);
  const cached = tileDecodeCache.get(tileKey);
  if (cached) return cached;

  const blob = getOriginalBlob(tileKey);
  if (!blob) return null;

  const promise = decodeTileBlob(blob).catch((error) => {
    tileDecodeCache.delete(tileKey);
    throw error;
  });

  tileDecodeCache.set(tileKey, promise);
  return promise;
};

const getTilePixelAtWorld = async (
  worldX: number,
  worldY: number,
): Promise<TilePixelColor | null> => {
  const tileSize = TILE_DRAW_CONSTANTS.TILE_SIZE;
  const tileX = Math.floor(worldX / tileSize);
  const tileY = Math.floor(worldY / tileSize);
  const pixelX = worldX - tileX * tileSize;
  const pixelY = worldY - tileY * tileSize;
  const tile = await getDecodedTile(tileX, tileY);

  if (!tile) return null;
  if (pixelX < 0 || pixelY < 0 || pixelX >= tile.width || pixelY >= tile.height)
    return null;

  const offset = (pixelY * tile.width + pixelX) * 4;
  return {
    r: tile.pixels[offset],
    g: tile.pixels[offset + 1],
    b: tile.pixels[offset + 2],
    a: tile.pixels[offset + 3],
  };
};

const renderSelectedRegion = async (
  width: number,
  height: number,
  selected: Map<string, TilePixelColor>,
  minX: number,
  minY: number,
): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get export canvas context");

  const imageData = ctx.createImageData(width, height);
  for (const [key, pixel] of selected.entries()) {
    const [xText, yText] = key.split(",");
    const x = Number.parseInt(xText, 10);
    const y = Number.parseInt(yText, 10);
    const offset = ((y - minY) * width + (x - minX)) * 4;

    imageData.data[offset] = pixel.r;
    imageData.data[offset + 1] = pixel.g;
    imageData.data[offset + 2] = pixel.b;
    imageData.data[offset + 3] = pixel.a;
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }
      reject(new Error("Failed to create selected tile blob"));
    }, "image/png");
  });

  return blobToDataUrl(blob);
};

export const getTilePixelColor = async (
  lat: number,
  lng: number,
): Promise<TilePixelColor | null> => {
  const start = toWorldPixel(lat, lng);
  return getTilePixelAtWorld(start.x, start.y);
};

export const extractConnectedTileRegion = async (
  lat: number,
  lng: number,
): Promise<ConnectedTileRegion | null> => {
  const start = toWorldPixel(lat, lng);
  const startPixel = await getTilePixelAtWorld(start.x, start.y);
  if (isTransparentPixel(startPixel)) return null;

  const queue: Array<[number, number]> = [[start.x, start.y]];
  const visited = new Set<string>();
  const selected = new Map<string, TilePixelColor>();
  let queueIndex = 0;

  let minX = start.x;
  let minY = start.y;
  let maxX = start.x;
  let maxY = start.y;

  while (queueIndex < queue.length) {
    const [x, y] = queue[queueIndex++];
    const key = toVisitedKey(x, y);
    if (visited.has(key)) continue;
    visited.add(key);

    const pixel = await getTilePixelAtWorld(x, y);
    if (isTransparentPixel(pixel)) continue;

    selected.set(key, pixel as TilePixelColor);
    if (selected.size > MAX_SELECTED_PIXELS) {
      throw new Error("Selected tile region is too large");
    }

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  return {
    dataUrl: await renderSelectedRegion(width, height, selected, minX, minY),
    width,
    height,
    pixelCount: selected.size,
    origin: worldToTilePixel(minX, minY),
  };
};
