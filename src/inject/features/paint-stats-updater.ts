/**
 * Paint Stats Optimistic Updater (inject context)
 *
 * ペイント中に painted-coordinates-capture のデータを利用して
 * perTileColorStats の matched を楽観的に更新し、content 側へ通知する。
 *
 * 1ピクセルごとに overlay タイルの該当座標の色を読み取り (1x1 OffscreenCanvas)、
 * ペイントした色と一致すれば matched をインクリメントする。
 */

import { colorpalette } from "@/constants/colors";
import { overlayLayers, perTileColorStats } from "./tile-draw/states";
import { getOriginalBlob } from "./tile-draw";
import type { CapturedPaintedCoordinate } from "@/inject/types";
import {
  upsertFrontTilePaintGuide,
  clearFrontTilePaintGuide,
} from "./map-instance/front-tile-layer";

// colorIdx → "r,g,b" の高速ルックアップ
const colorIdxToRgbKey = new Map<number, string>();
const colorIdxToRgbInt = new Map<number, number>();
for (const entry of colorpalette) {
  colorIdxToRgbKey.set(entry.id, entry.rgb.join(","));
  const [r, g, b] = entry.rgb;
  colorIdxToRgbInt.set(entry.id, (r << 16) | (g << 8) | b);
}

// タイル ImageBitmap → ピクセルデータキャッシュ (tileKey 単位)
// キャッシュすることで同一タイルの複数ピクセルペイント時に再描画不要
const tilePixelCache = new Map<string, Uint8ClampedArray>();
const MAX_TILE_PIXEL_CACHE = 10;
const tileCacheOrder: string[] = [];
const backgroundTilePixelCache = new Map<
  string,
  {
    blob: Blob;
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
  }
>();
const MAX_BACKGROUND_TILE_PIXEL_CACHE = 4;
const MAX_BACKGROUND_DECODE_CONCURRENCY = 2;
const backgroundTileCacheOrder: string[] = [];
let backgroundDecodeActiveCount = 0;
const backgroundDecodeInFlight = new Set<string>();
const backgroundDecodeQueue: string[] = [];
const backgroundDecodeQueuedSet = new Set<string>();
const backgroundDecodeRequestedBlob = new Map<string, Blob>();
const toPaddedTileKey = (tileX: number, tileY: number): string =>
  `${tileX.toString().padStart(4, "0")},${tileY.toString().padStart(4, "0")}`;

const getTilePixelData = (
  bitmap: ImageBitmap
): Uint8ClampedArray | null => {
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  } catch {
    return null;
  }
};

const getCachedTilePixels = (
  tileKey: string,
  bitmap: ImageBitmap
): Uint8ClampedArray | null => {
  const cached = tilePixelCache.get(tileKey);
  if (cached) return cached;

  const data = getTilePixelData(bitmap);
  if (!data) return null;

  tilePixelCache.set(tileKey, data);
  tileCacheOrder.push(tileKey);
  if (tileCacheOrder.length > MAX_TILE_PIXEL_CACHE) {
    const oldest = tileCacheOrder.shift();
    if (oldest) tilePixelCache.delete(oldest);
  }
  return data;
};

const removeBackgroundCache = (tileKey: string): void => {
  backgroundTilePixelCache.delete(tileKey);
  const index = backgroundTileCacheOrder.indexOf(tileKey);
  if (index !== -1) backgroundTileCacheOrder.splice(index, 1);
};

const touchBackgroundCache = (tileKey: string): void => {
  const index = backgroundTileCacheOrder.indexOf(tileKey);
  if (index === -1) return;
  backgroundTileCacheOrder.splice(index, 1);
  backgroundTileCacheOrder.push(tileKey);
};

const setBackgroundCache = (
  tileKey: string,
  entry: {
    blob: Blob;
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
  }
): void => {
  if (backgroundTilePixelCache.has(tileKey)) removeBackgroundCache(tileKey);
  else if (backgroundTileCacheOrder.length >= MAX_BACKGROUND_TILE_PIXEL_CACHE) {
    const oldest = backgroundTileCacheOrder.shift();
    if (oldest) backgroundTilePixelCache.delete(oldest);
  }

  backgroundTilePixelCache.set(tileKey, entry);
  backgroundTileCacheOrder.push(tileKey);
};

const decodeBackgroundTilePixels = async (
  tileKey: string,
  blob: Blob
): Promise<void> => {
  try {
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;
    let pixels: Uint8ClampedArray | null = null;
    try {
      pixels = getTilePixelData(bitmap);
    } finally {
      bitmap.close();
    }
    if (!pixels) return;

    // Tile was updated while decoding, so skip stale cache.
    const latestBlob = getOriginalBlob(tileKey);
    if (!latestBlob || latestBlob !== blob) return;

    setBackgroundCache(tileKey, {
      blob,
      width,
      height,
      pixels,
    });
  } catch {}
  finally {
    backgroundDecodeInFlight.delete(tileKey);
    const requestedBlob = backgroundDecodeRequestedBlob.get(tileKey);
    if (requestedBlob && requestedBlob !== blob) {
      if (!backgroundDecodeQueuedSet.has(tileKey)) {
        backgroundDecodeQueuedSet.add(tileKey);
        backgroundDecodeQueue.push(tileKey);
      }
      return;
    }
    backgroundDecodeRequestedBlob.delete(tileKey);
  }
};

const pumpBackgroundDecodeQueue = (): void => {
  while (backgroundDecodeActiveCount < MAX_BACKGROUND_DECODE_CONCURRENCY) {
    const tileKey = backgroundDecodeQueue.shift();
    if (!tileKey) return;
    backgroundDecodeQueuedSet.delete(tileKey);
    if (backgroundDecodeInFlight.has(tileKey)) continue;

    const blob = backgroundDecodeRequestedBlob.get(tileKey);
    if (!blob) continue;

    backgroundDecodeInFlight.add(tileKey);
    backgroundDecodeActiveCount += 1;
    void decodeBackgroundTilePixels(tileKey, blob).finally(() => {
      backgroundDecodeActiveCount = Math.max(0, backgroundDecodeActiveCount - 1);
      pumpBackgroundDecodeQueue();
    });
  }
};

const scheduleBackgroundDecode = (tileKey: string, blob: Blob): void => {
  backgroundDecodeRequestedBlob.set(tileKey, blob);
  if (backgroundDecodeInFlight.has(tileKey)) return;
  if (!backgroundDecodeQueuedSet.has(tileKey)) {
    backgroundDecodeQueuedSet.add(tileKey);
    backgroundDecodeQueue.push(tileKey);
  }
  pumpBackgroundDecodeQueue();
};

const getBackgroundPixelRgbInt = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number
): number | null => {
  const tileKey = `${tileX},${tileY}`;
  const blob = getOriginalBlob(tileKey);
  if (!blob) {
    removeBackgroundCache(tileKey);
    backgroundDecodeRequestedBlob.delete(tileKey);
    return null;
  }

  const cached = backgroundTilePixelCache.get(tileKey);
  if (!cached || cached.blob !== blob) {
    if (cached) removeBackgroundCache(tileKey);
    scheduleBackgroundDecode(tileKey, blob);
    return null;
  }

  touchBackgroundCache(tileKey);

  if (pixelX < 0 || pixelY < 0 || pixelX >= cached.width || pixelY >= cached.height)
    return null;

  const idx = (pixelY * cached.width + pixelX) * 4;
  if (idx + 3 >= cached.pixels.length) return null;
  if (cached.pixels[idx + 3] === 0) return null;

  return (
    (cached.pixels[idx] << 16) |
    (cached.pixels[idx + 1] << 8) |
    cached.pixels[idx + 2]
  );
};

// debounce 通知
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
const NOTIFY_DEBOUNCE_MS = 200;
const pendingNotify = new Map<string, Set<string>>();

const flushNotify = (): void => {
  notifyTimer = null;
  for (const [imageKey, tileKeys] of pendingNotify.entries()) {
    const tileStatsMap = perTileColorStats.get(imageKey);
    if (!tileStatsMap) continue;

    const tileStatsDelta: Record<
      string,
      { matched: Record<string, number>; total: Record<string, number> }
    > = {};
    for (const tileKey of tileKeys) {
      const tileStats = tileStatsMap.get(tileKey);
      if (!tileStats) continue;
      tileStatsDelta[tileKey] = {
        matched: Object.fromEntries(tileStats.matched),
        total: Object.fromEntries(tileStats.total),
      };
    }

    if (Object.keys(tileStatsDelta).length === 0) continue;
    window.postMessage(
      { source: "mr-wplace-stats-updated", imageKey, tileStatsDelta },
      "*",
    );
  }
  pendingNotify.clear();
};

const scheduleNotify = (imageKey: string, tileKey: string): void => {
  const pendingTileKeys = pendingNotify.get(imageKey) ?? new Set<string>();
  pendingTileKeys.add(tileKey);
  pendingNotify.set(imageKey, pendingTileKeys);
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(flushNotify, NOTIFY_DEBOUNCE_MS);
};

const getPaintedRgbInt = (
  coord: Pick<CapturedPaintedCoordinate, "colorIdx" | "color">
): number | null =>
  coord.colorIdx != null
    ? (colorIdxToRgbInt.get(coord.colorIdx) ?? null)
    : coord.color
      ? (coord.color.r << 16) | (coord.color.g << 8) | coord.color.b
      : null;

/**
 * ペイント1ピクセルの楽観的統計更新
 */
export const handlePaintForStats = (
  coord: CapturedPaintedCoordinate
): void => {
  const paintedRgbInt = getPaintedRgbInt(coord);
  if (paintedRgbInt == null) return;
  const paintedRgbKey = `${(paintedRgbInt >> 16) & 0xff},${
    (paintedRgbInt >> 8) & 0xff
  },${paintedRgbInt & 0xff}`;
  const guideEnabled = window.mrWplaceFrontTileLayerEnabled === true;

  const tileKey = `${coord.tileX},${coord.tileY}`;
  const paddedTileKey = toPaddedTileKey(coord.tileX, coord.tileY);
  let topOverlayRgbInt: number | null = null;
  let topOverlayOrder = -1;

  for (let order = 0; order < overlayLayers.length; order++) {
    const instance = overlayLayers[order];
    if (!instance.drawEnabled) continue;
    // affectedTileSet で O(1) 判定
    if (
      instance.affectedTileSet &&
      !instance.affectedTileSet.has(tileKey) &&
      !instance.affectedTileSet.has(paddedTileKey)
    )
      continue;

    const bitmapTileKey = instance.tiles?.[tileKey]
      ? tileKey
      : instance.tiles?.[paddedTileKey]
        ? paddedTileKey
        : null;
    if (!bitmapTileKey) continue;

    const bitmap = instance.tiles?.[bitmapTileKey];
    if (!bitmap) continue;

    // タイルのピクセルデータから該当ピクセルの色を取得
    const cacheKey = `${instance.imageKey}:${bitmapTileKey}`;
    const pixels = getCachedTilePixels(cacheKey, bitmap);
    if (!pixels) continue;

    const idx = (coord.pixelY * bitmap.width + coord.pixelX) * 4;
    if (idx + 3 >= pixels.length) continue;
    if (pixels[idx + 3] === 0) continue; // 透明ピクセルはスキップ

    const overlayRgbInt =
      (pixels[idx] << 16) | (pixels[idx + 1] << 8) | pixels[idx + 2];

    // Front guide は最上位レイヤーのテンプレ色を採用
    if (guideEnabled && order >= topOverlayOrder) {
      topOverlayOrder = order;
      topOverlayRgbInt = overlayRgbInt;
    }

    // overlay のこの位置の色とペイントした色が一致 → matched +1
    if (overlayRgbInt !== paintedRgbInt) continue;

    const tileStatsMap = perTileColorStats.get(instance.imageKey);
    if (!tileStatsMap) continue;
    const tileStats =
      tileStatsMap.get(tileKey) ?? tileStatsMap.get(paddedTileKey);
    if (!tileStats) continue;

    const currentMatched = tileStats.matched.get(paintedRgbKey) || 0;
    const total = tileStats.total.get(paintedRgbKey) || 0;
    // matched が total を超えないようにガード
    if (currentMatched >= total) continue;

    tileStats.matched.set(paintedRgbKey, currentMatched + 1);
    scheduleNotify(
      instance.imageKey,
      tileStatsMap.has(tileKey) ? tileKey : paddedTileKey,
    );
  }

  if (!guideEnabled) return;

  if (topOverlayRgbInt == null) {
    clearFrontTilePaintGuide(coord.tileX, coord.tileY, coord.pixelX, coord.pixelY);
    return;
  }

  if (topOverlayRgbInt !== paintedRgbInt) {
    upsertFrontTilePaintGuide(
      coord.tileX,
      coord.tileY,
      coord.pixelX,
      coord.pixelY,
      "mismatch",
      topOverlayRgbInt,
    );
    return;
  }

  const backgroundRgbInt = getBackgroundPixelRgbInt(
    coord.tileX,
    coord.tileY,
    coord.pixelX,
    coord.pixelY,
  );
  if (backgroundRgbInt == null || backgroundRgbInt !== paintedRgbInt) {
    clearFrontTilePaintGuide(coord.tileX, coord.tileY, coord.pixelX, coord.pixelY);
    return;
  }

  upsertFrontTilePaintGuide(
    coord.tileX,
    coord.tileY,
    coord.pixelX,
    coord.pixelY,
    "already",
    topOverlayRgbInt,
  );
};

export const handlePaintDeleteForStats = (
  coord: Pick<
    CapturedPaintedCoordinate,
    "tileX" | "tileY" | "pixelX" | "pixelY" | "colorIdx" | "color"
  >
): void => {
  const paintedRgbInt = getPaintedRgbInt(coord);
  if (paintedRgbInt == null) return;
  const paintedRgbKey = `${(paintedRgbInt >> 16) & 0xff},${
    (paintedRgbInt >> 8) & 0xff
  },${paintedRgbInt & 0xff}`;

  const tileKey = `${coord.tileX},${coord.tileY}`;
  const paddedTileKey = toPaddedTileKey(coord.tileX, coord.tileY);

  for (const instance of overlayLayers) {
    if (!instance.drawEnabled) continue;
    if (
      instance.affectedTileSet &&
      !instance.affectedTileSet.has(tileKey) &&
      !instance.affectedTileSet.has(paddedTileKey)
    )
      continue;

    const bitmapTileKey = instance.tiles?.[tileKey]
      ? tileKey
      : instance.tiles?.[paddedTileKey]
        ? paddedTileKey
        : null;
    if (!bitmapTileKey) continue;

    const bitmap = instance.tiles?.[bitmapTileKey];
    if (!bitmap) continue;

    const cacheKey = `${instance.imageKey}:${bitmapTileKey}`;
    const pixels = getCachedTilePixels(cacheKey, bitmap);
    if (!pixels) continue;

    const idx = (coord.pixelY * bitmap.width + coord.pixelX) * 4;
    if (idx + 3 >= pixels.length) continue;
    if (pixels[idx + 3] === 0) continue;

    const overlayRgbInt =
      (pixels[idx] << 16) | (pixels[idx + 1] << 8) | pixels[idx + 2];
    if (overlayRgbInt !== paintedRgbInt) continue;

    const tileStatsMap = perTileColorStats.get(instance.imageKey);
    if (!tileStatsMap) continue;
    const targetTileKey = tileStatsMap.has(tileKey) ? tileKey : paddedTileKey;
    const tileStats = tileStatsMap.get(targetTileKey);
    if (!tileStats) continue;

    const currentMatched = tileStats.matched.get(paintedRgbKey) || 0;
    if (currentMatched <= 0) continue;

    tileStats.matched.set(paintedRgbKey, currentMatched - 1);
    scheduleNotify(instance.imageKey, targetTileKey);
  }
};

/**
 * タイルが再レンダリングされた時にキャッシュを無効化
 */
export const invalidateTilePixelCache = (tileKey: string): void => {
  // imageKey:tileKey 形式のキーを全て削除
  for (const key of Array.from(tilePixelCache.keys())) {
    if (key.endsWith(`:${tileKey}`)) {
      tilePixelCache.delete(key);
      const idx = tileCacheOrder.indexOf(key);
      if (idx !== -1) tileCacheOrder.splice(idx, 1);
    }
  }
};
