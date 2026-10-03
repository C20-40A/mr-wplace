/**
 * party mode の DOM 表示（背景なし・縁取り文字）
 * - 右上隅の数字: 今回のボーナス。値が増えるほど少しずつ大きくなり、加算のたびにぽよん
 * - リザルトの進捗バー: テンプレ完成度 N% → M% を伸ばして見せる
 */

const HUD_ID = "mr-wplace-party-mode-hud";
const PROGRESS_ID = "mr-wplace-party-mode-progress";
const OUTLINE = "-webkit-text-stroke:5px #000;paint-order:stroke fill;";
const PROGRESS_SHOW_MS = 3500;

let hud: HTMLDivElement | null = null;
let scoreEl: HTMLDivElement | null = null;
let multEl: HTMLSpanElement | null = null;
let targetScore = 0;
let shownScore = 0;
let rafId: number | null = null;
let popTimer: ReturnType<typeof setTimeout> | null = null;
let progressTimer: ReturnType<typeof setTimeout> | null = null;

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
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-family: system-ui, sans-serif;
    font-weight: 900;
    line-height: 1;
  `;
  multEl = document.createElement("span");
  multEl.style.cssText = `${OUTLINE}font-size:16px;color:#7ff;`;
  scoreEl = document.createElement("div");
  scoreEl.style.cssText = `${OUTLINE}color:#ffd700;font-variant-numeric:tabular-nums;transform-origin:right center;transition:transform 0.15s cubic-bezier(.3,1.8,.5,1),font-size 0.2s;`;
  hud.append(multEl, scoreEl);
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

export const updateHud = (score: number, multiplier: number) => {
  ensureHud();
  if (score > targetScore) {
    scoreEl!.style.transform = "scale(1.3)";
    if (popTimer) clearTimeout(popTimer);
    popTimer = setTimeout(() => scoreEl && (scoreEl.style.transform = ""), 110);
  }
  targetScore = score;
  scoreEl!.style.fontSize = `${scoreFontSize(score)}px`;
  multEl!.textContent = multiplier > 1 ? `×${multiplier}` : "";
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

/** リザルト: テンプレ完成度 before → after のバー。差が表示できなければ出さない */
export const showProgressResult = (before: number, after: number, offsetY: number) => {
  const labels = formatPair(before, after);
  if (!labels) return;
  document.getElementById(PROGRESS_ID)?.remove();
  if (progressTimer) clearTimeout(progressTimer);

  const box = document.createElement("div");
  box.id = PROGRESS_ID;
  box.style.cssText = `
    position: fixed;
    left: 50%;
    top: ${offsetY}px;
    transform: translateX(-50%);
    z-index: 2147482999;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-family: system-ui, sans-serif;
    font-weight: 900;
    transition: opacity 0.4s;
  `;
  const text = document.createElement("div");
  text.style.cssText = `${OUTLINE}font-size:22px;color:#fff;`;
  text.textContent = `${labels[0]} → ${labels[1]}`;
  const bar = document.createElement("div");
  bar.style.cssText =
    "width:min(260px,70vw);height:14px;border:3px solid #000;border-radius:8px;background:rgb(0 0 0 / 0.4);overflow:hidden;";
  const fill = document.createElement("div");
  fill.style.cssText = `height:100%;width:${before * 100}%;background:linear-gradient(90deg,#ffb300,#ffe600 70%,#fff);transition:width 1.2s cubic-bezier(.2,1.2,.4,1) 0.3s;`;
  bar.appendChild(fill);
  box.append(text, bar);
  document.body.appendChild(box);

  void fill.offsetWidth; // 初期幅を確定させてから伸ばす（transition を確実に効かせる）
  fill.style.width = `${Math.min(after, 1) * 100}%`;
  progressTimer = setTimeout(() => {
    box.style.opacity = "0";
    progressTimer = setTimeout(() => box.remove(), 400);
  }, PROGRESS_SHOW_MS);
};

export const destroyHud = () => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  if (popTimer) clearTimeout(popTimer);
  if (progressTimer) clearTimeout(progressTimer);
  rafId = popTimer = progressTimer = null;
  hud?.remove();
  document.getElementById(PROGRESS_ID)?.remove();
  hud = scoreEl = multEl = null;
  targetScore = shownScore = 0;
};
