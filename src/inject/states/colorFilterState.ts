import type { EnhancedMode } from "@/types/image";

/**
 * Color filter state received from content script
 */
export interface ColorFilterState {
  isFilterActive: boolean;
  selectedRGBs?: [number, number, number][];
  enhancedMode: EnhancedMode;
  enhancedColor: [number, number, number];
  showUnplacedColor: [number, number, number];
  extraColorsBitmap?: number;
}

let colorFilterState: ColorFilterState = {
  isFilterActive: false,
  selectedRGBs: undefined,
  enhancedMode: "cross",
  enhancedColor: [255, 0, 0],
  showUnplacedColor: [160, 160, 160],
  extraColorsBitmap: undefined,
};

const isSameRgb = (
  a?: [number, number, number],
  b?: [number, number, number]
): boolean => {
  if (!a || !b) return a === b;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
};

const isSameSelectedRgbs = (
  a?: [number, number, number][],
  b?: [number, number, number][]
): boolean => {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!isSameRgb(a[i], b[i])) return false;
  }
  return true;
};

/**
 * Get current color filter state
 */
export const getColorFilterState = (): ColorFilterState => colorFilterState;

/**
 * Check if color filter is active
 */
export const isColorFilterActive = (): boolean =>
  colorFilterState.isFilterActive;

/**
 * Get selected RGB colors
 */
export const getSelectedRGBs = (): [number, number, number][] | undefined =>
  colorFilterState.selectedRGBs;

/**
 * Get enhanced mode
 */
export const getEnhancedMode = (): EnhancedMode =>
  colorFilterState.enhancedMode;

/**
 * Get enhanced marker color
 */
export const getEnhancedColor = (): [number, number, number] =>
  colorFilterState.enhancedColor;

/**
 * Get show-unplaced-only match layer color
 */
export const getShowUnplacedColor = (): [number, number, number] =>
  colorFilterState.showUnplacedColor;

/**
 * Get extra colors bitmap
 */
export const getExtraColorsBitmap = (): number | undefined =>
  colorFilterState.extraColorsBitmap;

/**
 * Update color filter state (called from message handler)
 */
export const updateColorFilterState = (
  newState: Partial<ColorFilterState>
): boolean => {
  const nextState = { ...colorFilterState, ...newState };
  const changed =
    colorFilterState.isFilterActive !== nextState.isFilterActive ||
    !isSameSelectedRgbs(colorFilterState.selectedRGBs, nextState.selectedRGBs) ||
    colorFilterState.enhancedMode !== nextState.enhancedMode ||
    !isSameRgb(colorFilterState.enhancedColor, nextState.enhancedColor) ||
    !isSameRgb(colorFilterState.showUnplacedColor, nextState.showUnplacedColor) ||
    colorFilterState.extraColorsBitmap !== nextState.extraColorsBitmap;
  if (!changed) return false;

  colorFilterState = nextState;
  console.log("🧑‍🎨 : Color filter state updated:", colorFilterState);
  return true;
};

/**
 * Set extra colors bitmap (called from user status manager)
 */
export const setExtraColorsBitmap = (bitmap: number | undefined): void => {
  colorFilterState.extraColorsBitmap = bitmap;
  console.log("🧑‍🎨 : Extra colors bitmap updated:", bitmap);
};
