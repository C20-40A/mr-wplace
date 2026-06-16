import {
  ART_CRUISE_VERSION,
  type ResolutionLevel,
  RESOLUTION_LABELS,
} from "../constants";
import { RIP_IMAGE_DATA_URL } from "../effects/rip-image";
import { getBossRecord } from "../boss-mode/storage";
import { FONT_STACK, formatScoreComma, formatTime } from "./format";
import { type CruiseRank, nextRankInfo, resolveRank } from "./rank";

const formatClearTime = (ms: number) => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
};

export const createModalButton = (label: string, primary: boolean) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.style.cssText = `
    min-width: 84px;
    height: 34px;
    border: 1px solid ${primary ? "rgba(244, 114, 182, 0.9)" : "rgba(103, 232, 249, 0.78)"};
    border-radius: 4px;
    background: ${
      primary
        ? "linear-gradient(180deg, rgba(190, 24, 93, 0.92), rgba(88, 28, 135, 0.92))"
        : "linear-gradient(180deg, rgba(8, 47, 73, 0.92), rgba(12, 74, 110, 0.86))"
    };
    color: #f0f9ff;
    box-shadow: inset 0 0 12px ${primary ? "rgba(244, 114, 182, 0.24)" : "rgba(34, 211, 238, 0.2)"};
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.9px;
    text-shadow: 0 0 8px rgba(224, 250, 255, 0.45);
    cursor: pointer;
  `;
  return btn;
};

type GameOverModalOptions = {
  score: number;
  survivalMs: number;
  level: number;
  /** フェード完了後に呼ばれる（ポーズ開始 + 操作受付） */
  onReady: () => void;
  onRetry: () => void;
  onExit: () => void;
};

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
};

const drawCanvasText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing = 0,
  align: CanvasTextAlign = "center",
) => {
  if (letterSpacing <= 0) {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    return;
  }

  const chars = Array.from(text);
  const textWidth =
    chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) +
    letterSpacing * Math.max(0, chars.length - 1);
  let cursor =
    align === "center"
      ? x - textWidth / 2
      : align === "right"
        ? x - textWidth
        : x;

  ctx.textAlign = "left";
  chars.forEach((char) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + letterSpacing;
  });
};

const createGameOverResultCanvas = (
  score: number,
  survivalMs: number,
  level: number,
  rank: CruiseRank,
) => {
  const canvas = document.createElement("canvas");
  const width = 304;
  const height = 184;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const next = nextRankInfo(score);
  const ctx = canvas.getContext("2d");

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.cssText = `
    display: block;
    width: 100%;
    max-width: ${width}px;
    height: auto;
    margin: 0 auto 18px;
  `;

  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(224, 250, 255, 0.6)";
  ctx.font = `900 11px ${FONT_STACK}`;
  drawCanvasText(ctx, "SCORE", width / 2, 13, 3);

  ctx.save();
  ctx.shadowColor = "rgba(34, 211, 238, 0.6)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#f0f9ff";
  ctx.font = `900 52px ${FONT_STACK}`;
  drawCanvasText(ctx, formatScoreComma(score), width / 2, 65, 1);
  ctx.restore();

  const badgeWidth = Math.min(250, 122 + rank.title.length * 8);
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 84;
  const badgeHeight = 56;
  roundRectPath(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 10);
  ctx.fillStyle = "rgba(2, 6, 23, 0.55)";
  ctx.fill();
  ctx.strokeStyle = rank.color;
  ctx.lineWidth = 1;
  ctx.shadowColor = rank.glow;
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.fillStyle = rank.color;
  ctx.shadowColor = rank.glow;
  ctx.shadowBlur = 16;
  ctx.font = `900 34px ${FONT_STACK}`;
  drawCanvasText(ctx, rank.badge, badgeX + 12, badgeY + 39, 1, "left");
  ctx.restore();

  const titleX = badgeX + 64;
  ctx.fillStyle = "rgba(224, 250, 255, 0.6)";
  ctx.font = `900 10px ${FONT_STACK}`;
  drawCanvasText(ctx, "RANK", titleX, badgeY + 20, 2, "left");

  ctx.save();
  ctx.fillStyle = rank.color;
  ctx.shadowColor = rank.glow;
  ctx.shadowBlur = 14;
  ctx.font = `900 18px ${FONT_STACK}`;
  drawCanvasText(ctx, rank.title, titleX, badgeY + 43, 1.5, "left");
  ctx.restore();

  ctx.fillStyle = "rgba(224, 250, 255, 0.78)";
  ctx.font = `900 13px ${FONT_STACK}`;
  drawCanvasText(
    ctx,
    `LV ${level}  TIME ${formatTime(survivalMs)}`,
    width / 2,
    158,
    1,
  );

  if (next === null) {
    ctx.fillStyle = rank.color;
    drawCanvasText(ctx, "★ MAX RANK ★", width / 2, 181, 1);
    return canvas;
  }

  const nextText = `NEXT ${next.rank.badge}  ${next.gap.toLocaleString("en-US")}`;
  ctx.fillStyle = "rgba(224, 250, 255, 0.78)";
  drawCanvasText(ctx, nextText, width / 2, 181, 1);

  return canvas;
};

/** ゲームオーバーモーダルを生成し、body に追加して返す */
export const createGameOverModal = (
  options: GameOverModalOptions,
): HTMLDivElement => {
  const { score, survivalMs, level, onReady, onRetry, onExit } = options;
  const FADE_SECONDS = 1.5;

  const rank = resolveRank(score);

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1004;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 50% 42%, ${rank.glow}, transparent 42%),
      rgba(2, 6, 23, 0.82);
    pointer-events: none;
    font-family: ${FONT_STACK};
    opacity: 0;
    transition: opacity ${FADE_SECONDS}s ease;
  `;
  // フェード完了後にポーズ & 操作受付開始
  setTimeout(() => {
    onReady();
    modal.style.pointerEvents = "auto";
  }, FADE_SECONDS * 1000);
  modal.addEventListener("pointerdown", (e) => {
    if (e.target !== modal) return;
    e.preventDefault();
    e.stopPropagation();
  });

  const panel = document.createElement("div");
  panel.style.cssText = `
    width: min(340px, calc(100vw - 32px));
    border: 1px solid ${rank.color};
    border-radius: 6px;
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98)),
      repeating-linear-gradient(0deg, transparent 0 5px, rgba(148, 163, 184, 0.08) 5px 6px);
    color: #e0faff;
    box-shadow:
      0 24px 70px rgba(0, 0, 0, 0.56),
      0 0 34px ${rank.glow},
      inset 0 0 24px rgba(2, 6, 23, 0.5);
    padding: 22px 18px;
    text-align: center;
  `;
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());

  const resultCanvas = createGameOverResultCanvas(
    score,
    survivalMs,
    level,
    rank,
  );

  const actions = document.createElement("div");
  actions.style.cssText = "display: flex; justify-content: center; gap: 10px;";

  const retryButton = createModalButton("RETRY", true);
  retryButton.addEventListener("click", onRetry);

  const exitButton = createModalButton("EXIT", false);
  exitButton.addEventListener("click", onExit);

  actions.append(retryButton, exitButton);
  const versionLabel = document.createElement("div");
  versionLabel.textContent = `v${ART_CRUISE_VERSION}`;
  versionLabel.style.cssText = `
    position: absolute;
    bottom: 8px;
    right: 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    color: rgba(224, 250, 255, 0.32);
    pointer-events: none;
  `;

  panel.append(resultCanvas, actions);
  modal.appendChild(panel);
  modal.appendChild(versionLabel);
  document.body.appendChild(modal);

  // フェードイン
  requestAnimationFrame(() => {
    modal.style.opacity = "1";
  });

  return modal;
};

type PauseModalOptions = {
  onResume: () => void;
  onExit: () => void;
  resolutionLevel: ResolutionLevel;
  onResolutionChange: (level: ResolutionLevel) => void;
};

const RESOLUTION_LEVEL_COUNT = 4;

/**
 * 4-step resolution slider for the pause menu.
 * Clicking the track or +/- buttons steps through LOW → MEDIUM → HIGH → NATIVE.
 */
const createResolutionSlider = (
  initial: ResolutionLevel,
  onChange: (level: ResolutionLevel) => void,
) => {
  let current = initial;

  const wrap = document.createElement("div");
  wrap.style.cssText = `
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid rgba(103, 232, 249, 0.5);
    border-radius: 5px;
    background: rgba(8, 47, 73, 0.5);
    color: #e0faff;
  `;

  const header = document.createElement("div");
  header.style.cssText =
    "display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;";

  const labelEl = document.createElement("div");
  labelEl.textContent = "RESOLUTION";
  labelEl.style.cssText = "font-size: 12px; font-weight: 900; letter-spacing: 1px;";

  const valueEl = document.createElement("div");
  valueEl.style.cssText =
    "font-size: 11px; font-weight: 900; letter-spacing: 0.8px; color: #67e8f9;";

  header.append(labelEl, valueEl);

  // Track with 4 pip segments
  const trackWrap = document.createElement("div");
  trackWrap.style.cssText =
    "display: flex; gap: 4px; align-items: center;";

  const pips: HTMLDivElement[] = [];
  for (let i = 0; i < RESOLUTION_LEVEL_COUNT; i++) {
    const pip = document.createElement("div");
    pip.style.cssText = `
      flex: 1;
      height: 6px;
      border-radius: 3px;
      cursor: pointer;
      transition: background 0.12s ease;
    `;
    pip.addEventListener("click", (e) => {
      e.stopPropagation();
      current = i as ResolutionLevel;
      applyStyle();
      onChange(current);
    });
    pips.push(pip);
    trackWrap.appendChild(pip);
  }

  wrap.append(header, trackWrap);

  const applyStyle = () => {
    valueEl.textContent = RESOLUTION_LABELS[current];
    for (let i = 0; i < RESOLUTION_LEVEL_COUNT; i++) {
      pips[i]!.style.background =
        i <= current ? "rgba(103, 232, 249, 0.85)" : "rgba(103, 232, 249, 0.18)";
    }
    wrap.style.borderColor =
      current === 0 ? "rgba(103, 232, 249, 0.5)" : "rgba(103, 232, 249, 0.8)";
  };

  applyStyle();
  return wrap;
};

/** ポーズ（EXIT 確認）モーダルを生成し、body に追加して返す */
export const createPauseModal = (
  options: PauseModalOptions,
): HTMLDivElement => {
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1004;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.22), transparent 38%),
      rgba(2, 6, 23, 0.72);
    pointer-events: auto;
    font-family: ${FONT_STACK};
  `;
  modal.addEventListener("pointerdown", (e) => {
    if (e.target !== modal) return;
    e.preventDefault();
    e.stopPropagation();
  });
  modal.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    { passive: false },
  );

  const panel = document.createElement("div");
  panel.style.cssText = `
    width: min(320px, calc(100vw - 32px));
    border: 1px solid rgba(103, 232, 249, 0.78);
    border-bottom-color: rgba(244, 114, 182, 0.78);
    border-radius: 6px;
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98)),
      repeating-linear-gradient(0deg, transparent 0 5px, rgba(103, 232, 249, 0.1) 5px 6px);
    color: #e0faff;
    box-shadow:
      0 24px 70px rgba(0, 0, 0, 0.56),
      0 0 30px rgba(34, 211, 238, 0.28),
      inset 0 0 24px rgba(14, 165, 233, 0.12);
    padding: 18px;
  `;
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());

  const title = document.createElement("div");
  title.textContent = "PAUSE";
  title.style.cssText = `
    color: #f0f9ff;
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 1.4px;
    margin-bottom: 8px;
    text-shadow: 0 0 12px rgba(34, 211, 238, 0.85);
  `;

  const actions = document.createElement("div");
  actions.style.cssText =
    "display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;";

  const cancelButton = createModalButton("RESUME", false);
  cancelButton.addEventListener("click", options.onResume);

  const exitButton = createModalButton("QUIT", true);
  exitButton.addEventListener("click", options.onExit);

  const resolutionSlider = createResolutionSlider(
    options.resolutionLevel,
    options.onResolutionChange,
  );

  actions.append(cancelButton, exitButton);
  panel.append(title, resolutionSlider, actions);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  return modal;
};

type BossClearModalOptions = {
  level: number;
  timeMs: number;
  /** フェード完了後に呼ばれる（ポーズ開始 + 操作受付） */
  onReady: () => void;
  onRetry: () => void;
  onExit: () => void;
};

/** BOSS 練習クリアモーダルを生成し、body に追加して返す */
export const createBossClearModal = (
  options: BossClearModalOptions,
): HTMLDivElement => {
  const { level, timeMs, onReady, onRetry, onExit } = options;
  const FADE_SECONDS = 1.2;
  const best = getBossRecord(level)?.bestTimeMs ?? timeMs;
  const isBest = timeMs <= best;

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1004;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 50% 42%, rgba(244, 114, 182, 0.26), transparent 42%),
      rgba(2, 6, 23, 0.82);
    pointer-events: none;
    font-family: ${FONT_STACK};
    opacity: 0;
    transition: opacity ${FADE_SECONDS}s ease;
  `;
  setTimeout(() => {
    onReady();
    modal.style.pointerEvents = "auto";
  }, FADE_SECONDS * 1000);
  modal.addEventListener("pointerdown", (e) => {
    if (e.target !== modal) return;
    e.preventDefault();
    e.stopPropagation();
  });

  const panel = document.createElement("div");
  panel.style.cssText = `
    width: min(320px, calc(100vw - 32px));
    border: 1px solid rgba(244, 114, 182, 0.9);
    border-radius: 6px;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98));
    color: #e0faff;
    box-shadow:
      0 24px 70px rgba(0, 0, 0, 0.56),
      0 0 34px rgba(244, 114, 182, 0.4),
      inset 0 0 24px rgba(14, 165, 233, 0.12);
    padding: 24px 18px 18px;
    text-align: center;
  `;
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());

  const ripIcon = document.createElement("img");
  ripIcon.src = RIP_IMAGE_DATA_URL;
  ripIcon.alt = "cleared";
  ripIcon.style.cssText = `
    width: 56px;
    height: 56px;
    image-rendering: pixelated;
    filter: drop-shadow(0 0 12px rgba(244, 114, 182, 0.8));
    margin-bottom: 8px;
  `;

  const heading = document.createElement("div");
  heading.textContent = "BOSS CLEAR";
  heading.style.cssText = `
    font-size: 22px;
    font-weight: 1000;
    letter-spacing: 2px;
    text-shadow: 0 0 12px rgba(244, 114, 182, 0.85);
    margin-bottom: 4px;
  `;

  const levelLabel = document.createElement("div");
  levelLabel.textContent = `BOSS LV.${level}`;
  levelLabel.style.cssText = `
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.5px;
    color: rgba(224, 250, 255, 0.7);
    margin-bottom: 14px;
  `;

  const timeLabel = document.createElement("div");
  timeLabel.style.cssText = `
    font-size: 34px;
    font-weight: 1000;
    letter-spacing: 1px;
    color: #f8fdff;
    text-shadow: 0 0 14px rgba(34, 211, 238, 0.7);
  `;
  timeLabel.textContent = formatClearTime(timeMs);

  const bestLabel = document.createElement("div");
  bestLabel.style.cssText = `
    margin: 6px 0 16px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    color: ${isBest ? "rgba(244, 114, 182, 0.95)" : "rgba(224, 250, 255, 0.7)"};
  `;
  bestLabel.textContent = isBest
    ? "★ NEW BEST ★"
    : `BEST ${formatClearTime(best)}`;

  const actions = document.createElement("div");
  actions.style.cssText = "display: flex; justify-content: center; gap: 8px;";

  const retryButton = createModalButton("RETRY", true);
  retryButton.addEventListener("click", onRetry);

  const exitButton = createModalButton("EXIT", false);
  exitButton.addEventListener("click", onExit);

  actions.append(retryButton, exitButton);
  panel.append(ripIcon, heading, levelLabel, timeLabel, bestLabel, actions);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.style.opacity = "1";
  });

  return modal;
};
