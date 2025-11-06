import { splitImageOnTiles } from "./image-processing/split-tiles";
import { TILE_DRAW_CONSTANTS, WplaceCoords } from "./constants";
import type { TileDrawInstance, ColorStats } from "./types";
import { computeStatsForImage } from "./stats/compute-for-image";

/**
 * Tile-draw state management
 * Handles overlay layers and statistics in inject context
 */

/**
 * 描画するオーバーレイ画像インスタンス群
 */
export let overlayLayers: TileDrawInstance[] = [];

/**
 * 画像キー別タイル毎色統計情報マップ
 */
export const perTileColorStats = new Map<string, Map<string, ColorStats>>();
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
  source: ImageBitmap | HTMLImageElement,
  coords: WplaceCoords,
  imageKey: string,
  options: { force?: boolean; skip?: boolean } = {}
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

  // バックグラウンドで統計を計算
  // 非同期で実行し、完了を待たない
  if (!options.skip) {
    computeStatsInBackground(imageKey, preparedOverlayImage, options.force);
  }
};

/**
 * バックグラウンドで統計を計算
 * タイル描画との競合を避けるため、遅延実行する
 */
const computeStatsInBackground = (
  imageKey: string,
  tiles: Record<string, ImageBitmap>,
  force = false
): void => {
  // data saver ON のときは統計計算をスキップ
  // （タイルがキャッシュにない場合、fetchが失敗するため）
  if (window.mrWplaceDataSaver?.enabled) {
    console.log(`🧑‍🎨 : Skipping background stats computation (data saver is ON)`);
    return;
  }

  // 既に統計が存在する場合はスキップ（force=true の場合は再計算）
  if (!force && perTileColorStats.has(imageKey)) {
    console.log(`🧑‍🎨 : Stats already exist for ${imageKey}, skipping background computation`);
    return;
  }

  // タイル描画との競合を避けるため、2秒後に実行
  setTimeout(() => {
    // 現在のカラーフィルター設定を取得
    const colorFilter = window.mrWplace?.colorFilterManager?.isFilterActive()
      ? window.mrWplace.colorFilterManager.selectedRGBs
      : undefined;

    // 非同期で統計を計算（エラーは無視）
    computeStatsForImage(imageKey, tiles, colorFilter)
      .then((tileStatsMap) => {
        // 統計をグローバルマップに保存
        perTileColorStats.set(imageKey, tileStatsMap);
        console.log(`🧑‍🎨 : Background stats computation complete for ${imageKey}`);

        // content側に統計を通知（storageに保存するため）
        window.postMessage(
          {
            source: "mr-wplace-stats-computed",
            imageKey,
            tileStatsMap: convertStatsMapToObject(tileStatsMap),
          },
          "*"
        );
      })
      .catch((error) => {
        // エラーはログに出すが、処理は継続
        console.warn(`🧑‍🎨 : Background stats computation failed for ${imageKey}:`, error);
      });
  }, 2000);
};

export const toggleDrawEnabled = (imageKey: string): boolean => {
  const instance = overlayLayers.find((i) => i.imageKey === imageKey);
  if (!instance) return false;

  instance.drawEnabled = !instance.drawEnabled;
  return instance.drawEnabled;
};

/**
 * Convert ColorStats Map to plain object for postMessage serialization
 */
const convertStatsMapToObject = (
  tileStatsMap: Map<string, ColorStats>
): Record<string, { matched: Record<string, number>; total: Record<string, number> }> => {
  const result: Record<string, { matched: Record<string, number>; total: Record<string, number> }> = {};

  for (const [tileKey, stats] of tileStatsMap.entries()) {
    result[tileKey] = {
      matched: Object.fromEntries(stats.matched),
      total: Object.fromEntries(stats.total),
    };
  }

  return result;
};
