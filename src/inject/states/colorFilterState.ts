import type { EnhancedMode } from "@/types/image";

/**
 * Color filter state received from content script
 */
export interface ColorFilterState {
  isFilterActive: boolean;
  selectedRGBs?: [number, number, number][];
  enhancedMode: EnhancedMode;
  enhancedColor: [number, number, number];
  extraColorsBitmap?: number;
}

let colorFilterState: ColorFilterState = {
  isFilterActive: false,
  selectedRGBs: undefined,
  enhancedMode: "dot",
  enhancedColor: [255, 0, 0],
  extraColorsBitmap: undefined,
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
 * Get extra colors bitmap
 */
export const getExtraColorsBitmap = (): number | undefined =>
  colorFilterState.extraColorsBitmap;

/**
 * Update color filter state (called from message handler)
 */
export const updateColorFilterState = (
  newState: Partial<ColorFilterState>
): void => {
  colorFilterState = { ...colorFilterState, ...newState };
  console.log("🧑‍🎨 : Color filter state updated:", colorFilterState);
};

/**
 * Set extra colors bitmap (called from user status manager)
 */
export const setExtraColorsBitmap = (bitmap: number | undefined): void => {
  colorFilterState.extraColorsBitmap = bitmap;
  console.log("🧑‍🎨 : Extra colors bitmap updated:", bitmap);
};
