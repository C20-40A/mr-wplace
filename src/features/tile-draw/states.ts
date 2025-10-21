import { splitImageOnTiles } from "./utils/splitImageOnTiles";
import { TILE_DRAW_CONSTANTS, WplaceCoords } from "./constants";
import type { TileDrawInstance, ColorStats } from "./types";

/**
 * 描画するオーバーレイ画像インスタンス群
 */
export let overlayLayers: TileDrawInstance[] = [];

/**
 * 画像キー別タイル毎色統計情報マップ
 */
export const perTileColorStats = new Map<string, Map<string, ColorStats>>(); // TODO: getterからしか更新できないようにする？
export const getPerTileColorStats = (
  imageKey: string
): Map<string, ColorStats> | null => {
  return perTileColorStats.get(imageKey) || null;
};
export const setPerTileColorStats = (
  imageKey: string,
  tileStatsMap: Map<string, ColorStats>
): void => {
  perTileColorStats.set(imageKey, tileStatsMap);
};

export const removePreparedOverlayImageByKey = (imageKey: string): void => {
  overlayLayers = overlayLayers.filter((i) => i.imageKey !== imageKey);
  perTileColorStats.delete(imageKey);
};

export const addImageToOverlayLayers = async (
  source: File | Blob | ImageBitmap,
  coords: WplaceCoords,
  imageKey: string
): Promise<void> => {
  removePreparedOverlayImageByKey(imageKey);

  const { preparedOverlayImages: preparedOverlayImage } =
    await splitImageOnTiles({
      source,
      coords,
      tileSize: TILE_DRAW_CONSTANTS.TILE_SIZE,
    });

  overlayLayers.push({
    coords,
    tiles: preparedOverlayImage,
    imageKey,
    drawEnabled: true,
  });
};

export const toggleDrawEnabled = (imageKey: string): boolean => {
  const instance = overlayLayers.find((i) => i.imageKey === imageKey);
  if (!instance) return false;

  instance.drawEnabled = !instance.drawEnabled;
  return instance.drawEnabled;
};
