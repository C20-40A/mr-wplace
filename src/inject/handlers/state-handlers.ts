import { EnhancedMode } from "@/types/image";
import { applyTheme } from "../theme-manager";
import { updateColorFilterState } from "../states/colorFilterState";
import {
  setFrontTileLayerEnabled,
  refreshFrontTileLayer,
} from "../features/map-instance";

const COLOR_FILTER_REFRESH_DEBOUNCE_MS = 120;
let colorFilterRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleColorFilterRefresh = (): void => {
  if (colorFilterRefreshTimer) clearTimeout(colorFilterRefreshTimer);
  colorFilterRefreshTimer = setTimeout(() => {
    colorFilterRefreshTimer = null;
    refreshFrontTileLayer();
  }, COLOR_FILTER_REFRESH_DEBOUNCE_MS);
};

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
 * Handle selected color only mark update
 * ONの間、localStorageのselected-colorをポーリングし、変更時にタイル再描画
 */
let selectedColorMarkInterval: ReturnType<typeof setInterval> | null = null;
let lastSelectedColorForMark: string | null = null;

const startSelectedColorMarkMonitoring = (): void => {
  if (selectedColorMarkInterval) return;
  lastSelectedColorForMark = localStorage.getItem("selected-color");
  selectedColorMarkInterval = setInterval(() => {
    const current = localStorage.getItem("selected-color");
    if (current !== lastSelectedColorForMark) {
      lastSelectedColorForMark = current;
      console.log("🧑‍🎨 : Selected color changed for mark:", current);
      refreshFrontTileLayer();
    }
  }, 100);
};

const stopSelectedColorMarkMonitoring = (): void => {
  if (selectedColorMarkInterval) {
    clearInterval(selectedColorMarkInterval);
    selectedColorMarkInterval = null;
    lastSelectedColorForMark = null;
  }
};

export const handleSelectedColorOnlyMarkUpdate = (data: {
  enabled: boolean;
}): void => {
  if (window.mrWplaceSelectedColorOnlyMark === data.enabled) return;

  window.mrWplaceSelectedColorOnlyMark = data.enabled;
  console.log("🧑‍🎨 : Selected color only mark updated:", data.enabled);

  if (data.enabled) {
    startSelectedColorMarkMonitoring();
  } else {
    stopSelectedColorMarkMonitoring();
  }

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
  const changed = updateColorFilterState({
    isFilterActive: data.isFilterActive,
    selectedRGBs: data.selectedRGBs,
    enhancedMode: data.enhancedMode,
    enhancedColor: data.enhancedColor ?? [255, 0, 0],
    showUnplacedColor: data.showUnplacedColor ?? [160, 160, 160],
  });
  if (!changed) return;

  // 統計は必要に応じてタイルレンダリング時に計算されるため、
  // 事前の再計算は行わない（不要なタイルfetchを避ける）
  scheduleColorFilterRefresh();
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
 * Handle front tile layer update
 */
export const handleFrontTileLayerUpdate = (data: {
  enabled: boolean;
}): void => {
  window.mrWplaceFrontTileLayerEnabled = data.enabled;
  setFrontTileLayerEnabled(data.enabled);
  console.log("🧑‍🎨 : Front tile layer updated:", data.enabled);
};

/**
 * Handle snapshot capture update
 */
export const handleSnapshotCaptureUpdate = (data: {
  enabled: boolean;
}): void => {
  const nextEnabled = data.enabled === true;
  if (window.mrWplaceSnapshotCaptureEnabled === nextEnabled) return;

  window.mrWplaceSnapshotCaptureEnabled = nextEnabled;
  console.log("🧑‍🎨 : Snapshot capture updated:", nextEnabled);
};
