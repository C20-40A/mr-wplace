import {
  setDraftPaintListener,
  clickAtLatLng,
  findPaintPreviewSourceId,
  fillPaintPreviewTile,
  getMapInstanceFromWplace,
} from "@/inject/features/map-instance";
import {
  addDraftPixel,
  clearDraft,
  getDraftPixelCount,
  removeDraftPixel,
  seedDraftFromPixels,
  toTileKey,
} from "./draft-store";
import { exportDraftAsImage, type DraftExportResult } from "./draft-export";
import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";
import { tilePixelToLatLng } from "@/utils/coordinate";

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

const TILE_SIZE = TILE_DRAW_CONSTANTS.TILE_SIZE;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type SeedPoint = { x: number; y: number; r: number; g: number; b: number };

/**
 * 指定タイルの paint-preview-* レイヤーを動的生成させる。
 *
 * 背景 (use_this のリバースエンジニアリングで判明):
 * - targetPaintedPixelMap.set() だけでは画面に何も反映されない。
 *   wplace 本体は Map 更新とは別に、専用の Umt クラスが
 *   タイル単位の ImageSource (paint-preview-{tileX,tileY}) を
 *   「最初の1pxペイント時」に動的生成し、以後はその canvas に直接描く。
 * - このレイヤー生成は wplace 自身のクリックハンドラ内でのみ行われるため、
 *   Map への直接 set では代替できない。合成クリックで本物のペイントを
 *   1px 発火させ、レイヤー生成をトリガーする必要がある (charges を 1px 分消費)。
 *
 * トリガーに使う1pxは、タイル中心などの無関係な座標ではなく
 * **seed対象ピクセルそのもの (seedPoint)** を使う。こうすることで
 * 「本来のドット絵と無関係なゴミ1px」が残らず、後続の一括描画でも
 * そのまま上書きされる (同じ座標・同じ色なので実質的にノーコスト)。
 */
const triggerTilePreviewLayer = async (
  tileX: number,
  tileY: number,
  seedPoint: SeedPoint,
  timeoutMs = 2000,
): Promise<boolean> => {
  if (findPaintPreviewSourceId(getMapInstanceFromWplace()!, tileX, tileY))
    return true;

  const map = getMapInstanceFromWplace();
  if (!map) return false;

  const { lat, lng } = tilePixelToLatLng(tileX, tileY, seedPoint.x, seedPoint.y);
  if (!clickAtLatLng(map, lat, lng)) return false;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (findPaintPreviewSourceId(map, tileX, tileY)) return true;
    await delay(50);
  }
  return false;
};

/**
 * 既存 gallery 画像を下書きへ読み込む (下書き編集の起点用)。
 * dataUrl を decode し、透明ピクセルを除いて座標付きで蓄積する。
 *
 * 「配置済みの見た目」から編集を始めるため、タイル単位で:
 *   1. タイル中心へ合成クリックし、wplace 自身に1pxペイントさせて
 *      paint-preview レイヤーを動的生成させる (charges を 1px 分消費)
 *   2. 生成された canvas へ残り全ピクセルを直接描画する (charges 消費なし)
 * レイヤーを生成できなかったタイルは draft-store のみへフォールバック蓄積する
 * (画面には反映されないが下書き自体は失われない)。
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

      // world pixel 座標(TLX/TLY/PxX/PxYからの絶対座標) -> tile単位でグルーピング
      const { TLX, TLY, PxX, PxY } = data.origin;
      const byTile = new Map<
        string,
        { tileX: number; tileY: number; points: SeedPoint[] }
      >();

      for (let y = 0; y < bitmap.height; y++) {
        for (let x = 0; x < bitmap.width; x++) {
          const i = (y * bitmap.width + x) * 4;
          const a = pixels[i + 3];
          if (a === 0) continue;

          const worldX = TLX * TILE_SIZE + PxX + x;
          const worldY = TLY * TILE_SIZE + PxY + y;
          const tileX = Math.floor(worldX / TILE_SIZE);
          const tileY = Math.floor(worldY / TILE_SIZE);
          const pixelX = worldX - tileX * TILE_SIZE;
          const pixelY = worldY - tileY * TILE_SIZE;

          const tileKey = toTileKey(tileX, tileY);
          let entry = byTile.get(tileKey);
          if (!entry) {
            entry = { tileX, tileY, points: [] };
            byTile.set(tileKey, entry);
          }
          entry.points.push({
            x: pixelX,
            y: pixelY,
            r: pixels[i],
            g: pixels[i + 1],
            b: pixels[i + 2],
          });
        }
      }

      for (const { tileX, tileY, points } of byTile.values()) {
        const layerReady = await triggerTilePreviewLayer(
          tileX,
          tileY,
          points[0],
        );

        if (!layerReady) {
          seeded += seedDraftFromPixels(
            points.map((p) => ({ x: p.x, y: p.y, r: p.r, g: p.g, b: p.b })),
            data.origin,
          );
          console.warn(
            `🧑‍🎨 : Draft seed: tile (${tileX},${tileY}) preview layer not available, ${points.length} pixels stored in draft only`,
          );
          continue;
        }

        const map = getMapInstanceFromWplace();
        const filled =
          !!map &&
          fillPaintPreviewTile(
            map,
            tileX,
            tileY,
            points.map((p) => ({
              pixelX: p.x,
              pixelY: p.y,
              r: p.r,
              g: p.g,
              b: p.b,
            })),
          );

        if (filled) {
          seeded += points.length;
        } else {
          seeded += seedDraftFromPixels(points, data.origin);
        }
      }
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
