import {
  applyDraftPixel,
  clearDraft,
  getDraftPixelCount,
  removeDraftPixel,
  seedDraftFromPixels,
  setDraftPixel,
  setDraftStoreChangeListener,
  toTileKey,
} from "./draft-store";
import {
  canRedoDraft,
  canUndoDraft,
  redoDraft,
  setDraftHistoryChangeListener,
  undoDraft,
} from "./draft-history";
import {
  cancelDraftLine,
  commitDraftLine,
  markDraftCanvasDirty,
  setDraftBucketMode,
  setDraftCanvasActive,
  setDraftCanvasHandlers,
  setDraftEraseMode,
  setDraftLineMode,
  setDraftLineStraightMode,
  setDraftMapLocked,
  setDraftStampSettings,
  updateDraftLineSettings,
} from "./draft-canvas";
import { exportDraftAsImage, type DraftExportResult } from "./draft-export";
import {
  setDraftBrushSize,
  setDraftDitherStyle,
  type DitherStyle,
} from "./draft-brush";
import { colorpalette } from "@/constants/colors";
import type { DraftStampMode, DraftStampPattern } from "./draft-stamp";

/**
 * Draft draw (下書きモード)
 *
 * wplace 本体のペイント機構には一切依存しない独自レイヤー。
 * map canvas の上に重ねた自前 canvas でクリック/ドラッグを受け、
 * 選択中のパレット色でピクセルを置く。
 *
 * wplace 側へは pointer を伝播させないため、実際のペイント送信も
 * charge 消費も発生しない (= 送信を遮断する仕組み自体が不要)。
 */

let draftModeEnabled = false;

export const isDraftModeEnabled = (): boolean => draftModeEnabled;

setDraftCanvasHandlers({
  onPaint: (tileX, tileY, pixelX, pixelY, color) => {
    if (!draftModeEnabled) return;
    setDraftPixel(tileX, tileY, pixelX, pixelY, color);
  },
  onErase: (tileX, tileY, pixelX, pixelY) => {
    if (!draftModeEnabled) return;
    removeDraftPixel(tileX, tileY, pixelX, pixelY);
  },
  // spoit で選択色が変わったらツールバーの選択表示を追従させる
  onColorPicked: (colorId) => {
    window.postMessage(
      { source: "mr-wplace-draft-color-picked", colorId },
      "*",
    );
  },
  // バケツが広すぎて中止された。content 側で控えめなヒントを出す
  onBucketFailed: () => {
    window.postMessage({ source: "mr-wplace-draft-bucket-too-large" }, "*");
  },
  // Ctrl+Z / Ctrl+Shift+Z。ボタン経由と同じ処理へ流す
  onUndoRequested: () => undoDraftEdit(),
  onRedoRequested: () => redoDraftEdit(),
  // 線のそばに出す ✓ / ×。確定後は content 側のツール状態も閉じる。
  onLineAction: (action) => {
    if (action === "commit") commitDraftLine();
    else cancelDraftLine();
    setDraftLineMode(false);
    notifyDraftState();
    window.postMessage(
      {
        source: "mr-wplace-draft-line-ended",
        committed: action === "commit",
      },
      "*",
    );
  },
});

const notifyDraftState = (): void => {
  window.postMessage(
    {
      source: "mr-wplace-draft-state",
      enabled: draftModeEnabled,
      pixelCount: getDraftPixelCount(),
      canUndo: canUndoDraft(),
      canRedo: canRedoDraft(),
    },
    "*",
  );
};

// store が変わったら「再描画」と「content への状態通知」を両方走らせる
setDraftStoreChangeListener(() => {
  markDraftCanvasDirty();
  notifyDraftState();
});

// 履歴の増減だけでもボタンの活性が変わるので content へ知らせる
setDraftHistoryChangeListener(() => notifyDraftState());

/**
 * undo/redo。適用は store の `applyDraftPixel` に委ねる。
 * 適用中は履歴側が記録を止めるので、undo が自分自身を積むことはない。
 */
export const undoDraftEdit = (): void => {
  if (!draftModeEnabled) return;
  if (undoDraft(applyDraftPixel)) markDraftCanvasDirty();
  notifyDraftState();
};

export const redoDraftEdit = (): void => {
  if (!draftModeEnabled) return;
  if (redoDraft(applyDraftPixel)) markDraftCanvasDirty();
  notifyDraftState();
};

export const setDraftModeEnabled = (enabled: boolean): void => {
  if (draftModeEnabled === enabled) return;
  draftModeEnabled = enabled;

  setDraftCanvasActive(enabled);
  if (!enabled) clearDraft();

  console.log(`🧑‍🎨 : Draft mode ${enabled ? "enabled" : "disabled"}`);
  notifyDraftState();
};

export const setDraftEraseModeEnabled = (enabled: boolean): void => {
  setDraftEraseMode(enabled);
  console.log(`🧑‍🎨 : Draft erase mode: ${enabled}`);
};

export const setDraftBucketModeEnabled = (enabled: boolean): void => {
  setDraftBucketMode(enabled);
  console.log(`🧑‍🎨 : Draft bucket mode: ${enabled}`);
};

/** マップロック。ON の間は左ドラッグが pan ではなく描画になる */
export const setDraftMapLockEnabled = (enabled: boolean): void => {
  setDraftMapLocked(enabled);
  console.log(`🧑‍🎨 : Draft map lock: ${enabled}`);
};

/** ブラシ設定 (サイズ / ディザリングスタイル) の反映 */
export const setDraftBrushSettings = (data: {
  size?: number;
  ditherStyle?: DitherStyle;
}): void => {
  if (typeof data.size === "number") setDraftBrushSize(data.size);
  if (data.ditherStyle) setDraftDitherStyle(data.ditherStyle);
};

/** Custom stamp pattern, placement type, and active state. */
export const setDraftStampToolSettings = (data: {
  enabled?: boolean;
  mode?: DraftStampMode;
  pattern?: DraftStampPattern;
}): void => {
  setDraftStampSettings(data);
};

/** Line tool settings and edit commands. */
export const setDraftLineSettings = (data: {
  enabled?: boolean;
  innerWidth?: number;
  outlineWidth?: number;
  innerColorId?: number;
  outlineColorId?: number;
  straightMode?: boolean;
  command?: "commit" | "cancel";
}): void => {
  if (typeof data.straightMode === "boolean")
    setDraftLineStraightMode(data.straightMode);

  const settings: Parameters<typeof updateDraftLineSettings>[0] = {};
  if (typeof data.innerWidth === "number")
    settings.innerWidth = data.innerWidth;
  if (typeof data.outlineWidth === "number")
    settings.outlineWidth = data.outlineWidth;

  const toColor = (id: number | undefined) => {
    if (typeof id !== "number") return null;
    const entry = colorpalette.find((color) => color.id === id);
    if (!entry) return null;
    return { r: entry.rgb[0], g: entry.rgb[1], b: entry.rgb[2] };
  };
  const innerColor = toColor(data.innerColorId);
  const outlineColor = toColor(data.outlineColorId);
  if (innerColor) settings.innerColor = innerColor;
  if (outlineColor) settings.outlineColor = outlineColor;
  updateDraftLineSettings(settings);

  if (data.command === "commit") {
    commitDraftLine();
    setDraftLineMode(false);
    return;
  }
  if (data.command === "cancel") {
    cancelDraftLine();
    setDraftLineMode(false);
    return;
  }
  if (typeof data.enabled === "boolean") setDraftLineMode(data.enabled);
};

/**
 * 既存 gallery 画像を下書きへ読み込む (下書き編集の起点)。
 * dataUrl を decode し、透明ピクセルを除いて蓄積する。
 * 蓄積した時点で独自レイヤーに「配置済みの見た目」として現れる。
 */
export const handleDraftSeedRequest = async (data: {
  requestId: string;
  dataUrl: string;
  origin: { TLX: number; TLY: number; PxX: number; PxY: number };
}): Promise<void> => {
  let seeded = 0;

  try {
    const res = await fetch(data.dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.drawImage(bitmap, 0, 0);
      const { data: pixels } = ctx.getImageData(
        0,
        0,
        bitmap.width,
        bitmap.height,
      );

      const points: Array<{
        x: number;
        y: number;
        r: number;
        g: number;
        b: number;
      }> = [];

      for (let y = 0; y < bitmap.height; y++) {
        for (let x = 0; x < bitmap.width; x++) {
          const i = (y * bitmap.width + x) * 4;
          if (pixels[i + 3] === 0) continue;
          points.push({
            x,
            y,
            r: pixels[i],
            g: pixels[i + 1],
            b: pixels[i + 2],
          });
        }
      }

      seeded = seedDraftFromPixels(points, data.origin);
    }

    bitmap.close();
  } catch (error) {
    console.error("🧑‍🎨 : Draft seed failed:", error);
  }

  console.log(`🧑‍🎨 : Draft seeded ${seeded} pixels`);
  notifyDraftState();

  window.postMessage(
    {
      source: "mr-wplace-response-draft-seed",
      requestId: data.requestId,
      seeded,
    },
    "*",
  );
};

/** 下書きを画像化して content へ返す (gallery 保存用) */
export const handleDraftExportRequest = async (data: {
  requestId: string;
}): Promise<void> => {
  let result: DraftExportResult | null = null;
  try {
    result = await exportDraftAsImage();
  } catch (error) {
    console.error("🧑‍🎨 : Draft export failed:", error);
  }

  window.postMessage(
    {
      source: "mr-wplace-response-draft-export",
      requestId: data.requestId,
      result,
    },
    "*",
  );
};

/** 下書きを全消去 */
export const clearAllDraft = (): void => {
  clearDraft();
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
