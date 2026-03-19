/**
 * Paint Guide Canvas Overlay
 *
 * GeoJSON/raster map layer の代わりに、map canvas 上に重ねた HTML canvas で
 * paint guide ドットを描画する。rAF ループで点滅アニメーションも実現。
 */

import { getMapInstanceFromWplace } from "../get-map-instance";
import { tilePixelToLatLng } from "@/utils/coordinate";

const CANVAS_ID = "mr-wplace-paint-guide-canvas";
const GUIDE_SYNC_DEBOUNCE_MS = 50;
const MAX_GUIDE_POINTS = 1500;

// mismatch: 黄色点滅、already: 水色（点滅なし）
const MISMATCH_COLOR = "#ffbf00";
const MISMATCH_STROKE = "#000000";
const ALREADY_COLOR = "#00d4ff";
const ALREADY_STROKE = "#002433";
const DOT_RADIUS = 3.5;
const STROKE_WIDTH = 1.2;
const BLINK_PERIOD_MS = 800;

interface PaintGuidePoint {
  lat: number;
  lng: number;
  kind: "mismatch" | "already";
}

const points = new Map<string, PaintGuidePoint>();
let guideActive = false;
let canvas: HTMLCanvasElement | null = null;
let rafId: number | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let mapListenersAttached = false;

const getGuidePointKey = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
): string => `${tileX},${tileY},${pixelX},${pixelY}`;

// ------- canvas lifecycle -------

const getMapCanvas = (): HTMLCanvasElement | null => {
  const map = getMapInstanceFromWplace() as any;
  return map?.getCanvas?.() ?? null;
};

const getOrCreateCanvas = (): HTMLCanvasElement | null => {
  if (canvas && canvas.isConnected) return canvas;

  const mapCanvas = getMapCanvas();
  if (!mapCanvas) return null;

  const parent = mapCanvas.parentElement;
  if (!parent) return null;

  const existing = parent.querySelector(`#${CANVAS_ID}`) as HTMLCanvasElement | null;
  if (existing) {
    canvas = existing;
    return canvas;
  }

  const c = document.createElement("canvas");
  c.id = CANVAS_ID;
  c.style.cssText =
    "position:absolute;top:0;left:0;pointer-events:none;z-index:10;";
  parent.appendChild(c);
  canvas = c;
  return canvas;
};

const syncCanvasSize = (c: HTMLCanvasElement): void => {
  const mapCanvas = getMapCanvas();
  if (!mapCanvas) return;
  const w = mapCanvas.offsetWidth;
  const h = mapCanvas.offsetHeight;
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
  }
};

const removeCanvas = (): void => {
  canvas?.remove();
  canvas = null;
};

// ------- rAF draw loop -------

const drawFrame = (timestamp: number): void => {
  const c = getOrCreateCanvas();
  if (!c) {
    rafId = requestAnimationFrame(drawFrame);
    return;
  }

  syncCanvasSize(c);
  const ctx = c.getContext("2d");
  if (!ctx) {
    rafId = requestAnimationFrame(drawFrame);
    return;
  }

  ctx.clearRect(0, 0, c.width, c.height);

  if (points.size === 0) {
    rafId = requestAnimationFrame(drawFrame);
    return;
  }

  const map = getMapInstanceFromWplace() as any;
  if (!map) {
    rafId = requestAnimationFrame(drawFrame);
    return;
  }

  // 点滅フェーズ: 0〜1 → mismatch の opacity に使う
  const blinkPhase = (timestamp % BLINK_PERIOD_MS) / BLINK_PERIOD_MS;
  // sin波で 0.35〜1.0 の範囲に収める（完全に消えるのを避ける）
  const blinkOpacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(blinkPhase * Math.PI * 2));

  ctx.save();
  for (const pt of points.values()) {
    const { x, y } = map.project([pt.lng, pt.lat]);

    // 画面外は描画スキップ
    if (x < -DOT_RADIUS || y < -DOT_RADIUS || x > c.width + DOT_RADIUS || y > c.height + DOT_RADIUS) continue;

    const isMismatch = pt.kind === "mismatch";
    ctx.globalAlpha = isMismatch ? blinkOpacity : 0.95;
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isMismatch ? MISMATCH_COLOR : ALREADY_COLOR;
    ctx.fill();
    ctx.lineWidth = STROKE_WIDTH;
    ctx.strokeStyle = isMismatch ? MISMATCH_STROKE : ALREADY_STROKE;
    ctx.stroke();
  }
  ctx.restore();

  rafId = requestAnimationFrame(drawFrame);
};

const startRaf = (): void => {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(drawFrame);
};

const stopRaf = (): void => {
  if (rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
};

// ------- map event listeners -------

const onMapResize = (): void => {
  // canvas size sync は drawFrame 内で自動的に行われる
};

const attachMapListeners = (): void => {
  if (mapListenersAttached) return;
  const map = getMapInstanceFromWplace() as any;
  if (!map) return;
  map.on("resize", onMapResize);
  mapListenersAttached = true;
};

const detachMapListeners = (): void => {
  if (!mapListenersAttached) return;
  const map = getMapInstanceFromWplace() as any;
  map?.off("resize", onMapResize);
  mapListenersAttached = false;
};

// ------- sync debounce (for clear operations) -------

const scheduleSyncCheck = (): void => {
  if (syncTimer !== null) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    // points が 0 になったとき rAF は継続しているが clear されるので問題ない
  }, GUIDE_SYNC_DEBOUNCE_MS);
};

// ------- public API -------

export const upsertPaintGuidePoint = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
  kind: "mismatch" | "already",
): void => {
  if (!guideActive) return;
  if (pixelX < 0 || pixelY < 0 || pixelX >= 1000 || pixelY >= 1000) return;

  const key = getGuidePointKey(tileX, tileY, pixelX, pixelY);
  const existing = points.get(key);
  if (existing && existing.kind === kind) return;

  const { lat, lng } = tilePixelToLatLng(tileX, tileY, pixelX + 0.5, pixelY + 0.5);
  points.set(key, { lat, lng, kind });

  if (points.size > MAX_GUIDE_POINTS) {
    const oldest = points.keys().next().value;
    if (oldest) points.delete(oldest);
  }
};

export const clearPaintGuidePoint = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
): void => {
  const key = getGuidePointKey(tileX, tileY, pixelX, pixelY);
  points.delete(key);
};

export const clearPaintGuidePointsTile = (tileX: number, tileY: number): void => {
  for (const [key, _] of points.entries()) {
    const [tx, ty] = key.split(",").map(Number);
    if (tx === tileX && ty === tileY) points.delete(key);
  }
};

export const clearAllPaintGuidePoints = (): void => {
  points.clear();
};

export const setPaintGuideActive = (
  active: boolean,
  options?: { clearNow?: boolean },
): void => {
  guideActive = active;
  if (active) {
    attachMapListeners();
    startRaf();
    return;
  }
  points.clear();
  if (options?.clearNow) {
    if (syncTimer !== null) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
  } else {
    scheduleSyncCheck();
  }
};

export const setupPaintGuideCanvas = (): void => {
  attachMapListeners();
  startRaf();
  console.log("🧑‍🎨 : Paint guide canvas setup complete");
};

export const destroyPaintGuideCanvas = (): void => {
  stopRaf();
  detachMapListeners();
  points.clear();
  guideActive = false;
  removeCanvas();
  if (syncTimer !== null) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
};
