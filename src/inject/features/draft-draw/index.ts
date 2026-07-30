import { setDraftPaintListener } from "@/inject/features/map-instance";
import {
  addDraftPixel,
  clearDraft,
  getDraftPixelCount,
  removeDraftPixel,
  seedDraftFromPixels,
  toTileKey,
} from "./draft-store";
import { exportDraftAsImage, type DraftExportResult } from "./draft-export";

/**
 * Draft draw (下書きモード)
 *
 * ペイント予約を捕捉して蓄積し、送信だけを抑止する。
 *
 * NOTE: 描画は行わない。予約中のピクセルは wplace 本体が既に表示しているため、
 * overlay を重ねる必要がない。蓄積データは「下書きを保存」時にのみ使う。
 */

let draftModeEnabled = false;

/**
 * 現在のペイントセッションで下書き pixel を1つでも捕捉したか。
 *
 * SAFETY: モードが何らかの理由で OFF になっても、下書きが混ざったセッションは
 * 送信させない。「BANされうる誤送信」を防ぐための fail-closed 判定。
 */
let sessionHasDraftPixels = false;

export const isDraftModeEnabled = (): boolean => draftModeEnabled;

/**
 * SAFETY: paint POST を遮断すべきか。
 * mode ON か、下書きが混ざったセッションなら遮断する(OR判定 = fail-closed)。
 */
export const shouldBlockPaintSubmit = (): boolean =>
  draftModeEnabled || sessionHasDraftPixels;

/**
 * ペイントセッション終了時に呼ぶ (モーダルを閉じた等)。
 *
 * SAFETY: モードも必ず OFF に戻す。UI(ボタン)はモーダル内にしか無いため、
 * ON のまま残すと「本人が気づけない下書きモード」が発生し、
 * 次のセッションで意図しない挙動につながる。
 */
export const resetDraftSession = (): void => {
  sessionHasDraftPixels = false;
  if (draftModeEnabled) setDraftModeEnabled(false);
  // 下書きはセッション内だけのもの。閉じたら残さない(保存済みは gallery 側にある)
  clearAllDraft();
};

/**
 * 既存 gallery 画像を下書きへ読み込む (下書き編集の起点用)。
 * dataUrl を decode し、透明ピクセルを除いて座標付きで蓄積する。
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

      const points: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
      for (let y = 0; y < bitmap.height; y++) {
        for (let x = 0; x < bitmap.width; x++) {
          const i = (y * bitmap.width + x) * 4;
          const a = pixels[i + 3];
          if (a === 0) continue;
          points.push({ x, y, r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
        }
      }

      seeded = seedDraftFromPixels(points, data.origin);
    }
  } catch (error) {
    console.error("🧑‍🎨 : Draft seed failed:", error);
  }

  notifyDraftState();

  window.postMessage(
    {
      source: "mr-wplace-response-draft-seed",
      requestId: data.requestId,
      seeded,
    },
    "*"
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
    "*"
  );
};

/** 送信が遮断されたことを content 側へ通知 (UI で明示する用) */
export const notifyDraftSubmitBlocked = (): void => {
  window.postMessage({ source: "mr-wplace-draft-submit-blocked" }, "*");
};

let lastNotifiedCount = -1;

const notifyDraftState = (): void => {
  const pixelCount = getDraftPixelCount();

  // 蓄積が進んでいるかを確認できるよう、変化時だけ出力する
  if (pixelCount !== lastNotifiedCount) {
    lastNotifiedCount = pixelCount;
    console.log(
      `🧑‍🎨 : Draft state: enabled=${draftModeEnabled} pixels=${pixelCount}`,
    );
  }

  window.postMessage(
    {
      source: "mr-wplace-draft-state",
      enabled: draftModeEnabled,
      pixelCount,
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
      // SAFETY: 捕捉した時点でこのセッションは「下書き混入」扱いにする
      sessionHasDraftPixels = true;
      notifyDraftState();
    });
    console.log("🧑‍🎨 : Draft mode enabled (listener attached)");
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
  if (!removeDraftPixel(coord.tileX, coord.tileY, coord.pixelX, coord.pixelY))
    return;

  notifyDraftState();
};

/** 下書きを全消去 */
export const clearAllDraft = (): void => {
  clearDraft();
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
