import { getOriginalBlob, getOriginalLastModified } from "../../tile-draw";

const TILE_SIZE = 1000;
const FILTER_TILE_URL_ORIGIN = "https://backend.wplace.live";
const FILTER_TILE_URL_PATH_PREFIX = "/mr-wplace/transparent-pixel-filter";
const CACHE_CONTROL_HEADER = "public, max-age=31536000, immutable";
const MIN_ZOOM = 11;
const MAX_ZOOM = 11;
const FILTER_RENDER_CACHE_MAX = 40;
const DARK_OVERLAY = "rgba(0, 0, 0, 0.58)";
const HIGHLIGHT_RGB: [number, number, number] = [255, 64, 64];
const HIGHLIGHT_ALPHA = 235;

let emptyTileBlobPromise: Promise<Blob> | null = null;
const renderedTileCache = new Map<string, { token: string; blob: Blob }>();

export const buildTransparentPixelFilterTileUrl = (version: number): string =>
  `${FILTER_TILE_URL_ORIGIN}${FILTER_TILE_URL_PATH_PREFIX}/{z}/{x}/{y}.png?v=${version}`;

const getRequestedStateVersion = (url: string): string => {
  const match = url.match(/[?&]v=(\d+)/);
  if (match) return match[1];
  return "0";
};

const getFilterRenderCacheKey = (x: number, y: number): string => `${x},${y}`;

const getCachedRenderedTile = (
  cacheKey: string,
  token: string | null,
): Blob | null => {
  if (!token) return null;
  const cached = renderedTileCache.get(cacheKey);
  if (!cached || cached.token !== token) return null;
  renderedTileCache.delete(cacheKey);
  renderedTileCache.set(cacheKey, cached);
  return cached.blob;
};

const setCachedRenderedTile = (
  cacheKey: string,
  token: string | null,
  blob: Blob,
): void => {
  if (!token) return;
  if (renderedTileCache.has(cacheKey)) {
    renderedTileCache.delete(cacheKey);
  } else if (renderedTileCache.size >= FILTER_RENDER_CACHE_MAX) {
    const oldest = renderedTileCache.keys().next().value;
    if (oldest) renderedTileCache.delete(oldest);
  }
  renderedTileCache.set(cacheKey, { token, blob });
};

const buildLastModifiedToken = (
  x: number,
  y: number,
  stateVersion: string,
): string | null => {
  const lastModified = getOriginalLastModified(`${x},${y}`);
  if (!lastModified) return null;
  return `${stateVersion}|${lastModified}`;
};

const loadImageData = async (blob: Blob): Promise<ImageData> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error("transparent pixel filter context unavailable");
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
};

const renderTransparentPixelFilterTile = async (blob: Blob): Promise<Blob> => {
  const imageData = await loadImageData(blob);
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("transparent pixel filter render context unavailable");

  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = DARK_OVERLAY;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  const overlay = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const source = imageData.data;
  const target = overlay.data;

  for (let i = 0; i < source.length; i += 4) {
    if (source[i + 3] !== 0) continue;
    target[i] = HIGHLIGHT_RGB[0];
    target[i + 1] = HIGHLIGHT_RGB[1];
    target[i + 2] = HIGHLIGHT_RGB[2];
    target[i + 3] = HIGHLIGHT_ALPHA;
  }

  ctx.putImageData(overlay, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
};

const createTransparentTileBlob = async (): Promise<Blob> => {
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("transparent pixel empty tile context unavailable");
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
  return canvas.convertToBlob({ type: "image/png" });
};

const getTransparentTileBlob = (): Promise<Blob> => {
  if (!emptyTileBlobPromise) emptyTileBlobPromise = createTransparentTileBlob();
  return emptyTileBlobPromise;
};

const createTileResponse = (blob: Blob): Response =>
  new Response(blob, {
    status: 200,
    headers: new Headers({
      "Content-Type": "image/png",
      "Cache-Control": CACHE_CONTROL_HEADER,
    }),
  });

const createEmptyTileResponse = (): Response => {
  const emptyPng = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
    0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120,
    156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 46, 180, 0, 0, 0, 0, 73, 69, 78, 68,
    174, 66, 96, 130,
  ]);

  return new Response(emptyPng.buffer, {
    status: 200,
    headers: new Headers({
      "Content-Type": "image/png",
      "Cache-Control": CACHE_CONTROL_HEADER,
    }),
  });
};

export const handleTransparentPixelFilterTileRequest = async (
  url: string,
): Promise<Response> => {
  const tileMatch = url.match(
    /\/transparent-pixel-filter\/(\d+)\/(\d+)\/(\d+)\.png(?:[?#].*)?$/,
  );
  if (!tileMatch) return createEmptyTileResponse();

  const z = parseInt(tileMatch[1], 10);
  const x = parseInt(tileMatch[2], 10);
  const y = parseInt(tileMatch[3], 10);
  if (z < MIN_ZOOM || z > MAX_ZOOM) return createEmptyTileResponse();

  try {
    const stateVersion = getRequestedStateVersion(url);
    const cacheKey = getFilterRenderCacheKey(x, y);
    const token = buildLastModifiedToken(x, y, stateVersion);
    const cached = getCachedRenderedTile(cacheKey, token);
    if (cached) return createTileResponse(cached);

    const originalBlob = getOriginalBlob(cacheKey);
    if (!originalBlob) {
      const emptyBlob = await getTransparentTileBlob();
      return createTileResponse(emptyBlob);
    }

    const renderedBlob = await renderTransparentPixelFilterTile(originalBlob);
    setCachedRenderedTile(cacheKey, token, renderedBlob);
    return createTileResponse(renderedBlob);
  } catch (error) {
    console.error("🧑‍🎨 : Failed to render transparent pixel filter tile:", error);
    return createEmptyTileResponse();
  }
};

export const isTransparentPixelFilterTileRequest = (url: string): boolean =>
  url.startsWith(`${FILTER_TILE_URL_ORIGIN}${FILTER_TILE_URL_PATH_PREFIX}/`);
