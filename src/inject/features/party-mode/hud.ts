/**
 * party mode の DOM 表示（背景なし・縁取り文字）
 * - 右上隅の数字: 今回のボーナス。値が増えるほど少しずつ大きくなり、加算のたびにぽよん
 * - リザルト: タイトル / +得点 / テンプレ完成度 N% → M% バーを 1 つの箱で出し、同時に消す
 */

import { getResultAsset } from "@/inject/features/party-mode/result-assets";

const HUD_ID = "mr-wplace-party-mode-hud";
const RESULT_ID = "mr-wplace-party-mode-result";
const OUTLINE = "-webkit-text-stroke:5px #000;paint-order:stroke fill;";
const RESULT_SHOW_MS = 3500;

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

/** 表示上で差が出る最小の桁数 (0-2) で整形 */
const formatPair = (before: number, after: number): [string, string] | null => {
  for (let digits = 0; digits <= 2; digits++) {
    const a = (before * 100).toFixed(digits);
    const b = (after * 100).toFixed(digits);
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

/** リザルト。progress は取得できない/差が表示できない時は省略 */
export const showResultPanel = ({
  title,
  points,
  progress,
}: {
  title: string;
  points: number;
  progress: [number, number] | null;
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
  const titleEl = document.createElement("div");
  titleEl.style.cssText = `${OUTLINE}font-size:48px;color:#fff;`;
  titleEl.textContent = title;
  const image = getResultAsset(title);
  if (image) {
    image.style.cssText = "display:block;width:min(400px,88vw);height:auto;";
    titleEl.style.cssText = "";
    titleEl.replaceChildren(image);
  }
  const pointsEl = document.createElement("div");
  pointsEl.style.cssText = `${OUTLINE}font-size:40px;color:#ffd700;`;
  pointsEl.textContent = `+${points.toLocaleString()}`;
  box.append(titleEl, pointsEl);

  const bar = progress ? createProgressBar(progress) : null;
  if (bar) box.appendChild(bar.wrap);
  document.body.appendChild(box);
  box.animate([
    { transform: "translateX(-50%) scale(0.65)", opacity: 0 },
    { transform: "translateX(-50%) scale(1.12)", opacity: 1, offset: 0.65 },
    { transform: "translateX(-50%) scale(1)", opacity: 1 },
  ], { duration: 380, easing: "ease-out" });
  if (bar) {
    void bar.fill.offsetWidth; // 初期幅を確定させてから伸ばす（transition を確実に効かせる）
    bar.start();
  }

  resultTimer = setTimeout(() => {
    box.style.opacity = "0";
    resultTimer = setTimeout(() => box.remove(), 400);
  }, RESULT_SHOW_MS);
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
