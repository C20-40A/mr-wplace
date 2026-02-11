import { colorpalette } from "@/constants/colors";
import type { CapturedPaintedCoordinate } from "@/inject/types";
import { TILE_DRAW_CONSTANTS } from "./constants";

const MAX_PENDING_TILES = 64;
const MAX_PENDING_PIXELS_PER_TILE = 2048;
const PENDING_TILE_TTL_MS = 20_000;

interface PendingPaintTileState {
  updatedAt: number;
  pixels: Map<number, number>;
}

const pendingPaintTiles = new Map<string, PendingPaintTileState>();

const colorIdxToRgbInt = new Map<number, number>();
for (const entry of colorpalette) {
  const [r, g, b] = entry.rgb;
  colorIdxToRgbInt.set(entry.id, (r << 16) | (g << 8) | b);
}

const toTileKey = (tileX: number, tileY: number): string => `${tileX},${tileY}`;

const isPixelInRange = (pixelX: number, pixelY: number): boolean =>
  pixelX >= 0 &&
  pixelY >= 0 &&
  pixelX < TILE_DRAW_CONSTANTS.TILE_SIZE &&
  pixelY < TILE_DRAW_CONSTANTS.TILE_SIZE;

const toPixelIndex = (pixelX: number, pixelY: number): number =>
  pixelY * TILE_DRAW_CONSTANTS.TILE_SIZE + pixelX;

const evictOldestTileIfNeeded = (): void => {
  if (pendingPaintTiles.size <= MAX_PENDING_TILES) return;
  const oldestKey = pendingPaintTiles.keys().next().value;
  if (!oldestKey) return;
  pendingPaintTiles.delete(oldestKey);
};

const toPaintedRgbInt = (coord: CapturedPaintedCoordinate): number | null => {
  if (coord.colorIdx != null) {
    const byIdx = colorIdxToRgbInt.get(coord.colorIdx);
    if (byIdx != null) return byIdx;
  }

  const color = coord.color;
  if (!color) return null;
  return (color.r << 16) | (color.g << 8) | color.b;
};

const touchTileState = (tileKey: string, state: PendingPaintTileState): void => {
  state.updatedAt = Date.now();
  // Map insertion order is used as LRU.
  pendingPaintTiles.delete(tileKey);
  pendingPaintTiles.set(tileKey, state);
};

export const upsertPendingPaint = (coord: CapturedPaintedCoordinate): boolean => {
  if (!isPixelInRange(coord.pixelX, coord.pixelY)) return false;

  const paintedRgbInt = toPaintedRgbInt(coord);
  if (paintedRgbInt == null) return false;

  const tileKey = toTileKey(coord.tileX, coord.tileY);
  const pixelIndex = toPixelIndex(coord.pixelX, coord.pixelY);
  const state =
    pendingPaintTiles.get(tileKey) ??
    (() => {
      const created: PendingPaintTileState = {
        updatedAt: Date.now(),
        pixels: new Map(),
      };
      pendingPaintTiles.set(tileKey, created);
      evictOldestTileIfNeeded();
      return created;
    })();

  touchTileState(tileKey, state);
  const previous = state.pixels.get(pixelIndex);
  state.pixels.set(pixelIndex, paintedRgbInt);

  if (state.pixels.size > MAX_PENDING_PIXELS_PER_TILE) {
    const oldestPixelIndex = state.pixels.keys().next().value;
    if (oldestPixelIndex != null) state.pixels.delete(oldestPixelIndex);
  }

  return previous !== paintedRgbInt;
};

const isExpired = (state: PendingPaintTileState): boolean =>
  Date.now() - state.updatedAt > PENDING_TILE_TTL_MS;

export const getPendingPaintsForTile = (
  tileX: number,
  tileY: number,
): ReadonlyMap<number, number> | null => {
  const tileKey = toTileKey(tileX, tileY);
  const state = pendingPaintTiles.get(tileKey);
  if (!state) return null;

  if (state.pixels.size === 0 || isExpired(state)) {
    pendingPaintTiles.delete(tileKey);
    return null;
  }

  touchTileState(tileKey, state);
  return state.pixels;
};

export const clearPendingPaintsForTile = (
  tileX: number,
  tileY: number,
): boolean => {
  const tileKey = toTileKey(tileX, tileY);
  return pendingPaintTiles.delete(tileKey);
};
