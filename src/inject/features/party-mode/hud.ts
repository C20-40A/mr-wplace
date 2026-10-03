/**
 * party mode の DOM 表示（背景なし・縁取り文字）
 * - 右上隅の数字: 今回のボーナス。値が増えるほど少しずつ大きくなり、加算のたびにぽよん
 * - リザルト: タイトル / +得点 / テンプレ完成度 N% → M% バーを 1 つの箱で出し、同時に消す
 */

import { PARTY_RESULT_TITLES } from "@/constants/party-mode";
import { getResultAsset } from "@/inject/features/party-mode/result-assets";

const HUD_ID = "mr-wplace-party-mode-hud";
const RESULT_ID = "mr-wplace-party-mode-result";
const OUTLINE = "-webkit-text-stroke:5px #000;paint-order:stroke fill;";
const RESULT_SHOW_MS = 3500;
const COMPLETE_SHOW_MS = 6000;

let hud: HTMLDivElement | null = null;
let scoreEl: HTMLDivElement | null = null;
let targetScore = 0;
let shownScore = 0;
let rafId: number | null = null;
let popTimer: ReturnType<typeof setTimeout> | null = null;
let resultTimer: ReturnType<typeof setTimeout> | null = null;

const ensureHud = () => {
  if (hud) return;
  hud = document.createElement("div");
  hud.id = HUD_ID;
  hud.style.cssText = `
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 8px);
    right: 10px;
    z-index: 2147482999;
    pointer-events: none;
    font-family: system-ui, sans-serif;
    font-weight: 900;
    line-height: 1;
  `;
  scoreEl = document.createElement("div");
  scoreEl.style.cssText = `${OUTLINE}color:#ffd700;font-variant-numeric:tabular-nums;transform-origin:right center;transition:transform 0.15s cubic-bezier(.3,1.8,.5,1),font-size 0.2s;`;
  hud.append(scoreEl);
  document.body.appendChild(hud);
};

// 0pt: 24px → 1000pt 付近で 44px 頭打ち
const scoreFontSize = (score: number) => 24 + Math.min(Math.log10(score + 1) * 7, 20);

const step = () => {
  rafId = null;
  if (!scoreEl) return;
  const diff = targetScore - shownScore;
  shownScore = Math.abs(diff) < 0.5 ? targetScore : shownScore + diff * 0.25;
  scoreEl.textContent = Math.round(shownScore).toLocaleString();
  if (shownScore !== targetScore) rafId = requestAnimationFrame(step);
};

export const updateHud = (score: number) => {
  ensureHud();
  if (score > targetScore) {
    scoreEl!.style.transform = "scale(1.3)";
    if (popTimer) clearTimeout(popTimer);
    popTimer = setTimeout(() => scoreEl && (scoreEl.style.transform = ""), 110);
  }
  targetScore = score;
  scoreEl!.style.fontSize = `${scoreFontSize(score)}px`;
  if (rafId === null) rafId = requestAnimationFrame(step);
};

export const setHudVisible = (visible: boolean) => {
  if (hud) hud.hidden = !visible;
};

/** 切り捨て（四捨五入だと 99.8% が 100% に見える）。1e-9 は 0.57*100=56.999.. 対策 */
const floorPercent = (ratio: number, digits: number) => {
  const scale = 10 ** digits;
  return (Math.floor(ratio * 100 * scale + 1e-9) / scale).toFixed(digits);
};

/** 表示上で差が出る最小の桁数 (0-2) で整形 */
const formatPair = (before: number, after: number): [string, string] | null => {
  for (let digits = 0; digits <= 2; digits++) {
    const a = floorPercent(before, digits);
    const b = floorPercent(after, digits);
    if (a !== b) return [`${a}%`, `${b}%`];
  }
  return null;
};

const createProgressBar = ([before, after]: [number, number]) => {
  const labels = formatPair(before, after);
  if (!labels) return null;
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:6px;";
  const text = document.createElement("div");
  text.style.cssText = `${OUTLINE}font-size:22px;color:#fff;`;
  text.textContent = `${labels[0]} → ${labels[1]}`;
  const bar = document.createElement("div");
  bar.style.cssText =
    "width:min(260px,70vw);height:14px;border:3px solid #000;border-radius:8px;background:rgb(0 0 0 / 0.4);overflow:hidden;";
  const fill = document.createElement("div");
  fill.style.cssText = `height:100%;width:${before * 100}%;background:linear-gradient(90deg,#ffb300,#ffe600 70%,#fff);transition:width 1.2s cubic-bezier(.2,1.2,.4,1) 0.3s;`;
  bar.appendChild(fill);
  wrap.append(text, bar);
  return { wrap, start: () => (fill.style.width = `${Math.min(after, 1) * 100}%`), fill };
};

const createTitle = (title: string, height: number) => {
  const el = document.createElement("div");
  const image = getResultAsset(title);
  if (image) {
    image.style.cssText = `display:block;height:${height}px;width:auto;max-width:88vw;object-fit:contain;`;
    el.replaceChildren(image);
    return el;
  }
  // 画像が準備中/失敗の時は縁取り文字（高さに合わせた大きさ）
  el.style.cssText = `${OUTLINE}font-size:${Math.round(height * 0.55)}px;color:#fff;`;
  el.textContent = title;
  return el;
};

const createCompleteTitle = () => {
  const el = document.createElement("div");
  const image = getResultAsset(PARTY_RESULT_TITLES.complete);
  if (image) {
    image.style.cssText = "display:block;height:132px;width:auto;max-width:92vw;object-fit:contain;filter:drop-shadow(0 0 12px #ffe600);";
    el.replaceChildren(image);
    return el;
  }
  el.style.cssText = `${OUTLINE}font-size:clamp(40px,13vw,72px);color:#ffd700;letter-spacing:0.02em;filter:drop-shadow(0 0 12px #ffe600);`;
  el.textContent = "COMPLETE!!";
  return el;
};

/** リザルト。progress は取得できない/差が表示できない時は省略 */
export const showResultPanel = ({
  title,
  titleHeight,
  points,
  progress,
  complete,
}: {
  /** null = タイトル無し（成功 px が少ない時） */
  title: string | null;
  /** タイトル画像の高さ。画像ごとの縦横比に依らず格が揃う */
  titleHeight: number;
  points: number;
  progress: [number, number] | null;
  /** テンプレ完成。COMPLETE を足して長めに出す */
  complete: boolean;
}) => {
  document.getElementById(RESULT_ID)?.remove();
  if (resultTimer) clearTimeout(resultTimer);

  const box = document.createElement("div");
  box.id = RESULT_ID;
  box.style.cssText = `
    position: fixed;
    left: 50%;
    top: max(56px, 12vh);
    transform: translateX(-50%);
    z-index: 2147482999;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: system-ui, sans-serif;
    font-weight: 900;
    line-height: 1.1;
    transition: opacity 0.4s;
  `;
  const completeEl = complete ? createCompleteTitle() : null;
  if (completeEl) box.appendChild(completeEl);
  if (title) box.appendChild(createTitle(title, titleHeight));
  const pointsEl = document.createElement("div");
  pointsEl.style.cssText = `${OUTLINE}font-size:40px;color:#ffd700;`;
  pointsEl.textContent = `+${points.toLocaleString()}`;
  box.appendChild(pointsEl);

  const bar = progress ? createProgressBar(progress) : null;
  if (bar) box.appendChild(bar.wrap);
  document.body.appendChild(box);
  box.animate([
    { transform: "translateX(-50%) scale(0.65)", opacity: 0 },
    { transform: "translateX(-50%) scale(1.12)", opacity: 1, offset: 0.65 },
    { transform: "translateX(-50%) scale(1)", opacity: 1 },
  ], { duration: 380, easing: "ease-out" });
  // 完成時は COMPLETE だけ鼓動させ続ける（box ごと消えるので後始末不要）
  completeEl?.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.1)" }],
    { duration: 420, iterations: Infinity, direction: "alternate", easing: "ease-in-out" },
  );
  if (bar) {
    void bar.fill.offsetWidth; // 初期幅を確定させてから伸ばす（transition を確実に効かせる）
    bar.start();
  }

  resultTimer = setTimeout(() => {
    box.style.opacity = "0";
    resultTimer = setTimeout(() => box.remove(), 400);
  }, complete ? COMPLETE_SHOW_MS : RESULT_SHOW_MS);
};

/** 確定/キャンセルで保留がリセットされた時。カウントダウンさせず即 0 */
export const resetHudScore = () => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  targetScore = shownScore = 0;
  if (!scoreEl) return;
  scoreEl.textContent = "0";
  scoreEl.style.fontSize = `${scoreFontSize(0)}px`;
};

export const destroyHud = () => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  if (popTimer) clearTimeout(popTimer);
  if (resultTimer) clearTimeout(resultTimer);
  rafId = popTimer = resultTimer = null;
  hud?.remove();
  document.getElementById(RESULT_ID)?.remove();
  hud = scoreEl = null;
  targetScore = shownScore = 0;
};
