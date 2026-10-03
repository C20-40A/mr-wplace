import type { CapturedPaintedCoordinate } from "@/inject/types";
import { PARTY_RESULT_TITLES, type PartyResultAssetUrls } from "@/constants/party-mode";
import { clearResultAssets, prepareResultAssets } from "@/inject/features/party-mode/result-assets";
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
  type WorldToScreen,
} from "./fx";
import { destroyHud, resetHudScore, setHudVisible, showResultPanel, updateHud } from "./hud";
import { closeAudio, playBlip, playComplete, playFanfare, playMiss } from "./sound";

/**
 * 演出強化モード（パーティーモード）
 * OFF 時は notify* が先頭で return するだけで、DOM/RAF/Audio/購読を一切持たない
 *
 * ゲーム性: 量ではなく腕前を評価する
 * - 進捗(テンプレ通り & まだその色でない) だけが得点。細部(detail) は 3pt
 * - ミスで保留ボーナス半減
 * - Paint 確定で保留ボーナスを獲得
 * 演出: 1px ごとに同期で即判定。大量に塗っても演出は 1 フレームにまとめる
 *       成功 10px ごとに +10, +20 ... を黄色で出す
 * リザルト: 確定 POST 後にペイントモードを抜けたら表示。POST 無しで抜けたらキャンセル扱いで破棄
 */

const RESULT_WAIT_MS = 1200;
/** 成功 px 数 → タイトルと画像の高さ (多いほど大きい) */
const TITLE_TIERS = [
  { min: 500, key: "perfect", height: 120 },
  { min: 200, key: "great", height: 92 },
  { min: 100, key: "nice", height: 72 },
  { min: 50, key: "ok", height: 72 },
] as const;
/** この px 数で塗り音が最高音になる */
const MAX_PITCH_PX = 500;
const DETAIL_POINTS = 3;
const BURSTS_PER_FRAME = 3;
const COUNT_EVERY = 10;

type Judged = "progress" | "detail" | "same" | "out" | "miss";
interface JudgedPixel {
  wx: number;
  wy: number;
  judged: Judged;
  color: string;
}

// 成功時はラベルを出さない（10px ごとの +N のみ）
const LABEL: Record<Exclude<Judged, "progress" | "detail">, { color: string; size: number }> = {
  miss: { color: "#bbb", size: 20 },
  same: { color: "#999", size: 14 },
  out: { color: "#999", size: 14 },
};

let enabled = false;
let frameQueue: JudgedPixel[] = [];
let lastMilestone = 0;
let frameId: number | null = null;
let committed = false;
let exitTimer: ReturnType<typeof setTimeout> | null = null;
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

const resetCycle = () => {
  streak = 0;
  pending = 0;
  progressCount = 0;
  missCount = 0;
  committed = false;
  scoredKeys.clear();
  progressImageKey = null;
  lastMilestone = 0;
  resetHudScore();
};

const syncHudVisibility = () => setHudVisible(paintModeActive);

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

/**
 * テンプレ完成度 (stats 側が塗るたびに楽観更新する)
 * 全タイルの stats が揃っている時だけ返す（一部だけだと % も COMPLETE 判定も嘘になる）
 */
const templateStats = (imageKey: string) => {
  const stats = perTileColorStats.get(imageKey);
  if (!stats) return null;
  const layer = overlayLayers.find((l) => l.imageKey === imageKey);
  if (layer?.affectedTileSet && stats.size < layer.affectedTileSet.size) return null;
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
  if (progressCount + missCount === 0) return;
  const points = Math.round(pending);
  const tier = TITLE_TIERS.find((t) => progressCount >= t.min) ?? null;

  // テンプレ完成度が取れた時だけ N% → M%（表示上の差が無ければ hud 側で省略）
  const after = progressImageKey ? templateStats(progressImageKey) : null;
  const complete = progressCount > 0 && !!after && after.matched >= after.total;
  showResultPanel({
    title: tier ? PARTY_RESULT_TITLES[tier.key] : null,
    titleHeight: tier?.height ?? 0,
    points,
    progress: after ? [progressBefore, after.matched / after.total] : null,
    complete,
  });

  if (complete) {
    confettiRain(200);
    screenFlash(0.5);
    playComplete();
    return;
  }
  // 演出の量は塗った量ではなく得点の平方根で（ベタ塗りで青天井にしない）
  const power = Math.sqrt(points);
  if (power >= 3) confettiRain(Math.min(Math.round(power * 6), 200));
  screenFlash(tier?.key === "perfect" ? 0.3 : 0.15);
  playFanfare(tier?.key === "perfect");
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

export const setPartyModeEnabled = (value: boolean, resultAssetUrls?: PartyResultAssetUrls) => {
  if (enabled === value) return;
  enabled = value;
  if (enabled) {
    prepareResultAssets(resultAssetUrls);
    setFxProjectorFactory(createProjector);
    unsubscribePaintMode = subscribePaintMode(handlePaintMode);
    return;
  }
  unsubscribePaintMode?.();
  unsubscribePaintMode = null;
  if (exitTimer) clearTimeout(exitTimer);
  exitTimer = null;
  frameQueue = [];
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  clearResultAssets();
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
  if (judged === "miss") {
    missCount++;
    // 連続ミスで何度も半減しないよう、進捗が挟まった後の最初のミスだけ
    if (streak > 0) pending = Math.floor(pending / 2);
    streak = 0;
  } else if (isGood(judged)) {
    captureProgressStart(coord);
    pending += judged === "detail" ? DETAIL_POINTS : 1;
    progressCount++;
    streak++;
  }

  const { color } = coord;
  frameQueue.push({
    wx: coord.tileX * TILE_SIZE + coord.pixelX,
    wy: coord.tileY * TILE_SIZE + coord.pixelY,
    judged,
    color: color ? `rgb(${color.r},${color.g},${color.b})` : "#ffd700",
  });
  if (frameId !== null) return;
  frameId = requestAnimationFrame(flushFrame);
};

/** 1 フレーム分の演出: 粒子は最新数件。成功 10px の節目を跨いだら +N、ミス系は最後のラベル */
const flushFrame = () => {
  frameId = null;
  const queue = frameQueue;
  frameQueue = [];
  if (!enabled || !queue.length) return;

  let lastGood: JudgedPixel | null = null;
  for (const p of queue) {
    if (isGood(p.judged)) lastGood = p;
  }
  for (const p of queue.slice(-BURSTS_PER_FRAME)) {
    if (p.judged === "miss") burstAt(p.wx, p.wy, "#777", 3, 0.6);
    else if (!isGood(p.judged)) burstAt(p.wx, p.wy, p.color, 2, 0.6);
    else burstAt(p.wx, p.wy, p.judged === "detail" ? "#7ff" : p.color, 5, 1.2);
  }

  if (lastGood) {
    const milestone = Math.floor(progressCount / COUNT_EVERY) * COUNT_EVERY;
    if (milestone > lastMilestone) {
      lastMilestone = milestone;
      textAt(lastGood.wx, lastGood.wy, `+${milestone}`, {
        size: 30 + Math.min(Math.log10(milestone) * 6, 18),
        color: "#ffd700",
        life: 55,
      });
    }
    playBlip(Math.min(progressCount / MAX_PITCH_PX, 1));
  } else {
    // lastGood が無い = このフレームは全部 miss/same/out
    const last = queue[queue.length - 1];
    const label = LABEL[last.judged as keyof typeof LABEL];
    textAt(last.wx, last.wy, last.judged.toUpperCase(), { ...label, life: 40 });
  }
  if (queue.some((p) => p.judged === "miss")) playMiss();

  updateHud(Math.round(pending));
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
