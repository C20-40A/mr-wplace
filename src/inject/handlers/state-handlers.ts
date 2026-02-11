import { EnhancedMode } from "@/types/image";
import { applyTheme } from "../theme-manager";
import { updateColorFilterState } from "../states/colorFilterState";
import {
  sortMapLayers,
  setFrontTileLayerEnabled,
  refreshFrontTileLayer,
} from "../features/map-instance";

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
  refreshFrontTileLayer();
};

/**
 * Handle color filter manager update
 */
export const handleColorFilterUpdate = (data: {
  isFilterActive: boolean;
  selectedRGBs?: [number, number, number][];
  enhancedMode: EnhancedMode;
  enhancedColor?: [number, number, number];
  showUnplacedColor?: [number, number, number];
}): void => {
  updateColorFilterState({
    isFilterActive: data.isFilterActive,
    selectedRGBs: data.selectedRGBs,
    enhancedMode: data.enhancedMode,
    enhancedColor: data.enhancedColor ?? [255, 0, 0],
    showUnplacedColor: data.showUnplacedColor ?? [160, 160, 160],
  });

  // 統計は必要に応じてタイルレンダリング時に計算されるため、
  // 事前の再計算は行わない（不要なタイルfetchを避ける）
  refreshFrontTileLayer();
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
 * Handle layer sort update
 */
export const handleLayerSortUpdate = (data: { enabled: boolean }): void => {
  window.mrWplaceLayerSortEnabled = data.enabled;
  console.log("🧑‍🎨 : Layer sort updated:", data.enabled);

  if (data.enabled) {
    sortMapLayers();
  }
};

/**
 * Handle front tile layer update
 */
export const handleFrontTileLayerUpdate = (data: {
  enabled: boolean;
}): void => {
  window.mrWplaceFrontTileLayerEnabled = data.enabled;
  setFrontTileLayerEnabled(data.enabled);
  console.log("🧑‍🎨 : Front tile layer updated:", data.enabled);
};
