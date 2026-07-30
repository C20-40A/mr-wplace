import {
  setDraftPaintListener,
  refreshFrontTileLayer,
} from "@/inject/features/map-instance";
import {
  addDraftPixel,
  clearDraft,
  getDraftPixelCount,
  removeDraftPixel,
  takeDirtyTiles,
  toTileKey,
} from "./draft-store";
import {
  removeAllDraftOverlays,
  syncAllDraftTiles,
  syncDraftTiles,
} from "./draft-renderer";

/**
 * Draft draw (下書きモード)
 *
 * ペイント予約を捕捉して charge を消費せずにオーバーレイ表示する。
 * 実際の送信は fetch-interceptor 側で抑止される。
 */

let draftModeEnabled = false;

export const isDraftModeEnabled = (): boolean => draftModeEnabled;

/** 描画反映を次の microtask にまとめる (連続ペイントでの再描画多発を防ぐ) */
let flushScheduled = false;

const scheduleFlush = (): void => {
  if (flushScheduled) return;
  flushScheduled = true;

  queueMicrotask(() => {
    flushScheduled = false;
    const dirty = takeDirtyTiles();
    if (dirty.length === 0) return;
    void syncDraftTiles(dirty).catch((error) => {
      console.error("🧑‍🎨 : Failed to sync draft tiles:", error);
    });
  });
};

const notifyDraftState = (): void => {
  window.postMessage(
    {
      source: "mr-wplace-draft-state",
      enabled: draftModeEnabled,
      pixelCount: getDraftPixelCount(),
    },
    "*"
  );
};

export const setDraftModeEnabled = (enabled: boolean): void => {
  if (draftModeEnabled === enabled) return;
  draftModeEnabled = enabled;

  if (enabled) {
    setDraftPaintListener((coord) => {
      if (!addDraftPixel(coord)) return;
      scheduleFlush();
      notifyDraftState();
    });
    void syncAllDraftTiles();
    console.log("🧑‍🎨 : Draft mode enabled");
  } else {
    setDraftPaintListener(null);
    console.log("🧑‍🎨 : Draft mode disabled");
  }

  notifyDraftState();
};

/** 下書きから 1 pixel 消す (wplace 側の取り消し操作に追従) */
export const eraseDraftPixel = (coord: {
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
}): void => {
  if (!draftModeEnabled) return;
  if (
    !removeDraftPixel(coord.tileX, coord.tileY, coord.pixelX, coord.pixelY)
  )
    return;

  scheduleFlush();
  notifyDraftState();
};

/** 下書きを全消去 */
export const clearAllDraft = (): void => {
  clearDraft();
  // store を空にした後は overlay を直接落とす方が速い。
  // 保留中の dirty も破棄して、flush による復活を防ぐ。
  takeDirtyTiles();
  removeAllDraftOverlays();
  refreshFrontTileLayer();
  notifyDraftState();
  console.log("🧑‍🎨 : Draft cleared");
};

export const getDraftStatus = (): {
  enabled: boolean;
  pixelCount: number;
} => ({
  enabled: draftModeEnabled,
  pixelCount: getDraftPixelCount(),
});

export { toTileKey };
