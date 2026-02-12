import { ZOOM_LEVEL } from "@/utils/geo-converter";

const getTileCount = (zoom: number = ZOOM_LEVEL): number => Math.pow(2, zoom);

const wrapTileX = (tileX: number, tileCount: number): number => {
  const x = Math.trunc(tileX);
  return ((x % tileCount) + tileCount) % tileCount;
};

const clampTileY = (tileY: number, tileCount: number): number => {
  const y = Math.trunc(tileY);
  return Math.min(tileCount - 1, Math.max(0, y));
};

export const normalizeTileCoordinate = (
  tileX: number,
  tileY: number,
  zoom: number = ZOOM_LEVEL,
): { tileX: number; tileY: number } => {
  const tileCount = getTileCount(zoom);

  return {
    tileX: wrapTileX(tileX, tileCount),
    tileY: clampTileY(tileY, tileCount),
  };
};
