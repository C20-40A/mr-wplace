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
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent color filter state to inject side`);
};
