import {
  drawOverlayLayersOnTile,
  getOriginalBlob,
  getOriginalLastModified,
} from "../../tile-draw";
import { markFrontTileComparisonPending } from "./index";
import { getStateVersion } from "./state-version";

const TILE_SIZE = 1000;
const SUPPORTED_MIN_ZOOM = 9;
const BASE_TILE_ZOOM = 11;
const MID_TILE_ZOOM = 10;
const CACHE_CONTROL_HEADER = "public, max-age=31536000, immutable";
const FRONT_RENDER_CACHE_MAX = 60;
const FRONT_BASE_RENDER_CONCURRENCY = 2;
const FRONT_TILE_URL_ORIGIN = "https://backend.wplace.live";
const FRONT_TILE_URL_PATH_PREFIX = "/mr-wplace/front-tile";

export const buildFrontLayerTileUrl = (version: number): string =>
  `${FRONT_TILE_URL_ORIGIN}${FRONT_TILE_URL_PATH_PREFIX}/{z}/{x}/{y}.png?v=${version}`;

let transparentTileBlobPromise: Promise<Blob> | null = null;
let activeBaseRenders = 0;
const baseRenderWaiters: Array<() => void> = [];
const frontRenderedTileCache = new Map<string, { token: string; blob: Blob }>();
const frontRenderInFlight = new Map<string, Promise<Blob>>();

const withBaseRenderSlot = async <T>(task: () => Promise<T>): Promise<T> => {
  if (activeBaseRenders >= FRONT_BASE_RENDER_CONCURRENCY) {
    await new Promise<void>((resolve) => baseRenderWaiters.push(resolve));
  } else {
    activeBaseRenders++;
  }

  try {
    return await task();
  } finally {
    const next = baseRenderWaiters.shift();
    if (next) {
      // 実行枠を次の待機処理へ直接引き継ぐ。
      next();
    } else {
      activeBaseRenders--;
    }
  }
};

/**
 * Invalidate front-rendered tile cache for a specific tile.
 * Returns true if any cache entry was actually deleted.
 */
export const invalidateFrontRenderedTile = (tileX: number, tileY: number): boolean => {
  const z11Key = getFrontRenderCacheKey(BASE_TILE_ZOOM, tileX, tileY);
  const deletedZ11 = frontRenderedTileCache.delete(z11Key);

  // Also invalidate z10 parent tile
  const parentX = Math.floor(tileX / 2);
  const parentY = Math.floor(tileY / 2);
  const z10Key = getFrontRenderCacheKey(MID_TILE_ZOOM, parentX, parentY);
  const deletedZ10 = frontRenderedTileCache.delete(z10Key);

  // Also invalidate z9 grandparent tile
  const grandParentX = Math.floor(tileX / 4);
  const grandParentY = Math.floor(tileY / 4);
  const z9Key = getFrontRenderCacheKey(SUPPORTED_MIN_ZOOM, grandParentX, grandParentY);
  const deletedZ9 = frontRenderedTileCache.delete(z9Key);

  return deletedZ11 || deletedZ10 || deletedZ9;
};

const getRequestedStateVersion = (url: string): string => {
  const match = url.match(/[?&]v=(\d+)/);
  if (match) return match[1];
  return String(getStateVersion());
};

const getFrontRenderCacheKey = (z: number, x: number, y: number): string =>
  `${z}:${x},${y}`;

const getCachedFrontRenderedTile = (
  cacheKey: string,
  token: string | null,
): Blob | null => {
  if (!token) return null;
  const cached = frontRenderedTileCache.get(cacheKey);
  if (!cached || cached.token !== token) return null;
  // LRU touch
  frontRenderedTileCache.delete(cacheKey);
  frontRenderedTileCache.set(cacheKey, cached);
  return cached.blob;
};

const setCachedFrontRenderedTile = (
  cacheKey: string,
  token: string | null,
  blob: Blob,
): void => {
  if (!token) return;
  if (frontRenderedTileCache.has(cacheKey)) {
    frontRenderedTileCache.delete(cacheKey);
  } else if (frontRenderedTileCache.size >= FRONT_RENDER_CACHE_MAX) {
    const oldest = frontRenderedTileCache.keys().next().value;
    if (oldest) frontRenderedTileCache.delete(oldest);
  }
  frontRenderedTileCache.set(cacheKey, { token, blob });
};

const buildBaseTileLastModifiedToken = (
  x: number,
  y: number,
  stateVersion: string,
): string | null => {
  const lastModified = getOriginalLastModified(`${x},${y}`);
  if (!lastModified) return null;
  return `${stateVersion}|${lastModified}`;
};

const buildZoom10LastModifiedToken = (
  x: number,
  y: number,
  stateVersion: string,
): string | null => {
  const parts: string[] = [];
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const childX = x * 2 + dx;
      const childY = y * 2 + dy;
      const lastModified = getOriginalLastModified(`${childX},${childY}`);
      if (!lastModified) return null;
      parts.push(lastModified);
    }
  }
  return `${stateVersion}|${parts.join("|")}`;
};

const buildZoom9LastModifiedToken = (
  x: number,
  y: number,
  stateVersion: string,
): string | null => {
  const parts: string[] = [];
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      const childX = x * 4 + dx;
      const childY = y * 4 + dy;
      const lastModified = getOriginalLastModified(`${childX},${childY}`);
      if (!lastModified) return null;
      parts.push(lastModified);
    }
  }
  return `${stateVersion}|${parts.join("|")}`;
};

const buildFrontTileToken = (
  z: number,
  x: number,
  y: number,
  stateVersion: string,
): string | null =>
  z === BASE_TILE_ZOOM
    ? buildBaseTileLastModifiedToken(x, y, stateVersion)
    : z === MID_TILE_ZOOM
    ? buildZoom10LastModifiedToken(x, y, stateVersion)
    : buildZoom9LastModifiedToken(x, y, stateVersion);

const renderBaseZoomTile = async (
  x: number,
  y: number,
  emptyBlob: Blob,
): Promise<Blob> => {
  const cacheKey = `${x},${y}`;
  const comparisonTileBlob = getOriginalBlob(cacheKey);

  // Comparison background is not ready yet.
  // Defer rendering for this tile until original tile arrives.
  if (!comparisonTileBlob) {
    markFrontTileComparisonPending(x, y);
    return emptyBlob;
  }

  // Render on transparent layer, but compare against the original tile if available
  return await drawOverlayLayersOnTile(emptyBlob, [x, y], "gpu", {
    comparisonTileBlob,
    transparentBase: true,
  });
};

const composeChildrenToTile = async (
  children: Array<{ dx: number; dy: number; blob: Blob | null }>,
  childTileSize: number,
  emptyBlob: Blob,
): Promise<Blob> => {
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext("2d");
  if (!ctx) return emptyBlob;

  const drawableChildren = children.filter(
    (child): child is { dx: number; dy: number; blob: Blob } =>
      child.blob instanceof Blob,
  );
  if (drawableChildren.length === 0) return emptyBlob;

  const bitmaps = await Promise.all(
    drawableChildren.map(async (child) => ({
      dx: child.dx,
      dy: child.dy,
      bitmap: await createImageBitmap(child.blob),
    })),
  );

  for (const { dx, dy, bitmap } of bitmaps) {
    ctx.drawImage(
      bitmap,
      dx * childTileSize,
      dy * childTileSize,
      childTileSize,
      childTileSize,
    );
    bitmap.close();
  }

  return await canvas.convertToBlob({ type: "image/png" });
};

const renderZoom10Tile = async (
  x: number,
  y: number,
  emptyBlob: Blob,
  stateVersion: string,
): Promise<Blob> => {
  const childTileSize = TILE_SIZE / 2;
  const childTasks: Array<
    Promise<{ dx: number; dy: number; blob: Blob | null }>
  > = [];

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const childX = x * 2 + dx;
      const childY = y * 2 + dy;
      if (!getOriginalBlob(`${childX},${childY}`)) {
        // 比較背景がない子は透明なので、デコード・再エンコードを避ける。
        markFrontTileComparisonPending(childX, childY);
        continue;
      }

      childTasks.push(
        renderFrontTile(childX, childY, BASE_TILE_ZOOM, stateVersion)
          .then((blob) => ({ dx, dy, blob }))
          .catch(() => ({ dx, dy, blob: null })),
      );
    }
  }

  if (childTasks.length === 0) return emptyBlob;
  return composeChildrenToTile(await Promise.all(childTasks), childTileSize, emptyBlob);
};

const renderZoom9Tile = async (
  x: number,
  y: number,
  emptyBlob: Blob,
  stateVersion: string,
): Promise<Blob> => {
  const childTileSize = TILE_SIZE / 2;
  const childTasks: Array<
    Promise<{ dx: number; dy: number; blob: Blob | null }>
  > = [];

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const childX = x * 2 + dx;
      const childY = y * 2 + dy;
      childTasks.push(
        renderFrontTile(childX, childY, MID_TILE_ZOOM, stateVersion)
          .then((blob) => ({ dx, dy, blob }))
          .catch(() => ({ dx, dy, blob: null })),
      );
    }
  }

  return composeChildrenToTile(await Promise.all(childTasks), childTileSize, emptyBlob);
};

/**
 * 全zoomで同じキャッシュとin-flight Promiseを共有する。
 * 親タイル生成から参照された子タイルも以後のz11/z10要求で再利用できる。
 */
const renderFrontTile = async (
  x: number,
  y: number,
  z: number,
  stateVersion: string,
): Promise<Blob> => {
  const cacheKey = getFrontRenderCacheKey(z, x, y);
  const token = buildFrontTileToken(z, x, y, stateVersion);
  const cached = getCachedFrontRenderedTile(cacheKey, token);
  if (cached) return cached;

  const inFlightKey = `${cacheKey}|${token ?? `pending:${stateVersion}`}`;
  const existing = frontRenderInFlight.get(inFlightKey);
  if (existing) return await existing;

  const renderPromise = (async (): Promise<Blob> => {
    const emptyBlob = await getTransparentTileBlob();
    const blob =
      z === BASE_TILE_ZOOM
        ? await withBaseRenderSlot(() => renderBaseZoomTile(x, y, emptyBlob))
        : z === MID_TILE_ZOOM
        ? await renderZoom10Tile(x, y, emptyBlob, stateVersion)
        : await renderZoom9Tile(x, y, emptyBlob, stateVersion);

    setCachedFrontRenderedTile(cacheKey, token, blob);
    return blob;
  })();

  frontRenderInFlight.set(inFlightKey, renderPromise);
  try {
    return await renderPromise;
  } finally {
    if (frontRenderInFlight.get(inFlightKey) === renderPromise)
      frontRenderInFlight.delete(inFlightKey);
  }
};

const getTransparentTileBlob = (): Promise<Blob> => {
  if (!transparentTileBlobPromise)
    transparentTileBlobPromise = createTransparentTileBlob();
  return transparentTileBlobPromise;
};

/**
 * Handle dedicated front-layer tile requests
 * Pattern: https://backend.wplace.live/mr-wplace/front-tile/{z}/{x}/{y}.png
 */
export const handleFrontLayerTileRequest = async (
  url: string,
): Promise<Response> => {
  // Extract z, x, y from URL
  const tileMatch = url.match(/\/front-tile\/(\d+)\/(\d+)\/(\d+)\.png(?:[?#].*)?$/);
  if (!tileMatch) {
    return createEmptyTileResponse();
  }

  const z = parseInt(tileMatch[1], 10);
  const x = parseInt(tileMatch[2], 10);
  const y = parseInt(tileMatch[3], 10);

  // Support z11 (base), z10 and z9 (zoomed out composition)
  if (z < SUPPORTED_MIN_ZOOM || z > BASE_TILE_ZOOM) {
    return createEmptyTileResponse();
  }

  try {
    const stateVersion = getRequestedStateVersion(url);
    const blob = await renderFrontTile(x, y, z, stateVersion);

    return new Response(blob, {
      status: 200,
      headers: new Headers({
        "Content-Type": "image/png",
        "Cache-Control": CACHE_CONTROL_HEADER,
      }),
    });
  } catch (error) {
    console.error("🧑‍🎨 : Failed to render front layer tile:", error);
    return createEmptyTileResponse();
  }
};

/**
 * Create transparent 1000x1000 tile blob for background
 */
const createTransparentTileBlob = async (): Promise<Blob> => {
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // Fill with transparent
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  return await canvas.convertToBlob({ type: "image/png" });
};

const createTransparentTileResponse = (blob: Blob): Response => {
  return new Response(blob, {
    status: 200,
    headers: new Headers({
      "Content-Type": "image/png",
      "Cache-Control": CACHE_CONTROL_HEADER,
    }),
  });
};

/**
 * Create empty transparent tile response (1x1 fallback)
 */
const createEmptyTileResponse = (): Response => {
  // 1x1 transparent PNG
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

/**
 * Check if URL is a front layer tile request
 */
export const isFrontLayerTileRequest = (url: string): boolean => {
  return url.startsWith(`${FRONT_TILE_URL_ORIGIN}${FRONT_TILE_URL_PATH_PREFIX}/`);
};
