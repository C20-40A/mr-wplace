import { getMapInstanceFromWplace } from "@/inject/features/map-instance";
import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { latLonToPixels } from "@/utils/geo-converter";
import { colorpalette, TRANSPARENT_COLOR_ID } from "@/constants/colors";
import { getDraftTileCanvas, getDraftTileKeys } from "./draft-store";

/**
 * Draft canvas layer
 *
 * wplace 本体のペイント機構には一切依存せず、map canvas の上に重ねた
 * 独自 canvas だけで下書きを描画/編集する。
 *
 * 設計上の要点:
 * - タイル 1 枚 = 1000x1000 のオフスクリーン canvas (wplace のラスタタイルのクローン)。
 *   描画は「タイル四隅を map.project() して drawImage で1枚貼る」だけなので、
 *   ピクセル数に関係なく 1 タイル 1 drawImage で済む (100万回 project は不可能)。
 * - pointer は capture 段階で止め、wplace 側へは伝播させない。
 * - 再描画は dirty 時のみ。map 移動中は move イベントで dirty を立てる。
 */

const CANVAS_ID = "mr-wplace-draft-canvas";
const TILE_SIZE = TILE_DRAW_CONSTANTS.TILE_SIZE;

type PaintHandler = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
  color: { r: number; g: number; b: number },
) => void;
type EraseHandler = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
) => void;

let canvas: HTMLCanvasElement | null = null;
let active = false;
let rafId: number | null = null;
let dirty = true;
let mapListenersAttached = false;
let eraseMode = false;

let onPaint: PaintHandler | null = null;
let onErase: EraseHandler | null = null;

/** ドラッグ中の連続描画用。直前に塗った world pixel (線形補間の起点) */
let drawing = false;
let lastWorld: { x: number; y: number } | null = null;

const paletteById = new Map(colorpalette.map((c) => [c.id, c.rgb]));

/** 現在パレットで選択中の色。未選択/透明色なら null (= 描けない) */
const getSelectedColor = (): { r: number; g: number; b: number } | null => {
  const raw = localStorage.getItem("selected-color");
  if (raw === null) return null;
  const id = Number(raw);
  if (id === TRANSPARENT_COLOR_ID) return null;
  const rgb = paletteById.get(id);
  if (!rgb) return null;
  return { r: rgb[0], g: rgb[1], b: rgb[2] };
};

export const markDraftCanvasDirty = (): void => {
  dirty = true;
};

export const setDraftEraseMode = (enabled: boolean): void => {
  eraseMode = enabled;
};

export const isDraftEraseMode = (): boolean => eraseMode;

// ------- canvas lifecycle -------

const getMapCanvas = (): HTMLCanvasElement | null => {
  const map = getMapInstanceFromWplace() as any;
  return map?.getCanvas?.() ?? null;
};

const getOrCreateCanvas = (): HTMLCanvasElement | null => {
  if (canvas?.isConnected) return canvas;

  const mapCanvas = getMapCanvas();
  const parent = mapCanvas?.parentElement;
  if (!parent) return null;

  const existing = parent.querySelector<HTMLCanvasElement>(`#${CANVAS_ID}`);
  if (existing) {
    canvas = existing;
    return canvas;
  }

  const c = document.createElement("canvas");
  c.id = CANVAS_ID;
  c.style.cssText =
    "position:absolute;top:0;left:0;pointer-events:auto;touch-action:none;cursor:crosshair;z-index:11;";
  attachPointerHandlers(c);
  parent.appendChild(c);
  canvas = c;
  return canvas;
};

const syncCanvasSize = (c: HTMLCanvasElement): void => {
  const mapCanvas = getMapCanvas();
  if (!mapCanvas) return;
  const w = mapCanvas.offsetWidth;
  const h = mapCanvas.offsetHeight;
  if (c.width === w && c.height === h) return;
  c.width = w;
  c.height = h;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  dirty = true;
};

// ------- coordinate helpers -------

/** 画面座標 -> world pixel (z11 全体を 1 枚の巨大画像として扱った座標) */
const screenToWorldPixel = (
  clientX: number,
  clientY: number,
): { x: number; y: number } | null => {
  const map = getMapInstanceFromWplace() as any;
  const c = canvas;
  if (!map?.unproject || !c) return null;

  const rect = c.getBoundingClientRect();
  const lngLat = map.unproject([clientX - rect.left, clientY - rect.top]);
  if (!lngLat) return null;

  const [x, y] = latLonToPixels(lngLat.lat, lngLat.lng);
  return { x: Math.floor(x), y: Math.floor(y) };
};

// ------- painting -------

const paintWorldPixel = (worldX: number, worldY: number): void => {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  const pixelX = worldX - tileX * TILE_SIZE;
  const pixelY = worldY - tileY * TILE_SIZE;

  if (eraseMode) {
    onErase?.(tileX, tileY, pixelX, pixelY);
    return;
  }

  const color = getSelectedColor();
  if (!color) return;
  onPaint?.(tileX, tileY, pixelX, pixelY, color);
};

/**
 * 前回位置から今回位置まで線形補間して塗る。
 * pointermove は飛び飛びに来るため、これが無いとドラッグが点線になる。
 */
const paintLine = (from: { x: number; y: number } | null, to: {
  x: number;
  y: number;
}): void => {
  if (!from) {
    paintWorldPixel(to.x, to.y);
    return;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) {
    paintWorldPixel(to.x, to.y);
    return;
  }

  for (let i = 1; i <= steps; i++) {
    paintWorldPixel(
      Math.round(from.x + (dx * i) / steps),
      Math.round(from.y + (dy * i) / steps),
    );
  }
};

// ------- pointer handling -------

/**
 * NOTE: capture 段階で stopPropagation + preventDefault する。
 * 独自 canvas は map canvas の兄弟要素なので伝播経路上は競合しないが、
 * maplibre は document/window にも drag ハンドラを張るため、
 * ここで止めないとペイント中に地図がパン/ズームしてしまう。
 */
const stop = (e: Event): void => {
  e.stopPropagation();
  e.preventDefault();
};

const handlePointerDown = (e: PointerEvent): void => {
  if (!active) return;
  stop(e);
  // 中クリック/右クリックは描画に使わない (誤操作防止)
  if (e.button !== 0) return;

  canvas?.setPointerCapture(e.pointerId);
  drawing = true;
  lastWorld = screenToWorldPixel(e.clientX, e.clientY);
  if (lastWorld) paintWorldPixel(lastWorld.x, lastWorld.y);
};

const handlePointerMove = (e: PointerEvent): void => {
  if (!active) return;
  if (!drawing) return;
  stop(e);

  const world = screenToWorldPixel(e.clientX, e.clientY);
  if (!world) return;
  paintLine(lastWorld, world);
  lastWorld = world;
};

const handlePointerUp = (e: PointerEvent): void => {
  if (!active) return;
  stop(e);
  drawing = false;
  lastWorld = null;
  if (canvas?.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
};

const attachPointerHandlers = (c: HTMLCanvasElement): void => {
  c.addEventListener("pointerdown", handlePointerDown, { capture: true });
  c.addEventListener("pointermove", handlePointerMove, { capture: true });
  c.addEventListener("pointerup", handlePointerUp, { capture: true });
  c.addEventListener("pointercancel", handlePointerUp, { capture: true });
  // マップのズーム/コンテキストメニューを封じる
  c.addEventListener("wheel", stop, { capture: true, passive: false });
  c.addEventListener("contextmenu", stop, { capture: true });
  c.addEventListener("dblclick", stop, { capture: true });
};

// ------- render loop -------

const renderFrame = (): void => {
  rafId = requestAnimationFrame(renderFrame);
  if (!active) return;

  const c = getOrCreateCanvas();
  if (!c) return;
  syncCanvasSize(c);
  if (!dirty) return;

  const ctx = c.getContext("2d");
  const map = getMapInstanceFromWplace() as any;
  if (!ctx || !map?.project) return;

  dirty = false;
  ctx.clearRect(0, 0, c.width, c.height);
  // ピクセルアートなので拡大時もにじませない
  ctx.imageSmoothingEnabled = false;

  for (const tileKey of getDraftTileKeys()) {
    const tileCanvas = getDraftTileCanvas(tileKey);
    if (!tileCanvas) continue;

    const [tileX, tileY] = tileKey.split(",").map(Number);

    // タイルの左上/右下だけを投影する (= 1タイルにつき2回の project)
    const tl = tilePixelToLatLng(tileX, tileY, 0, 0);
    const br = tilePixelToLatLng(tileX, tileY, TILE_SIZE, TILE_SIZE);
    const p0 = map.project([tl.lng, tl.lat]);
    const p1 = map.project([br.lng, br.lat]);

    const w = p1.x - p0.x;
    const h = p1.y - p0.y;
    if (w <= 0 || h <= 0) continue;
    // 画面外タイルは貼らない
    if (p1.x < 0 || p1.y < 0 || p0.x > c.width || p0.y > c.height) continue;

    ctx.drawImage(tileCanvas, p0.x, p0.y, w, h);
  }
};

// ------- map listeners -------

const onMapChanged = (): void => {
  dirty = true;
};

const attachMapListeners = (): void => {
  if (mapListenersAttached) return;
  const map = getMapInstanceFromWplace() as any;
  if (!map?.on) return;
  map.on("move", onMapChanged);
  map.on("zoom", onMapChanged);
  map.on("resize", onMapChanged);
  mapListenersAttached = true;
};

const detachMapListeners = (): void => {
  if (!mapListenersAttached) return;
  const map = getMapInstanceFromWplace() as any;
  map?.off?.("move", onMapChanged);
  map?.off?.("zoom", onMapChanged);
  map?.off?.("resize", onMapChanged);
  mapListenersAttached = false;
};

// ------- public API -------

export const setDraftCanvasHandlers = (handlers: {
  onPaint: PaintHandler;
  onErase: EraseHandler;
}): void => {
  onPaint = handlers.onPaint;
  onErase = handlers.onErase;
};

export const setDraftCanvasActive = (enabled: boolean): void => {
  if (active === enabled) return;
  active = enabled;
  dirty = true;
  drawing = false;
  lastWorld = null;

  if (enabled) {
    attachMapListeners();
    getOrCreateCanvas();
    if (rafId === null) rafId = requestAnimationFrame(renderFrame);
    return;
  }

  eraseMode = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  detachMapListeners();
  canvas?.remove();
  canvas = null;
};
