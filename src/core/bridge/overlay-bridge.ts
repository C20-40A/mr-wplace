/**
 * Overlay Bridge - Content ↔ Inject communication for overlay rendering state
 */

import type { ColorFilterManager } from "@/utils/color-filter-manager";

/**
 * Send show unplaced only setting to inject side
 * Note: This is a transient state, not persisted to storage
 */
export const sendShowUnplacedOnlyToInject = (enabled: boolean) => {
  window.postMessage(
    {
      source: "mr-wplace-show-unplaced-only",
      enabled,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent show unplaced only to inject side: ${enabled}`);
};

/**
 * Send selected color only mark setting to inject side
 */
export const sendSelectedColorOnlyMarkToInject = (enabled: boolean) => {
  window.postMessage(
    {
      source: "mr-wplace-selected-color-only-mark",
      enabled,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent selected color only mark to inject side: ${enabled}`);
};

/**
 * Send color filter state to inject side
 */
export const sendColorFilterToInject = (
  colorFilterManager: ColorFilterManager
) => {
  window.postMessage(
    {
      source: "mr-wplace-color-filter",
      isFilterActive: colorFilterManager.isFilterActive(),
      selectedRGBs: colorFilterManager.selectedRGBs,
      enhancedMode: colorFilterManager.getEnhancedMode(),
      enhancedColor: colorFilterManager.getEnhancedColor(),
      showUnplacedColor: colorFilterManager.getShowUnplacedColor(),
    },
    "*"
  );

  const btn = document.getElementById("color-filter-fab-btn");
  if (btn) btn.style.filter = colorFilterManager.selectedRGBs.length === 0 ? "grayscale(1)" : "";

  console.log(`🧑‍🎨 : Sent color filter state to inject side`);
};
