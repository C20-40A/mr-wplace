import type { CapturedPaintedCoordinate } from "@/inject/types";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { TILE_SIZE } from "@/utils/geo-converter";
import { subscribePaintMode } from "@/utils/paint-mode";
import { getMapInstanceFromWplace } from "../map-instance/get-map-instance";
import { peekBackgroundPixelRgbInt } from "../paint-guide-background";
import { getPaintedRgbInt, type PaintVerdict } from "../paint-stats-updater";
import { overlayLayers, perTileColorStats } from "../tile-draw/states";
import {
  burstAt,
  confettiRain,
  destroyFx,
  screenFlash,
  setFxProjectorFactory,
  textAt,
  topText,
  type WorldToScreen,
} from "./fx";
import { destroyHud, setHudVisible, showProgressResult, updateHud } from "./hud";
import {
  closeAudio,
  playBlip,
  playFanfare,
  playMilestone,
  playMiss,
} from "./sound";

/**
 * 演出強化モード（パーティーモード）
 * OFF 時は notify* が先頭で return するだけで、DOM/RAF/Audio/購読を一切持たない
 *
 * ゲーム性: 量ではなく腕前を評価する
 * - 進捗(テンプレ通り & まだその色でない) だけが得点。細部(detail) は ×3
 * - 進捗が続くと倍率アップ。ミスで保留ボーナス半減 + 倍率リセット
 * - Paint 確定で保留ボーナスを獲得。確定すると倍率もリセット (= 粘るか確定するかの駆け引き)
 * 演出: 1px ごとに同期で即判定。大量に塗っても演出は 1 フレームにまとめる
 * リザルト: 確定 POST 後にペイントモードを抜けたら表示。POST 無しで抜けたらキャンセル扱いで破棄
 */

const RESULT_WAIT_MS = 1200;
const HUD_LINGER_MS = 3000;
const DETAIL_POINTS = 3;
const STREAK_STEP = 15;
const MAX_MULTIPLIER = 5;
const BURSTS_PER_FRAME = 3;
const PRAISE_EVERY = 5;
const PRAISES = ["NICE!", "GOOD!", "COOL!", "GREAT!", "SUPER!", "WOW!"];

type Judged = "progress" | "detail" | "same" | "out" | "miss";
interface JudgedPixel {
  wx: number;
  wy: number;
  judged: Judged;
  color: string;
}

const LABEL: Record<Judged, { color: string; size: number }> = {
  detail: { color: "#7ff", size: 32 },
  progress: { color: "#ffd700", size: 28 },
  miss: { color: "#bbb", size: 20 },
  same: { color: "#999", size: 14 },
  out: { color: "#999", size: 14 },
};

let enabled = false;
let frameQueue: JudgedPixel[] = [];
let framePoints = 0;
let frameScheduled = false;
let committed = false;
let exitTimer: ReturnType<typeof setTimeout> | null = null;
let lingerTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribePaintMode: (() => void) | null = null;
let paintModeActive = false;

// 確定までの保留状態
let streak = 0;
let pending = 0;
let progressCount = 0;
let missCount = 0;
/**
 * 今回塗った world pixel → 色。同じ色の塗り直し (Map.set の再発火) を二重に数えない
 * CRITICAL: key に coord.key ("t=(..);p=(..);s=..") を使わないこと。
 * Map.prototype.set はフックされており、その形式の key を持つ Map は wplace の
 * painted pixel map と誤認されて再帰する
 */
const scoredKeys = new Map<number, number | null>();
const worldKey = (c: CapturedPaintedCoordinate) =>
  (c.tileY * TILE_SIZE + c.pixelY) * 2048 * TILE_SIZE + c.tileX * TILE_SIZE + c.pixelX;
/** 今回最初に進捗を出したテンプレと、その時点の完成度 */
let progressImageKey: string | null = null;
let progressBefore = 0;

const multiplier = () =>
  Math.min(1 + Math.floor(streak / STREAK_STEP) * 0.5, MAX_MULTIPLIER);

const resetCycle = () => {
  streak = 0;
  pending = 0;
  progressCount = 0;
  missCount = 0;
  committed = false;
  scoredKeys.clear();
  progressImageKey = null;
};

const syncHudVisibility = () =>
  setHudVisible(paintModeActive || lingerTimer !== null);

/** タイル上の最上位テンプレ (表示中) の imageKey */
const findTemplateKey = (tileX: number, tileY: number): string | null => {
  const tileKey = `${tileX},${tileY}`;
  const paddedKey = `${String(tileX).padStart(4, "0")},${String(tileY).padStart(4, "0")}`;
  for (let i = overlayLayers.length - 1; i >= 0; i--) {
    const layer = overlayLayers[i];
    if (!layer.drawEnabled) continue;
    const tiles = layer.affectedTileSet;
    if (tiles && !tiles.has(tileKey) && !tiles.has(paddedKey)) continue;
    return layer.imageKey;
  }
  return null;
};

/** テンプレ完成度 (読み込み済みタイルの stats 合計。stats 側が塗るたびに楽観更新する) */
const templateStats = (imageKey: string) => {
  const stats = perTileColorStats.get(imageKey);
  if (!stats) return null;
  let matched = 0;
  let total = 0;
  for (const s of stats.values()) {
    for (const v of s.matched.values()) matched += v;
    for (const v of s.total.values()) total += v;
  }
  return total > 0 ? { matched, total } : null;
};

/** world pixel → 画面座標の線形変換（画面内では十分正確・project は 3 回だけ） */
const createProjector = (refWx: number, refWy: number): WorldToScreen | null => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) return null;
  const rect = map.getContainer().getBoundingClientRect();
  const project = (dx: number, dy: number) => {
    const { lat, lng } = tilePixelToLatLng(0, 0, refWx + 0.5 + dx, refWy + 0.5 + dy);
    return map.project([lng, lat]);
  };
  const o = project(0, 0);
  const sx = project(1, 0).x - o.x;
  const sy = project(0, 1).y - o.y;
  return (wx, wy) => ({
    x: rect.left + o.x + (wx - refWx) * sx,
    y: rect.top + o.y + (wy - refWy) * sy,
  });
};

const showResult = () => {
  const judgedCount = progressCount + missCount;
  if (judgedCount === 0) return;
  const acc = Math.round((progressCount / judgedCount) * 100);
  const points = Math.round(pending);
  const perfect = acc === 100 && progressCount >= 10;
  const title = perfect ? "PERFECT!!" : acc >= 90 ? "GREAT!" : acc >= 60 ? "NICE" : "OK";

  topText(title, perfect ? 56 : 44, { life: 150, rainbow: acc >= 90 });
  topText(`+${points.toLocaleString()}`, 40, { offsetY: 56, color: "#ffd700", rainbow: false, life: 150 });

  // テンプレ完成度が取れて、変化が見える時だけ N% → M%
  const after = progressImageKey ? templateStats(progressImageKey) : null;
  if (after) {
    const topY = Math.max(72, window.innerHeight * 0.14);
    showProgressResult(progressBefore, after.matched / after.total, topY + 90);
  }

  // 演出の量は塗った量ではなく得点の平方根で（ベタ塗りで青天井にしない）
  const power = Math.sqrt(points);
  if (power >= 3) confettiRain(Math.min(Math.round(power * 6), 200));
  screenFlash(perfect ? 0.3 : 0.15);
  playFanfare(perfect);

  // ペイントモードを抜けた後も、数字を少し見せる
  if (lingerTimer) clearTimeout(lingerTimer);
  lingerTimer = setTimeout(() => {
    lingerTimer = null;
    syncHudVisibility();
  }, HUD_LINGER_MS);
  syncHudVisibility();
};

/** ペイントモードを抜けた: 確定 POST が来ていればリザルト、来なければキャンセル扱い */
const handlePaintModeExit = () => {
  exitTimer = null;
  if (!enabled || paintModeActive) return;
  if (committed) showResult();
  resetCycle();
};

const handlePaintMode = (active: boolean) => {
  paintModeActive = active;
  if (exitTimer) clearTimeout(exitTimer);
  exitTimer = null;
  // POST はモードが閉じた後に届くこともあるので少し待つ
  if (!active) exitTimer = setTimeout(handlePaintModeExit, RESULT_WAIT_MS);
  syncHudVisibility();
};

export const isPartyModeEnabled = () => enabled;

export const setPartyModeEnabled = (value: boolean) => {
  if (enabled === value) return;
  enabled = value;
  if (enabled) {
    setFxProjectorFactory(createProjector);
    unsubscribePaintMode = subscribePaintMode(handlePaintMode);
    return;
  }
  unsubscribePaintMode?.();
  unsubscribePaintMode = null;
  if (exitTimer) clearTimeout(exitTimer);
  if (lingerTimer) clearTimeout(lingerTimer);
  exitTimer = lingerTimer = null;
  frameQueue = [];
  framePoints = 0;
  resetCycle();
  setFxProjectorFactory(null);
  destroyFx();
  destroyHud();
  closeAudio();
};

/** 同期判定。下地が未 decode (undefined) の時は進捗として扱う */
const judge = (coord: CapturedPaintedCoordinate, verdict: PaintVerdict): Judged => {
  if (verdict === "mismatch") return "miss";
  if (verdict === "none") return "out";
  const background = peekBackgroundPixelRgbInt(coord);
  if (background != null && background === getPaintedRgbInt(coord)) return "same";
  return verdict === "detail" ? "detail" : "progress";
};

const isGood = (j: Judged) => j === "progress" || j === "detail";

/** 最初の進捗で、どのテンプレの完成度を追うかと開始値を記録 */
const captureProgressStart = (coord: CapturedPaintedCoordinate) => {
  if (progressImageKey) return;
  const key = findTemplateKey(coord.tileX, coord.tileY);
  const stats = key ? templateStats(key) : null;
  if (!key || !stats) return;
  progressImageKey = key;
  // stats 側はこのピクセル分を既に楽観加算しているので 1 引く
  progressBefore = Math.max(stats.matched - 1, 0) / stats.total;
};

/** 採点して状態を更新。演出はフレーム単位でまとめる */
const score = (coord: CapturedPaintedCoordinate, judged: Judged) => {
  const beforeMultiplier = multiplier();
  if (judged === "miss") {
    missCount++;
    // 連続ミスで何度も半減しないよう、進捗が挟まった後の最初のミスだけ
    if (streak > 0) pending = Math.floor(pending / 2);
    streak = 0;
  } else if (isGood(judged)) {
    captureProgressStart(coord);
    const points = (judged === "detail" ? DETAIL_POINTS : 1) * beforeMultiplier;
    pending += points;
    framePoints += points;
    progressCount++;
    streak++;
  }
  if (multiplier() > beforeMultiplier) {
    topText(`×${multiplier()} !!`, 40 + multiplier() * 4, { life: 70 });
    playMilestone(Math.min(Math.round((multiplier() - 1) * 2), 4));
  }

  const { color } = coord;
  frameQueue.push({
    wx: coord.tileX * TILE_SIZE + coord.pixelX,
    wy: coord.tileY * TILE_SIZE + coord.pixelY,
    judged,
    color: color ? `rgb(${color.r},${color.g},${color.b})` : "#ffd700",
  });
  if (frameScheduled) return;
  frameScheduled = true;
  requestAnimationFrame(flushFrame);
};

/** 1 フレーム分の演出: 粒子は最新数件。成功があれば合計点を最後の成功地点に、無ければ最後の判定ラベル */
const flushFrame = () => {
  frameScheduled = false;
  const queue = frameQueue;
  const points = framePoints;
  frameQueue = [];
  framePoints = 0;
  if (!enabled || !queue.length) return;

  for (const p of queue.slice(-BURSTS_PER_FRAME)) {
    if (p.judged === "miss") burstAt(p.wx, p.wy, "#777", 3, 0.6);
    else if (!isGood(p.judged)) burstAt(p.wx, p.wy, p.color, 2, 0.6);
    else burstAt(p.wx, p.wy, p.judged === "detail" ? "#7ff" : p.color, 5, 1 + multiplier() / 5);
  }

  let lastGood: JudgedPixel | null = null;
  for (let i = queue.length - 1; i >= 0 && !lastGood; i--) {
    if (isGood(queue[i].judged)) lastGood = queue[i];
  }

  if (lastGood) {
    const label = LABEL[lastGood.judged];
    // 倍率が上がるほど数字も少し大きく
    textAt(lastGood.wx, lastGood.wy, `+${Math.round(points * 10) / 10}`, {
      ...label,
      size: label.size + (multiplier() - 1) * 4,
      life: 40,
    });
    if (streak > 0 && streak % PRAISE_EVERY === 0) {
      const word = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      textAt(lastGood.wx, lastGood.wy - 3, word, { size: 30, rainbow: true, life: 55 });
    }
    playBlip(Math.min(streak, 14) + 1);
  } else {
    const last = queue[queue.length - 1];
    textAt(last.wx, last.wy, last.judged.toUpperCase(), { ...LABEL[last.judged], life: 40 });
  }
  if (queue.some((p) => p.judged === "miss")) playMiss();

  updateHud(Math.round(pending), multiplier());
};

/** 1px 置かれた瞬間（paint listener から）。すべて同期で処理する */
export const notifyPartyPaint = (
  coord: CapturedPaintedCoordinate,
  verdict: PaintVerdict,
) => {
  if (!enabled) return;
  // wplace 本体の Map.set フック内で呼ばれるので絶対に throw しない
  try {
    const rgb = getPaintedRgbInt(coord);
    const key = worldKey(coord);
    if (scoredKeys.has(key) && scoredKeys.get(key) === rgb) return;
    scoredKeys.set(key, rgb);
    score(coord, judge(coord, verdict));
  } catch (error) {
    console.warn("🧑‍🎨 : party paint fx failed", error);
  }
};

/** Paint 確定 POST 成功。リザルトはペイントモードを抜けたときに出す */
export const notifyPartyPaintCommit = () => {
  if (!enabled) return;
  committed = true;
};
