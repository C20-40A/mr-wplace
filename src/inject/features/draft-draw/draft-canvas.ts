import { getMapInstanceFromWplace } from "@/inject/features/map-instance";
import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { latLonToPixels } from "@/utils/geo-converter";
import { colorpalette, TRANSPARENT_COLOR_ID } from "@/constants/colors";
import { findNearestColorId } from "@/utils/color-quantize";
import {
  getDraftPixel,
  getDraftTileCanvas,
  getDraftTileKeys,
} from "./draft-store";
import { computeBucketFill } from "./draft-bucket-fill";

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
 * - 再描画は dirty 時のみ。map 移動中は move イベントで dirty を立てる。
 *
 * 操作体系:
 * - 左クリック単発      : dot を1つ置く
 * - 左ドラッグ          : マップを平行移動 (map へ委譲)
 * - Space 押下中に移動  : 連続 dotting (**クリック不要**。押しっぱなしでなぞるだけ)
 * - 中クリック          : spoit (その座標の色を拾って選択色にする)
 * - 右ドラッグ          : 消しゴム
 * - ホイール            : マップのズーム (map へ委譲)
 *
 * イベント方針 (重要):
 * 描画 canvas 自体は `pointer-events:none` の**表示専用**にする。
 * canvas を pointer-events:auto にすると map canvas の手前で全イベントを
 * 奪ってしまい、maplibre 純正の pan/zoom が完全に死ぬため。
 * 代わりに入力は **map の canvas container** で capture して、
 * 「自分が使う操作だけ」を stopPropagation で奪い、pan/zoom は素通りさせる。
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
/** ツールバーの消しゴムトグル (右ドラッグとは独立) */
let eraseMode = false;
/** ツールバーのバケツトグル。ON の間はクリックで flood fill */
let bucketMode = false;
/** Space 押下中か。押している間だけ左ドラッグが連続描画になる */
let spaceHeld = false;

let onPaint: PaintHandler | null = null;
let onErase: EraseHandler | null = null;

/** 現在のドラッグ操作の種類。null = 何もしていない (= map へ委譲中) */
type DragMode = "draw" | "erase";
let dragMode: DragMode | null = null;
/** 直前に塗った world pixel (線形補間の起点) */
let lastWorld: { x: number; y: number } | null = null;
/**
 * 最後に観測したポインタ位置。Space を押した瞬間に
 * 「今カーソルがある場所」から塗り始めるために保持する。
 */
let lastPointer: { x: number; y: number } | null = null;
/** pan と単発クリックを区別するための押下位置 */
let pendingClick: { x: number; y: number } | null = null;
/** この距離以内で離したら「クリック」扱い (手ブレ許容) */
const CLICK_SLOP = 3;

/** spoit で色が変わったことを content 側へ伝える */
let onColorPicked: ((colorId: number) => void) | null = null;
/** バケツが上限超過で中止されたことを content 側へ伝える (ヒント表示用) */
let onBucketFailed: (() => void) | null = null;

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
  if (enabled) bucketMode = false;
  updateCursor();
};

export const isDraftEraseMode = (): boolean => eraseMode;

export const setDraftBucketMode = (enabled: boolean): void => {
  bucketMode = enabled;
  if (enabled) eraseMode = false;
  updateCursor();
};

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
  // 表示専用。入力は map の canvas container 側で拾う (冒頭コメント参照)
  c.style.cssText =
    "position:absolute;top:0;left:0;pointer-events:none;z-index:11;";
  parent.appendChild(c);
  canvas = c;
  return canvas;
};

/** 入力を拾う対象。map canvas container (無ければ map canvas の親) */
const getInputTarget = (): HTMLElement | null => {
  const map = getMapInstanceFromWplace() as any;
  return map?.getCanvasContainer?.() ?? getMapCanvas()?.parentElement ?? null;
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
  const mapCanvas = getMapCanvas();
  if (!map?.unproject || !mapCanvas) return null;

  const rect = mapCanvas.getBoundingClientRect();
  const lngLat = map.unproject([clientX - rect.left, clientY - rect.top]);
  if (!lngLat) return null;

  const [x, y] = latLonToPixels(lngLat.lat, lngLat.lng);
  return { x: Math.floor(x), y: Math.floor(y) };
};

// ------- painting -------

const paintWorldPixel = (
  worldX: number,
  worldY: number,
  mode: DragMode,
): void => {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  const pixelX = worldX - tileX * TILE_SIZE;
  const pixelY = worldY - tileY * TILE_SIZE;

  if (mode === "erase") {
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
const paintLine = (
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  mode: DragMode,
): void => {
  if (!from) {
    paintWorldPixel(to.x, to.y, mode);
    return;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) {
    paintWorldPixel(to.x, to.y, mode);
    return;
  }

  for (let i = 1; i <= steps; i++) {
    paintWorldPixel(
      Math.round(from.x + (dx * i) / steps),
      Math.round(from.y + (dy * i) / steps),
      mode,
    );
  }
};

/**
 * バケツ塗り。上限を超える (= 開いた領域を塗ろうとした) 場合は
 * 1px も塗らず、content 側へヒント表示を促す。
 */
const bucketFillAt = (clientX: number, clientY: number): void => {
  const world = screenToWorldPixel(clientX, clientY);
  if (!world) return;

  const color = getSelectedColor();
  if (!color) return;

  const result = computeBucketFill(world.x, world.y, color);
  if (!result.ok) {
    onBucketFailed?.();
    return;
  }

  for (const p of result.pixels) {
    const tileX = Math.floor(p.x / TILE_SIZE);
    const tileY = Math.floor(p.y / TILE_SIZE);
    onPaint?.(
      tileX,
      tileY,
      p.x - tileX * TILE_SIZE,
      p.y - tileY * TILE_SIZE,
      color,
    );
  }
};

/** spoit: その座標の下書き色を拾って選択色にする */
const pickColorAt = (clientX: number, clientY: number): void => {
  const world = screenToWorldPixel(clientX, clientY);
  if (!world) return;

  const tileX = Math.floor(world.x / TILE_SIZE);
  const tileY = Math.floor(world.y / TILE_SIZE);
  const pixel = getDraftPixel(
    tileX,
    tileY,
    world.x - tileX * TILE_SIZE,
    world.y - tileY * TILE_SIZE,
  );
  if (!pixel) return;

  const id = findNearestColorId({ r: pixel.r, g: pixel.g, b: pixel.b });
  localStorage.setItem("selected-color", String(id));
  onColorPicked?.(id);
};

// ------- pointer handling -------

const stop = (e: Event): void => {
  e.stopPropagation();
  e.preventDefault();
};

/**
 * 押下時に操作の種類を決める。
 * - 右ボタン、またはツールバーの消しゴムON → erase
 * - それ以外の左ボタン → まだ確定しない (単発クリックなら dot、
 *   動かしたら map の pan。pointerdown を止めないので map が pan を担当する)
 *
 * NOTE: Space 押下中の描画はここでは扱わない。ボタンを一切押さずに
 * なぞるだけで塗る仕様なので、pointermove 側 (spaceHeld) が担当する。
 */
const resolveDragMode = (e: PointerEvent): DragMode | null => {
  if (e.button === 2) return "erase";
  if (e.button !== 0) return null;
  if (eraseMode) return "erase";
  return null;
};

const handlePointerDown = (e: PointerEvent): void => {
  if (!active) return;

  // 中クリックは spoit。map へは渡さない
  if (e.button === 1) {
    stop(e);
    pickColorAt(e.clientX, e.clientY);
    return;
  }

  // Space 中は「なぞって塗る」モード。ここで pan させると塗りながら地図が
  // 動いてしまうので、左押下は map へ渡さず塗りとして扱う
  if (spaceHeld && e.button === 0) {
    stop(e);
    const world = screenToWorldPixel(e.clientX, e.clientY);
    if (world) {
      paintLine(lastWorld, world, eraseMode ? "erase" : "draw");
      lastWorld = world;
    }
    return;
  }

  const mode = resolveDragMode(e);
  if (!mode) {
    // pan させたいので **止めない**。ただし単発クリック時に dot を打てるよう
    // 押下位置だけ覚えておく (pointerup で移動量を見て判定する)
    pendingClick = { x: e.clientX, y: e.clientY };
    return;
  }

  stop(e);
  dragMode = mode;
  pendingClick = null;
  inputTarget?.setPointerCapture(e.pointerId);
  lastWorld = screenToWorldPixel(e.clientX, e.clientY);
  if (lastWorld) paintWorldPixel(lastWorld.x, lastWorld.y, mode);
};

const handlePointerMove = (e: PointerEvent): void => {
  if (!active) return;
  lastPointer = { x: e.clientX, y: e.clientY };

  // Space 押下中はボタン不要でなぞるだけで塗る。
  // 消しゴムONなら Space なぞりも消しゴムとして働く。
  const mode: DragMode | null =
    dragMode ?? (spaceHeld ? (eraseMode ? "erase" : "draw") : null);
  if (!mode) return;
  stop(e);

  const world = screenToWorldPixel(e.clientX, e.clientY);
  if (!world) return;
  paintLine(lastWorld, world, mode);
  lastWorld = world;
};

const handlePointerUp = (e: PointerEvent): void => {
  if (!active) return;

  // ドラッグせずに離した左クリック = dot を1つ置く
  if (!dragMode && pendingClick && e.button === 0) {
    const moved =
      Math.abs(e.clientX - pendingClick.x) > CLICK_SLOP ||
      Math.abs(e.clientY - pendingClick.y) > CLICK_SLOP;
    pendingClick = null;
    if (!moved) {
      stop(e);
      if (bucketMode) {
        bucketFillAt(e.clientX, e.clientY);
        return;
      }
      const world = screenToWorldPixel(e.clientX, e.clientY);
      if (world) paintWorldPixel(world.x, world.y, eraseMode ? "erase" : "draw");
    }
    return;
  }

  if (!dragMode) return;

  stop(e);
  dragMode = null;
  lastWorld = null;
  if (inputTarget?.hasPointerCapture(e.pointerId))
    inputTarget.releasePointerCapture(e.pointerId);
};

/**
 * wplace のマップクリック popup を抑止する。
 * pointerdown は pan のために通しているので、popup を開く click / dblclick は
 * ここで確実に止める (下書き中に popup が出ると操作が破綻するため)。
 */
const blockClick = (e: Event): void => {
  if (!active) return;
  stop(e);
};

const handleKeyDown = (e: KeyboardEvent): void => {
  if (!active || e.code !== "Space") return;
  // ページスクロール抑止。入力欄にフォーカスがある時は邪魔しない
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    return;
  e.preventDefault();
  // キーリピートで塗り位置がリセットされないように初回だけ処理する
  if (spaceHeld) return;
  spaceHeld = true;

  // 押した瞬間、カーソル直下に1px置く。補間の起点もここに合わせる
  // (前回ストロークの終点から線が伸びてしまうのを防ぐ)。
  lastWorld = lastPointer
    ? screenToWorldPixel(lastPointer.x, lastPointer.y)
    : null;
  if (lastWorld)
    paintWorldPixel(lastWorld.x, lastWorld.y, eraseMode ? "erase" : "draw");
  updateCursor();
};

const handleKeyUp = (e: KeyboardEvent): void => {
  if (e.code !== "Space") return;
  spaceHeld = false;
  // ストロークを切る。次に押した時に離れた場所と線で繋がらないようにする
  if (!dragMode) lastWorld = null;
  updateCursor();
};

/** 現在の操作モードが分かるようカーソルを変える */
const updateCursor = (): void => {
  const target = getInputTarget();
  if (!target) return;
  target.style.cursor = !active
    ? ""
    : eraseMode
      ? "cell"
      : bucketMode
        ? "copy"
        : spaceHeld
          ? "crosshair"
          : "grab";
};

let inputTarget: HTMLElement | null = null;

/**
 * NOTE: capture 段階で拾う。maplibre のハンドラより先に走らせて、
 * 描画操作のときだけ stopPropagation で pan/zoom を抑止するため。
 * 逆に描画でない時は素通りさせるので、純正の pan/zoom がそのまま効く。
 */
const attachPointerHandlers = (): void => {
  const target = getInputTarget();
  if (!target || inputTarget === target) return;
  detachPointerHandlers();

  target.addEventListener("pointerdown", handlePointerDown, { capture: true });
  target.addEventListener("pointermove", handlePointerMove, { capture: true });
  target.addEventListener("pointerup", handlePointerUp, { capture: true });
  target.addEventListener("pointercancel", handlePointerUp, { capture: true });
  target.addEventListener("click", blockClick, { capture: true });
  target.addEventListener("dblclick", blockClick, { capture: true });
  // 右ドラッグ消しゴムのため、コンテキストメニューは常に殺す
  target.addEventListener("contextmenu", stop, { capture: true });
  // NOTE: wheel は **止めない**。map にズームさせるため素通りさせる。
  inputTarget = target;
};

const detachPointerHandlers = (): void => {
  const target = inputTarget;
  if (!target) return;

  target.removeEventListener("pointerdown", handlePointerDown, {
    capture: true,
  });
  target.removeEventListener("pointermove", handlePointerMove, {
    capture: true,
  });
  target.removeEventListener("pointerup", handlePointerUp, { capture: true });
  target.removeEventListener("pointercancel", handlePointerUp, {
    capture: true,
  });
  target.removeEventListener("click", blockClick, { capture: true });
  target.removeEventListener("dblclick", blockClick, { capture: true });
  target.removeEventListener("contextmenu", stop, { capture: true });
  target.style.cursor = "";
  inputTarget = null;
};

// ------- render loop -------

const renderFrame = (): void => {
  rafId = requestAnimationFrame(renderFrame);
  if (!active) return;

  const c = getOrCreateCanvas();
  if (!c) return;
  syncCanvasSize(c);
  // map canvas が作り直された場合に備えて張り直す (同一なら no-op)
  attachPointerHandlers();
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
  onColorPicked: (colorId: number) => void;
  onBucketFailed: () => void;
}): void => {
  onPaint = handlers.onPaint;
  onErase = handlers.onErase;
  onColorPicked = handlers.onColorPicked;
  onBucketFailed = handlers.onBucketFailed;
};

export const setDraftCanvasActive = (enabled: boolean): void => {
  if (active === enabled) return;
  active = enabled;
  dirty = true;
  dragMode = null;
  pendingClick = null;
  lastWorld = null;
  lastPointer = null;
  spaceHeld = false;

  if (enabled) {
    attachMapListeners();
    getOrCreateCanvas();
    attachPointerHandlers();
    updateCursor();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    if (rafId === null) rafId = requestAnimationFrame(renderFrame);
    return;
  }

  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  detachPointerHandlers();
  eraseMode = false;
  bucketMode = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  detachMapListeners();
  canvas?.remove();
  canvas = null;
};
