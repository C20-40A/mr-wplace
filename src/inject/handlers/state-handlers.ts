import { EnhancedMode } from "@/types/image";
import { applyTheme } from "../theme-manager";

/**
 * Handle theme update
 */
let isThemeLoaded = false;
export const handleThemeUpdate = (data: { theme: "light" | "dark" }): void => {
  const theme = data.theme;
  console.log("🧑‍🎨 : Theme updated:", theme);
  if (window.wplaceMap) applyTheme(window.wplaceMap, theme);

  // 初回にテーマがロードされるので、それ以降のテーマ変更時にページリロードする
  if (isThemeLoaded) location.reload();
  if (!isThemeLoaded) isThemeLoaded = true;
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
export const handleComputeDeviceUpdate = (data: {
  device: "gpu" | "cpu";
}): void => {
  window.mrWplaceComputeDevice = data.device;
  console.log("🧑‍🎨 : Compute device updated:", data.device);
};

/**
 * Handle show unplaced only update
 */
export const handleShowUnplacedOnlyUpdate = (data: {
  enabled: boolean;
}): void => {
  window.mrWplaceShowUnplacedOnly = data.enabled;
  console.log("🧑‍🎨 : Show unplaced only updated:", data.enabled);
};

/**
 * Handle color filter manager update
 */
export const handleColorFilterUpdate = (data: {
  isFilterActive: boolean;
  selectedRGBs?: [number, number, number][];
  enhancedMode: EnhancedMode;
}): void => {
  if (!window.mrWplace) throw new Error("mrWplace is not defined");
  window.mrWplace.colorFilterManager = {
    isFilterActive: () => data.isFilterActive,
    selectedRGBs: data.selectedRGBs,
    getEnhancedMode: () => data.enhancedMode,
  };

  console.log("🧑‍🎨 : Color filter updated:", data);

  // 統計は必要に応じてタイルレンダリング時に計算されるため、
  // 事前の再計算は行わない（不要なタイルfetchを避ける）
};

/**
 * Handle tile boundaries visibility update
 */
export const handleTileBoundariesUpdate = (data: {
  visible: boolean;
}): void => {
  if (window.wplaceMap) {
    (window.wplaceMap as any).showTileBoundaries = data.visible;
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
