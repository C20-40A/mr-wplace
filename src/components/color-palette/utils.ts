import type { EnhancedMode } from "@/types/image";
import type { ColorStats, EnhancedModeOption, SortOrderOption } from "./types";

// HTML定数
export const ENABLED_BADGE_HTML =
  '<span class="badge-status" style="position: absolute; top: -0.5rem; left: -0.5rem; width: 1rem; height: 1rem; background-color: #22c55e; border: 1px solid black; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">✓</span>';

export const DISABLED_BADGE_HTML =
  '<span class="badge-status" style="position: absolute; top: -0.5rem; left: -0.5rem; width: 1rem; height: 1rem; background-color: #ef4444; border: 1px solid black; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">x</span>';

export const CURRENTLY_SELECTED_ICON_HTML =
  '<span class="currently-selected-icon" style="position: absolute; top: -0.4rem; right: -0.4rem; font-size: 0.65rem; background: white; border-radius: 50%; border: 1px solid black;">⭐</span>';

// Enhanced Mode Options with speed tiers
// fast: simple rendering (dot, cross, fill)
// normal: auxiliary color calculation (red-cross, cyan-cross, etc.)
// slow: 2-pass rendering with huge markers (huge-red-*)
export const ENHANCED_MODE_OPTIONS: EnhancedModeOption[] = [
  { value: "dot", labelKey: "enhanced_mode_dot", speed: "fast" },
  { value: "cross", labelKey: "enhanced_mode_cross", speed: "fast" },
  { value: "fill", labelKey: "enhanced_mode_fill", speed: "fast" },
  { value: "red-cross", labelKey: "enhanced_mode_red_cross" },
  { value: "cyan-cross", labelKey: "enhanced_mode_cyan_cross" },
  { value: "dark-cross", labelKey: "enhanced_mode_dark_cross" },
  { value: "complement-cross", labelKey: "enhanced_mode_complement_cross" },
  { value: "red-border", labelKey: "enhanced_mode_red_border" },
  {
    value: "huge-red-cross",
    labelKey: "enhanced_mode_huge_red_cross",
    speed: "slow",
  },
  {
    value: "huge-red-cross-bold",
    labelKey: "enhanced_mode_huge_red_cross_bold",
    speed: "slow",
  },
  {
    value: "huge-red-diamond",
    labelKey: "enhanced_mode_huge_red_diamond",
    speed: "slow",
  },
  {
    value: "huge-red-ring",
    labelKey: "enhanced_mode_huge_red_ring",
    speed: "slow",
  },
];

// Sort Order Options
export const SORT_ORDER_OPTIONS: SortOrderOption[] = [
  { value: "default", labelKey: "sort_order_default" },
  { value: "most-missing", labelKey: "sort_order_most_missing" },
  { value: "least-remaining", labelKey: "sort_order_least_remaining" },
];

/**
 * RGBから読みやすいテキスト色を計算
 */
export const getContrastTextColor = (
  r: number,
  g: number,
  b: number
): string => {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
};

/**
 * RGB値から統計キーを生成
 */
export const getColorKey = (r: number, g: number, b: number): string => {
  return `${r},${g},${b}`;
};

/**
 * 数値をカンマ区切りでフォーマット
 */
const formatNumber = (n: number): string => n.toLocaleString();

/**
 * 統計データからHTML生成
 */
export const createStatsHtml = (stats: ColorStats): string => {
  const remaining = stats.total - stats.matched;
  const percentage = stats.total > 0 ? (stats.matched / stats.total) * 100 : 0;

  // 100%完了時: COMPLETE! (gold border text) + total pixels
  if (remaining === 0) {
    return `
      <div style="width: 100%; margin-top: 0.25rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
        <span style="font-size: 0.6rem; font-weight: bold; color: #facc15; text-shadow: -1px -1px 0 #b45309, 1px -1px 0 #b45309, -1px 1px 0 #b45309, 1px 1px 0 #b45309;">COMPLETE!</span>
        <span style="font-size: 0.625rem; opacity: 0.8;">${formatNumber(
          stats.total
        )}px</span>
      </div>
    `;
  }

  return `
    <div style="width: 100%; margin-top: 0.25rem; display: flex; align-items: center;">
      <div style="flex: 1; height: 0.5rem; background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 0.125rem; overflow: hidden;">
        <div style="height: 100%; background: linear-gradient(to right, #3b82f6, #60a5fa); width: ${percentage.toFixed(
          1
        )}%; transition: width 0.3s ease;"></div>
      </div>
      <div style="font-size: 0.625rem; margin-left: 0.125rem; white-space: nowrap;">${formatNumber(
        remaining
      )}px</div>
    </div>
  `;
};

/**
 * Enhanced Modeからラベルキーを取得
 */
export const getEnhancedModeLabelKey = (mode: EnhancedMode): string => {
  return (
    ENHANCED_MODE_OPTIONS.find((m) => m.value === mode)?.labelKey ??
    "enhanced_mode_dot"
  );
};

/**
 * localStorageから現在選択中の色IDを取得
 */
export const getCurrentlySelectedColorId = (): number | null => {
  const selectedColorStr = window.localStorage.getItem("selected-color");
  return selectedColorStr ? parseInt(selectedColorStr) : null;
};
