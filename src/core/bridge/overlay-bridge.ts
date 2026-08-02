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
 * Send draft eraser toggle to inject side
 */
export const sendDraftEraseModeToInject = (enabled: boolean) => {
  window.postMessage(
    { source: "mr-wplace-draft-erase-update", enabled },
    "*"
  );
};

/**
 * Send draft bucket fill toggle to inject side
 */
export const sendDraftBucketModeToInject = (enabled: boolean) => {
  window.postMessage(
    { source: "mr-wplace-draft-bucket-update", enabled },
    "*"
  );
};

/**
 * Send draft map lock toggle to inject side.
 * When locked, left drag paints instead of panning the map.
 */
export const sendDraftMapLockToInject = (enabled: boolean) => {
  window.postMessage(
    { source: "mr-wplace-draft-map-lock-update", enabled },
    "*"
  );
};

/**
 * Send draft undo / redo request to inject side.
 * The inject side owns the pixel store, so history lives there too.
 */
export const sendDraftUndoToInject = () => {
  window.postMessage({ source: "mr-wplace-draft-undo" }, "*");
};

export const sendDraftRedoToInject = () => {
  window.postMessage({ source: "mr-wplace-draft-redo" }, "*");
};

/**
 * Send draft brush settings (size / dither style) to inject side
 */
export const sendDraftBrushToInject = (settings: {
  size?: number;
  ditherStyle?: string;
}) => {
  window.postMessage(
    { source: "mr-wplace-draft-brush-update", ...settings },
    "*"
  );
};

/** Send custom stamp pattern/tool state to the inject canvas. */
export const sendDraftStampToInject = (data: {
  enabled?: boolean;
  mode?: "single" | "fill";
  pattern?: { width: number; height: number; colorIds: Array<number | null> };
}) => {
  window.postMessage({ source: "mr-wplace-draft-stamp-update", ...data }, "*");
};

/** Send line tool state/settings or an edit command to the inject canvas. */
export const sendDraftLineToInject = (data: {
  enabled?: boolean;
  innerWidth?: number;
  outlineWidth?: number;
  innerColorId?: number;
  outlineColorId?: number;
  straightMode?: boolean;
  command?: "commit" | "cancel";
}) => {
  window.postMessage({ source: "mr-wplace-draft-line-update", ...data }, "*");
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
 * Request the inject side to seed the draft store from an existing image
 * (下書き編集: 既存 gallery item のピクセルを下書きへ読み込む).
 * Returns the number of pixels seeded (0 on failure/timeout).
 */
export const requestDraftSeed = (
  dataUrl: string,
  origin: { TLX: number; TLY: number; PxX: number; PxY: number }
): Promise<number> =>
  new Promise((resolve) => {
    const requestId = `draft-seed-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      console.warn("🧑‍🎨 : Draft seed request timed out");
      resolve(0);
    }, 15000);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== "mr-wplace-response-draft-seed") return;
      if (event.data.requestId !== requestId) return;

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      resolve(event.data.seeded ?? 0);
    };

    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: "mr-wplace-request-draft-seed", requestId, dataUrl, origin },
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
