import { splitImageOnTilesInject } from "./utils/splitImageOnTiles-inject";
import { TILE_DRAW_CONSTANTS, WplaceCoords } from "./constants";
import type { TileDrawInstance, ColorStats } from "./types";
import { computeStatsForImage } from "./utils/computeStatsForImage";

/**
 * Inject-safe version of states.ts
 * Uses Canvas API instead of WASM-based image-bitmap-compat
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
  imageKey: string
): Promise<void> => {
  removePreparedOverlayImageByKey(imageKey);

  const { preparedOverlayImages: preparedOverlayImage } =
    await splitImageOnTilesInject({
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
  computeStatsInBackground(imageKey, preparedOverlayImage);
};

/**
 * バックグラウンドで統計を計算
 * タイル描画との競合を避けるため、遅延実行する
 */
const computeStatsInBackground = (
  imageKey: string,
  tiles: Record<string, ImageBitmap>
): void => {
  // data saver ON のときは統計計算をスキップ
  // （タイルがキャッシュにない場合、fetchが失敗するため）
  if (window.mrWplaceDataSaver?.enabled) {
    console.log(`🧑‍🎨 : Skipping background stats computation (data saver is ON)`);
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
