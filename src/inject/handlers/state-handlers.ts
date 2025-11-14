import { applyTheme } from "../theme-manager";
import { overlayLayers, perTileColorStats } from "../tile-draw";
import { computeStatsForImage } from "../tile-draw/stats/compute-for-image";

/**
 * Handle theme update
 */
export const handleThemeUpdate = (data: { theme: "light" | "dark" }): void => {
  const theme = data.theme;
  console.log("🧑‍🎨 : Theme updated:", theme);

  if (window.wplaceMap) {
    applyTheme(window.wplaceMap, theme);
  }
};

/**
 * Handle data saver update
 */
export const handleDataSaverUpdate = (data: { enabled: boolean }): void => {
  if (window.mrWplaceDataSaver) {
    window.mrWplaceDataSaver.enabled = data.enabled;
    console.log("🧑‍🎨 : Data saver updated:", data.enabled);
  }
};

/**
 * Handle data saver cache size update
 */
export const handleCacheSizeUpdate = (data: { maxCacheSize: number }): void => {
  if (window.mrWplaceDataSaver) {
    window.mrWplaceDataSaver.maxCacheSize = data.maxCacheSize;
    console.log("🧑‍🎨 : Cache size updated:", data.maxCacheSize);
  }
};

/**
 * Handle compute device update
 */
export const handleComputeDeviceUpdate = (data: { device: "gpu" | "cpu" }): void => {
  window.mrWplaceComputeDevice = data.device;
  console.log("🧑‍🎨 : Compute device updated:", data.device);

  // Clear tile cache to force re-rendering with new device
  if (window.mrWplaceDataSaver?.tileCache) {
    window.mrWplaceDataSaver.tileCache.clear();
    console.log("🧑‍🎨 : Cleared tile cache after compute device update");

    // Notify drawing loader to start showing loading indicator
    window.postMessage({ source: "wplace-studio-drawing-start" }, "*");
  }
};

/**
 * Handle show unplaced only update
 */
export const handleShowUnplacedOnlyUpdate = (data: { enabled: boolean }): void => {
  window.mrWplaceShowUnplacedOnly = data.enabled;
  console.log("🧑‍🎨 : Show unplaced only updated:", data.enabled);

  // Clear tile cache to force re-rendering with new mode
  if (window.mrWplaceDataSaver?.tileCache) {
    window.mrWplaceDataSaver.tileCache.clear();
    console.log("🧑‍🎨 : Cleared tile cache after show unplaced only update");

    // Notify drawing loader to start showing loading indicator
    window.postMessage({ source: "wplace-studio-drawing-start" }, "*");
  }
};

/**
 * Handle color filter manager update
 */
export const handleColorFilterUpdate = (data: {
  isFilterActive: boolean;
  selectedRGBs?: number[][];
  enhancedMode: "dot" | "cross" | "fill" | "none";
}): void => {
  if (!window.mrWplace) {
    window.mrWplace = {};
  }

  window.mrWplace.colorFilterManager = {
    isFilterActive: () => data.isFilterActive,
    selectedRGBs: data.selectedRGBs,
    getEnhancedMode: () => data.enhancedMode,
  };

  console.log("🧑‍🎨 : Color filter updated:", data);

  // Clear tile cache to force re-rendering with new filter
  if (window.mrWplaceDataSaver?.tileCache) {
    window.mrWplaceDataSaver.tileCache.clear();
    console.log("🧑‍🎨 : Cleared tile cache after color filter update");

    // Notify drawing loader to start showing loading indicator
    window.postMessage({ source: "wplace-studio-drawing-start" }, "*");
  }

  // カラーフィルター変更時に統計を再計算
  recomputeAllStats(data.selectedRGBs);
};

/**
 * Handle tile boundaries visibility update
 */
export const handleTileBoundariesUpdate = (data: { visible: boolean }): void => {
  if (window.wplaceMap) {
    window.wplaceMap.showTileBoundaries = data.visible;
    console.log("🧑‍🎨 : Tile boundaries updated:", data.visible);
  }
};

/**
 * Handle cache clear request
 */
export const handleCacheClear = (): void => {
  if (window.mrWplaceDataSaver?.tileCache) {
    window.mrWplaceDataSaver.tileCache.clear();
    console.log("🧑‍🎨 : Memory cache cleared");
  }
};

/**
 * 全画像の統計を再計算
 * タイル描画との競合を避けるため、遅延実行＆順次処理する
 */
const recomputeAllStats = (colorFilter?: number[][]): void => {
  // data saver ON のときは統計計算をスキップ
  if (window.mrWplaceDataSaver?.enabled) {
    console.log(`🧑‍🎨 : Skipping stats recomputation (data saver is ON)`);
    return;
  }

  // タイル描画との競合を避けるため、2秒後に実行
  setTimeout(async () => {
    console.log(`🧑‍🎨 : Recomputing stats for ${overlayLayers.length} images`);

    // 各画像を順次処理（並列実行を避けて、リソース競合を防ぐ）
    for (const layer of overlayLayers) {
      if (!layer.tiles) continue;

      try {
        // 1画像ずつ順次処理
        const tileStatsMap = await computeStatsForImage(layer.imageKey, layer.tiles, colorFilter);
        perTileColorStats.set(layer.imageKey, tileStatsMap);
        console.log(`🧑‍🎨 : Recomputed stats for ${layer.imageKey}`);

        // content側に統計を通知（storageに保存するため）
        const statsObject: Record<string, { matched: Record<string, number>; total: Record<string, number> }> = {};
        for (const [tileKey, stats] of tileStatsMap.entries()) {
          statsObject[tileKey] = {
            matched: Object.fromEntries(stats.matched),
            total: Object.fromEntries(stats.total),
          };
        }

        window.postMessage(
          {
            source: "mr-wplace-stats-computed",
            imageKey: layer.imageKey,
            tileStatsMap: statsObject,
          },
          "*"
        );
      } catch (error) {
        console.warn(`🧑‍🎨 : Failed to recompute stats for ${layer.imageKey}:`, error);
      }
    }
  }, 2000);
};
