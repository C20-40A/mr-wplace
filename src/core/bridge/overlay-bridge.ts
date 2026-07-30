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
 * Send overlay lightweight mode setting to inject side
 */
export const sendOverlayLightweightModeToInject = (enabled: boolean) => {
  window.postMessage(
    {
      source: "mr-wplace-overlay-lightweight-mode",
      enabled,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent overlay lightweight mode to inject side: ${enabled}`
  );
};

/**
 * Send draft mode toggle to inject side
 */
export const sendDraftModeToInject = (enabled: boolean) => {
  window.postMessage(
    { source: "mr-wplace-draft-mode-update", enabled },
    "*"
  );
  console.log(`🧑‍🎨 : Sent draft mode to inject side: ${enabled}`);
};

/**
 * Request inject side to discard all draft pixels
 */
export const sendDraftClearToInject = () => {
  window.postMessage({ source: "mr-wplace-draft-clear" }, "*");
  console.log("🧑‍🎨 : Sent draft clear to inject side");
};

export interface DraftExportResult {
  dataUrl: string;
  width: number;
  height: number;
  pixelCount: number;
  coords: { TLX: number; TLY: number; PxX: number; PxY: number };
}

/**
 * Request the inject side to render the draft as a single image.
 * Returns null when there is nothing to export (or on timeout).
 */
export const requestDraftExport = (): Promise<DraftExportResult | null> =>
  new Promise((resolve) => {
    const requestId = `draft-export-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      console.warn("🧑‍🎨 : Draft export request timed out");
      resolve(null);
    }, 15000);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== "mr-wplace-response-draft-export") return;
      if (event.data.requestId !== requestId) return;

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      resolve(event.data.result ?? null);
    };

    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: "mr-wplace-request-draft-export", requestId },
      "*"
    );
  });

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
