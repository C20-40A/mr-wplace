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
import { clearBaseTileCache, prepareBaseTiles } from "./draft-base-layer";
import { forEachBrushPixel, getDraftBrushSize } from "./draft-brush";
import { beginHistoryEntry, commitHistoryEntry } from "./draft-history";
import {
  getDraftLineMidpoint,
  rasterizeDraftLine,
  type DraftLineSettings,
  type DraftLineShape,
} from "./draft-line";
import {
  forEachDraftStampPixel,
  getDraftStampColorIdAt,
  normalizeDraftStampPattern,
  type DraftStampMode,
  type DraftStampPattern,
} from "./draft-stamp";
import {
  getDraftShapeBounds,
  rasterizeDraftShape,
  snapDraftShapeToSquare,
  type DraftShapeRect,
  type DraftShapeSettings,
} from "./draft-shape";

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
 * - **マップロック ON** : 左ドラッグがそのまま描画になる (pan しない)
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
const LINE_ACTIONS_ID = "mr-wplace-draft-line-actions";
const SHAPE_ACTIONS_ID = "mr-wplace-draft-shape-actions";
const LINE_ACTION_ICON_ATTRS =
  'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
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
/**
 * マップロック。ON の間は左ドラッグを map の pan に渡さず、そのまま描画に流す
 * (= Space を押しっぱなしにしたのと同じ状態を latch する)。
 */
let mapLocked = false;

/** Custom pixel pattern tool. null means the regular brush is active. */
let stampMode: DraftStampMode | null = null;
let stampPattern: DraftStampPattern = {
  width: 3,
  height: 3,
  colorIds: [null, 10, null, 10, 10, 10, null, 10, null],
};

/** Editable vector preview. It is rasterized into the draft store on commit. */
let lineMode = false;
/** 直線トグル。ON (または Shift 押下中) は端点を水平/垂直/45° へスナップする */
let lineStraightMode = false;
let lineShape: DraftLineShape | null = null;
let lineControlMoved = false;
let lineDrag: "create" | "start" | "control" | "end" | null = null;
let linePointerId: number | null = null;
let lineSettings: DraftLineSettings = {
  innerWidth: 2,
  outlineWidth: 1,
  innerColor: { r: 249, g: 221, b: 59 },
  outlineColor: { r: 246, g: 170, b: 9 },
};
/**
 * ラスタプレビューのキャッシュ。線 1 本ぶんの world pixel を実際に
 * `rasterizeDraftLine` で焼いて持つ。map の移動/ズームでは中身が変わらないので、
 * shape/settings が変わった時だけ焼き直す。
 */
let linePreviewCache: {
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
  token: string;
} | null = null;

/**
 * 矩形ツール。線ツールと同じく「確定するまでベクター」で持ち、
 * commit で初めて下書きストアへラスタライズする。
 */
let shapeMode = false;
/** 正方形トグル。ON (または Shift 押下中) は正方形へスナップする */
let shapeSquareMode = false;
let shapeRect: DraftShapeRect | null = null;
let shapeDrag: "create" | "start" | "end" | null = null;
let shapePointerId: number | null = null;
let shapeSettings: DraftShapeSettings = {
  strokeWidth: 1,
  filled: false,
  strokeColor: { r: 249, g: 221, b: 59 },
  fillColor: { r: 246, g: 170, b: 9 },
};
/** 線と同じくラスタプレビューをキャッシュする (map 移動では焼き直さない) */
let shapePreviewCache: {
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
  token: string;
} | null = null;

let onPaint: PaintHandler | null = null;
let onErase: EraseHandler | null = null;
let lineActionButtons: HTMLDivElement | null = null;
let onLineAction: ((action: "commit" | "cancel") => void) | null = null;
let shapeActionButtons: HTMLDivElement | null = null;
let onShapeAction: ((action: "commit" | "cancel") => void) | null = null;

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
/** Ctrl+Z / Ctrl+Shift+Z (キーボードからの undo/redo 要求) */
let onUndoRequested: (() => void) | null = null;
let onRedoRequested: (() => void) | null = null;

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
  if (enabled) stampMode = null;
  updateCursor();
};

export const isDraftEraseMode = (): boolean => eraseMode;

export const setDraftBucketMode = (enabled: boolean): void => {
  bucketMode = enabled;
  if (enabled) eraseMode = false;
  if (enabled) stampMode = null;
  updateCursor();
};

/**
 * 編集中の線を破棄して、付随する UI/キャッシュも片付ける。
 * 確定・取消・モード解除・下書き終了のすべてがここを通る。
 */
const resetDraftLineShape = (): void => {
  lineShape = null;
  lineDrag = null;
  linePointerId = null;
  lineControlMoved = false;
  linePreviewCache = null;
  lineActionButtons?.remove();
  lineActionButtons = null;
  dirty = true;
};

export const setDraftLineMode = (enabled: boolean): void => {
  lineMode = enabled;
  if (enabled) {
    eraseMode = false;
    bucketMode = false;
    stampMode = null;
    shapeMode = false;
    resetDraftShape();
    dirty = true;
  } else {
    resetDraftLineShape();
  }
  updateCursor();
};

/** 直線モードのトグル。Shift 押下中と同じ拘束を latch する */
export const setDraftLineStraightMode = (enabled: boolean): void => {
  lineStraightMode = enabled;
};

export const updateDraftLineSettings = (
  settings: Partial<DraftLineSettings>,
): void => {
  lineSettings = {
    ...lineSettings,
    ...settings,
    innerWidth: Math.max(
      1,
      Math.min(32, Math.round(settings.innerWidth ?? lineSettings.innerWidth)),
    ),
    outlineWidth: Math.max(
      0,
      Math.min(
        16,
        Math.round(settings.outlineWidth ?? lineSettings.outlineWidth),
      ),
    ),
  };
  dirty = true;
};

export const commitDraftLine = (): void => {
  if (!lineShape) return;
  beginHistoryEntry();
  rasterizeDraftLine(lineShape, lineSettings, (x, y, color) =>
    applyWorldPixel(x, y, color),
  );
  commitHistoryEntry();
  // 線ツールは付けっぱなしにする。続けて次の線を引けるようにするため
  resetDraftLineShape();
};

export const cancelDraftLine = (): void => {
  resetDraftLineShape();
};

/** 編集中の矩形を破棄し、付随する UI/キャッシュも片付ける */
const resetDraftShape = (): void => {
  shapeRect = null;
  shapeDrag = null;
  shapePointerId = null;
  shapePreviewCache = null;
  shapeActionButtons?.remove();
  shapeActionButtons = null;
  dirty = true;
};

export const setDraftShapeMode = (enabled: boolean): void => {
  shapeMode = enabled;
  if (enabled) {
    eraseMode = false;
    bucketMode = false;
    stampMode = null;
    lineMode = false;
    resetDraftLineShape();
    dirty = true;
  } else {
    resetDraftShape();
  }
  updateCursor();
};

/** 正方形トグル。Shift 押下中と同じ拘束を latch する */
export const setDraftShapeSquareMode = (enabled: boolean): void => {
  shapeSquareMode = enabled;
};

export const updateDraftShapeSettings = (
  settings: Partial<DraftShapeSettings>,
): void => {
  shapeSettings = {
    ...shapeSettings,
    ...settings,
    strokeWidth: Math.max(
      0,
      Math.min(
        32,
        Math.round(settings.strokeWidth ?? shapeSettings.strokeWidth),
      ),
    ),
  };
  dirty = true;
};

export const commitDraftShape = (): void => {
  if (!shapeRect) return;
  beginHistoryEntry();
  rasterizeDraftShape(shapeRect, shapeSettings, (x, y, color) =>
    applyWorldPixel(x, y, color),
  );
  commitHistoryEntry();
  // 続けて次の矩形を描けるよう、ツール自体は付けっぱなしにする
  resetDraftShape();
};

export const cancelDraftShape = (): void => {
  resetDraftShape();
};

/**
 * マップロックの ON/OFF。
 * ON にすると左ドラッグが pan ではなく描画になる (Space の latch 版)。
 */
export const setDraftMapLocked = (locked: boolean): void => {
  mapLocked = locked;
  // ロック解除時にストロークを切る。次の pan と線で繋がらないようにする
  if (!locked && !dragMode) lastWorld = null;
  updateCursor();
};

export const setDraftStampSettings = (data: {
  enabled?: boolean;
  mode?: DraftStampMode;
  pattern?: DraftStampPattern;
}): void => {
  if (data.pattern) stampPattern = normalizeDraftStampPattern(data.pattern);
  if (data.enabled === false) stampMode = null;
  if (data.enabled === true) {
    stampMode = data.mode === "fill" ? "fill" : "single";
    eraseMode = false;
    bucketMode = false;
  } else if (stampMode && data.mode) {
    stampMode = data.mode;
  }
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

const worldToScreenPixel = (
  point: { x: number; y: number },
): { x: number; y: number } | null => {
  const map = getMapInstanceFromWplace() as any;
  if (!map?.project) return null;
  const tileX = Math.floor(point.x / TILE_SIZE);
  const tileY = Math.floor(point.y / TILE_SIZE);
  const lngLat = tilePixelToLatLng(
    tileX,
    tileY,
    point.x - tileX * TILE_SIZE,
    point.y - tileY * TILE_SIZE,
  );
  const projected = map.project([lngLat.lng, lngLat.lat]);
  return projected ? { x: projected.x, y: projected.y } : null;
};

// ------- painting -------

/** world pixel 1点 (ブラシ展開後) を store へ流す */
const applyWorldPixel = (
  worldX: number,
  worldY: number,
  color: { r: number; g: number; b: number } | null,
): void => {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  const pixelX = worldX - tileX * TILE_SIZE;
  const pixelY = worldY - tileY * TILE_SIZE;

  if (!color) {
    onErase?.(tileX, tileY, pixelX, pixelY);
    return;
  }
  onPaint?.(tileX, tileY, pixelX, pixelY, color);
};

/**
 * ブラシ1打点。円ブラシを展開し、描画時のみディザマスクを掛ける。
 * (消しゴムにディザを掛けると消し残しが出て使いにくいので掛けない)
 */
const paintWorldPixel = (
  worldX: number,
  worldY: number,
  mode: DragMode,
): void => {
  const color = mode === "erase" ? null : getSelectedColor();
  if (mode === "draw" && !color) return;

  forEachBrushPixel(worldX, worldY, mode === "draw", (x, y) =>
    applyWorldPixel(x, y, color),
  );
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
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance === 0) {
    paintWorldPixel(to.x, to.y, mode);
    return;
  }

  // 太いブラシで 1px 刻みに打つと size^2 * 距離ぶん無駄になる。
  // 半径の半分ずつ進めれば隙間なく繋がる (1px ブラシでは従来通り 1px 刻み)。
  const stride = Math.max(1, Math.floor(getDraftBrushSize() / 2));
  const steps = Math.ceil(distance / stride);

  for (let i = 1; i <= steps; i++) {
    paintWorldPixel(
      Math.round(from.x + (dx * i) / steps),
      Math.round(from.y + (dy * i) / steps),
      mode,
    );
  }
};

/** 開始点を含む 3x3 タイル。バケツの到達範囲 (±2000px) を覆う */
const getNeighborTiles = (
  worldX: number,
  worldY: number,
): Array<{ tileX: number; tileY: number }> => {
  const centerX = Math.floor(worldX / TILE_SIZE);
  const centerY = Math.floor(worldY / TILE_SIZE);
  const tiles: Array<{ tileX: number; tileY: number }> = [];

  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      tiles.push({ tileX: centerX + dx, tileY: centerY + dy });

  return tiles;
};

/**
 * バケツ塗り。上限を超える (= 開いた領域を塗ろうとした) 場合は
 * 1px も塗らず、content 側へヒント表示を促す。
 *
 * 判定は下書き + **下地 (wplace 本体タイル)** の合成で行うので、
 * 既存アートの線をそのまま塗りの壁にできる。下地は読むだけで、
 * 塗る先は常に下書きレイヤー。
 *
 * NOTE: 下地の decode は非同期なので、塗る前に開始点の周辺タイルだけ
 * 用意してから同期の flood fill に入る。周辺 3x3 に限定するのは
 * `MAX_FILL_EXTENT` (±2000px) が高々隣接タイルまでしか届かないため。
 */
const bucketFillAt = async (
  clientX: number,
  clientY: number,
): Promise<void> => {
  const world = screenToWorldPixel(clientX, clientY);
  if (!world) return;

  const color = getSelectedColor();
  if (!color) return;

  await prepareBaseTiles(getNeighborTiles(world.x, world.y));

  const result = computeBucketFill(world.x, world.y, color, true);
  if (!result.ok) {
    onBucketFailed?.();
    return;
  }

  // バケツ1回 = undo 1回
  beginHistoryEntry();
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
  commitHistoryEntry();
};

/** Custom pattern 1回をクリック位置の中央へ置く。 */
const stampAt = (clientX: number, clientY: number): void => {
  const world = screenToWorldPixel(clientX, clientY);
  if (!world) return;

  beginHistoryEntry();
  forEachDraftStampPixel(world.x, world.y, stampPattern, (x, y, colorId) => {
    const rgb = paletteById.get(colorId);
    if (!rgb) return;
    applyWorldPixel(x, y, { r: rgb[0], g: rgb[1], b: rgb[2] });
  });
  commitHistoryEntry();
};

/**
 * 既存バケツと同じ連結領域を求め、その領域内だけにパターンを反復する。
 * OFF セルは下地を残すため、格子・網点・縞などを一操作で敷ける。
 */
const stampFillAt = async (
  clientX: number,
  clientY: number,
): Promise<void> => {
  const world = screenToWorldPixel(clientX, clientY);
  if (!world) return;
  const pattern = stampPattern;

  await prepareBaseTiles(getNeighborTiles(world.x, world.y));
  const targetColor = { r: -1, g: -1, b: -1 };
  const result = computeBucketFill(world.x, world.y, targetColor, true);
  if (!result.ok) {
    onBucketFailed?.();
    return;
  }

  beginHistoryEntry();
  for (const pixel of result.pixels) {
    const colorId = getDraftStampColorIdAt(
      pixel.x,
      pixel.y,
      world.x,
      world.y,
      pattern,
    );
    if (colorId === null) continue;
    const rgb = paletteById.get(colorId);
    if (rgb) applyWorldPixel(pixel.x, pixel.y, { r: rgb[0], g: rgb[1], b: rgb[2] });
  }
  commitHistoryEntry();
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
 * マップロック中の左ドラッグは handlePointerDown 側で先に確定させる。
 */
const resolveDragMode = (e: PointerEvent): DragMode | null => {
  if (e.button === 2) return "erase";
  if (e.button !== 0) return null;
  if (eraseMode) return "erase";
  return null;
};

const getLineHandleAt = (
  clientX: number,
  clientY: number,
): "start" | "control" | "end" | null => {
  if (!lineShape) return null;
  const rect = getMapCanvas()?.getBoundingClientRect();
  if (!rect) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  for (const key of ["control", "start", "end"] as const) {
    const point = worldToScreenPixel(lineShape[key]);
    if (point && Math.hypot(point.x - x, point.y - y) <= 12) return key;
  }
  return null;
};

const isLineActionTarget = (target: EventTarget | null): boolean =>
  target instanceof Node &&
  (!!lineActionButtons?.contains(target) ||
    !!shapeActionButtons?.contains(target));

/** 地図上へ浮かせる ✓ / × のペア。線ツールと矩形ツールで共用する */
const createActionButtons = (
  id: string,
  onAction: () => ((action: "commit" | "cancel") => void) | null,
): HTMLDivElement => {
  const group = document.createElement("div");
  group.id = id;
  group.style.cssText = [
    "position:absolute;z-index:12;display:flex;gap:6px",
    "padding:4px;border-radius:999px",
    "background:rgb(0 0 0 / .45);box-shadow:0 2px 8px rgb(0 0 0 / .25)",
  ].join(";");

  const addButton = (action: "commit" | "cancel", icon: string): void => {
    const button = document.createElement("button");
    button.type = "button";
    button.title = action === "commit" ? "Apply" : "Cancel";
    button.style.cssText = [
      "display:flex;align-items:center;justify-content:center",
      "width:30px;height:30px;padding:0;border:0;border-radius:999px",
      "cursor:pointer;color:white",
      action === "commit" ? "background:#16a34a" : "background:#dc2626",
    ].join(";");
    button.innerHTML = icon;
    // NOTE: 確定/取消は pointerdown で走らせる。map container 側の blockClick が
    // capture 段階で click を殺すため、click では届かない。
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onAction()?.(action);
    });
    group.appendChild(button);
  };

  addButton(
    "commit",
    `<svg xmlns="http://www.w3.org/2000/svg" ${LINE_ACTION_ICON_ATTRS}><path d="m20 6-11 11-5-5"/></svg>`,
  );
  addButton(
    "cancel",
    `<svg xmlns="http://www.w3.org/2000/svg" ${LINE_ACTION_ICON_ATTRS}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  );
  return group;
};

/** 図形の右下あたりへ ✓ / × を寄せる (画面外へ出さないよう clamp) */
const positionActionButtons = (
  group: HTMLDivElement,
  canvasElement: HTMLCanvasElement,
  points: Array<{ x: number; y: number }>,
): void => {
  const x = Math.min(
    canvasElement.width - group.offsetWidth - 6,
    Math.max(6, Math.max(...points.map((point) => point.x)) + 14),
  );
  const y = Math.min(
    canvasElement.height - group.offsetHeight - 6,
    Math.max(6, Math.max(...points.map((point) => point.y)) + 14),
  );
  group.style.left = `${x}px`;
  group.style.top = `${y}px`;
};

const syncLineActionButtons = (canvasElement: HTMLCanvasElement): void => {
  if (!lineMode || !lineShape) {
    lineActionButtons?.remove();
    lineActionButtons = null;
    return;
  }

  const parent = canvasElement.parentElement;
  if (!parent) return;
  if (!lineActionButtons?.isConnected) {
    lineActionButtons = createActionButtons(LINE_ACTIONS_ID, () => onLineAction);
    parent.appendChild(lineActionButtons);
  }

  const points = [lineShape.start, lineShape.control, lineShape.end]
    .map(worldToScreenPixel)
    .filter((point): point is { x: number; y: number } => !!point);
  if (points.length !== 3) return;
  positionActionButtons(lineActionButtons, canvasElement, points);
};

const syncShapeActionButtons = (canvasElement: HTMLCanvasElement): void => {
  if (!shapeMode || !shapeRect) {
    shapeActionButtons?.remove();
    shapeActionButtons = null;
    return;
  }

  const parent = canvasElement.parentElement;
  if (!parent) return;
  if (!shapeActionButtons?.isConnected) {
    shapeActionButtons = createActionButtons(
      SHAPE_ACTIONS_ID,
      () => onShapeAction,
    );
    parent.appendChild(shapeActionButtons);
  }

  const points = [shapeRect.start, shapeRect.end]
    .map(worldToScreenPixel)
    .filter((point): point is { x: number; y: number } => !!point);
  if (points.length !== 2) return;
  positionActionButtons(shapeActionButtons, canvasElement, points);
};

const handleLinePointerDown = (e: PointerEvent): void => {
  stop(e);
  const world = screenToWorldPixel(e.clientX, e.clientY);
  if (!world) return;

  const handle = getLineHandleAt(e.clientX, e.clientY);
  if (handle) {
    lineDrag = handle;
  } else {
    lineShape = {
      start: world,
      control: world,
      end: world,
    };
    lineControlMoved = false;
    lineDrag = "create";
  }

  linePointerId = e.pointerId;
  inputTarget?.setPointerCapture(e.pointerId);
  dirty = true;
};

/**
 * 直線拘束。anchor から見て水平 / 垂直 / 45° の一番近いものへ寄せる。
 * どれに寄せるかは dx/dy の比で決める (片方がもう片方の 2 倍以上なら軸、
 * それ以外は対角線)。
 */
const snapToStraight = (
  anchor: { x: number; y: number },
  point: { x: number; y: number },
): { x: number; y: number } => {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX >= absY * 2) return { x: point.x, y: anchor.y };
  if (absY >= absX * 2) return { x: anchor.x, y: point.y };

  const length = Math.round((absX + absY) / 2);
  return {
    x: anchor.x + Math.sign(dx) * length,
    y: anchor.y + Math.sign(dy) * length,
  };
};

const handleLinePointerMove = (e: PointerEvent): boolean => {
  if (!lineDrag || !lineShape || e.pointerId !== linePointerId) return false;
  stop(e);
  const world = screenToWorldPixel(e.clientX, e.clientY);
  if (!world) return true;

  // 直線モード中は制御点を触らせない (曲げても即座に中点へ戻るため)
  const straight = (lineStraightMode || e.shiftKey) && lineDrag !== "control";

  if (lineDrag === "create") {
    lineShape.end = straight ? snapToStraight(lineShape.start, world) : world;
    lineShape.control = getDraftLineMidpoint(lineShape.start, lineShape.end);
  } else {
    // 始点を動かしている時の固定側は終点、それ以外は始点
    lineShape[lineDrag] = straight
      ? snapToStraight(
          lineDrag === "start" ? lineShape.end : lineShape.start,
          world,
        )
      : world;
    if (lineDrag === "control") lineControlMoved = true;
    else if (!lineControlMoved || straight)
      lineShape.control = getDraftLineMidpoint(lineShape.start, lineShape.end);
  }
  dirty = true;
  return true;
};

const handleLinePointerUp = (e: PointerEvent): boolean => {
  if (!lineDrag || e.pointerId !== linePointerId) return false;
  stop(e);
  lineDrag = null;
  linePointerId = null;
  if (inputTarget?.hasPointerCapture(e.pointerId))
    inputTarget.releasePointerCapture(e.pointerId);
  dirty = true;
  return true;
};

/** 矩形の角ハンドル。掴んだ角を動かし、対角は固定する */
const getShapeHandleAt = (
  clientX: number,
  clientY: number,
): "start" | "end" | null => {
  if (!shapeRect) return null;
  const rect = getMapCanvas()?.getBoundingClientRect();
  if (!rect) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  for (const key of ["end", "start"] as const) {
    const point = worldToScreenPixel(shapeRect[key]);
    if (point && Math.hypot(point.x - x, point.y - y) <= 12) return key;
  }
  return null;
};

const handleShapePointerDown = (e: PointerEvent): void => {
  stop(e);
  const world = screenToWorldPixel(e.clientX, e.clientY);
  if (!world) return;

  const handle = getShapeHandleAt(e.clientX, e.clientY);
  if (handle) {
    shapeDrag = handle;
  } else {
    // 新しくドラッグを始めたら、編集中の矩形は捨てて引き直す
    shapeRect = { start: world, end: world };
    shapeDrag = "create";
  }

  shapePointerId = e.pointerId;
  inputTarget?.setPointerCapture(e.pointerId);
  dirty = true;
};

const handleShapePointerMove = (e: PointerEvent): boolean => {
  if (!shapeDrag || !shapeRect || e.pointerId !== shapePointerId) return false;
  stop(e);
  const world = screenToWorldPixel(e.clientX, e.clientY);
  if (!world) return true;

  // 掴んでいる角の対角を固定点にして正方形へ寄せる
  const anchor = shapeDrag === "start" ? shapeRect.end : shapeRect.start;
  const point =
    shapeSquareMode || e.shiftKey ? snapDraftShapeToSquare(anchor, world) : world;

  if (shapeDrag === "start") shapeRect.start = point;
  else shapeRect.end = point;
  dirty = true;
  return true;
};

const handleShapePointerUp = (e: PointerEvent): boolean => {
  if (!shapeDrag || e.pointerId !== shapePointerId) return false;
  stop(e);
  shapeDrag = null;
  shapePointerId = null;
  if (inputTarget?.hasPointerCapture(e.pointerId))
    inputTarget.releasePointerCapture(e.pointerId);
  dirty = true;
  return true;
};

const handlePointerDown = (e: PointerEvent): void => {
  if (!active) return;

  if (isLineActionTarget(e.target)) return;

  // 中クリックは spoit。map へは渡さない
  if (e.button === 1) {
    stop(e);
    pickColorAt(e.clientX, e.clientY);
    return;
  }

  if (lineMode && e.button === 0) {
    handleLinePointerDown(e);
    return;
  }

  if (shapeMode && e.button === 0) {
    handleShapePointerDown(e);
    return;
  }

  // Space 中は「なぞって塗る」モード。ここで pan させると塗りながら地図が
  // 動いてしまうので、左押下は map へ渡さず塗りとして扱う
  if (spaceHeld && e.button === 0 && !bucketMode && !stampMode) {
    stop(e);
    const world = screenToWorldPixel(e.clientX, e.clientY);
    if (world) {
      paintLine(lastWorld, world, eraseMode ? "erase" : "draw");
      lastWorld = world;
    }
    return;
  }

  /**
   * マップロック中の左ドラッグは pan させず、そのまま描画ストロークにする。
   * Space と違い **ボタンを押している間だけ** 塗る (latch なので、
   * hover で塗ると地図上をなぞっただけで描けてしまい事故になる)。
   * バケツ ON の時は「クリック = バケツ」を優先する。
   */
  if (mapLocked && e.button === 0 && !bucketMode && !stampMode) {
    stop(e);
    // ストローク全体で undo 1回 (pointerup で commit)
    beginHistoryEntry();
    dragMode = eraseMode ? "erase" : "draw";
    pendingClick = null;
    inputTarget?.setPointerCapture(e.pointerId);
    lastWorld = screenToWorldPixel(e.clientX, e.clientY);
    if (lastWorld) paintWorldPixel(lastWorld.x, lastWorld.y, dragMode);
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
  // ストローク全体で undo 1回 (pointerup で commit)
  beginHistoryEntry();
  dragMode = mode;
  pendingClick = null;
  inputTarget?.setPointerCapture(e.pointerId);
  lastWorld = screenToWorldPixel(e.clientX, e.clientY);
  if (lastWorld) paintWorldPixel(lastWorld.x, lastWorld.y, mode);
};

const handlePointerMove = (e: PointerEvent): void => {
  if (!active) return;
  lastPointer = { x: e.clientX, y: e.clientY };
  if (handleLinePointerMove(e)) return;
  if (handleShapePointerMove(e)) return;

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
  if (handleLinePointerUp(e)) return;
  if (handleShapePointerUp(e)) return;

  // ドラッグせずに離した左クリック = dot を1つ置く
  if (!dragMode && pendingClick && e.button === 0) {
    const moved =
      Math.abs(e.clientX - pendingClick.x) > CLICK_SLOP ||
      Math.abs(e.clientY - pendingClick.y) > CLICK_SLOP;
    pendingClick = null;
    if (!moved) {
      stop(e);
      if (stampMode === "fill") {
        // 下地 decode を挟むので非同期。pointer 処理はここで終える
        void stampFillAt(e.clientX, e.clientY);
        return;
      }
      if (stampMode === "single") {
        stampAt(e.clientX, e.clientY);
        return;
      }
      if (bucketMode) {
        // 下地 decode を挟むので非同期。pointer 処理はここで終える
        void bucketFillAt(e.clientX, e.clientY);
        return;
      }
      const world = screenToWorldPixel(e.clientX, e.clientY);
      if (world) {
        // dot 1つ = undo 1回
        beginHistoryEntry();
        paintWorldPixel(world.x, world.y, eraseMode ? "erase" : "draw");
        commitHistoryEntry();
      }
    }
    return;
  }

  if (!dragMode) return;

  stop(e);
  commitHistoryEntry();
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

/** 入力欄にフォーカスがある時はショートカットを奪わない */
const isTypingTarget = (): boolean => {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
};

const handleKeyDown = (e: KeyboardEvent): void => {
  if (!active) return;

  // Ctrl/Cmd + Z = undo / Ctrl+Shift+Z (or Ctrl+Y) = redo
  if ((e.ctrlKey || e.metaKey) && !isTypingTarget()) {
    const key = e.key.toLowerCase();
    if (key === "z" || key === "y") {
      e.preventDefault();
      e.stopPropagation();
      // キーリピートで履歴を一気に食い潰さないよう初回のみ反応する
      if (e.repeat) return;
      if (key === "y" || e.shiftKey) onRedoRequested?.();
      else onUndoRequested?.();
      return;
    }
  }

  if (lineMode && !isTypingTarget()) {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const committed = e.key === "Enter";
      if (committed) commitDraftLine();
      else cancelDraftLine();
      // Enter は「確定して次の線へ」。Escape だけツール自体を抜ける
      if (!committed) setDraftLineMode(false);
      window.postMessage(
        {
          source: "mr-wplace-draft-line-ended",
          committed,
          keepMode: committed,
        },
        "*",
      );
      return;
    }
  }

  if (shapeMode && !isTypingTarget()) {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const committed = e.key === "Enter";
      if (committed) commitDraftShape();
      else cancelDraftShape();
      // Enter は「確定して次の矩形へ」。Escape だけツール自体を抜ける
      if (!committed) setDraftShapeMode(false);
      window.postMessage(
        {
          source: "mr-wplace-draft-shape-ended",
          committed,
          keepMode: committed,
        },
        "*",
      );
      return;
    }
  }

  if (e.code !== "Space") return;
  // スタンプはクリック配置専用。Space はマップ操作のままにする。
  if (stampMode) return;
  // 矩形ツール中も Space なぞりは邪魔になるだけなので無効にする
  if (shapeMode) return;
  // ページスクロール抑止。入力欄にフォーカスがある時は邪魔しない
  if (isTypingTarget()) return;
  e.preventDefault();
  // キーリピートで塗り位置がリセットされないように初回だけ処理する
  if (spaceHeld) return;
  spaceHeld = true;
  // Space を押してから離すまでで undo 1回 (keyup で commit)
  beginHistoryEntry();

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
  if (spaceHeld) commitHistoryEntry();
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
    : lineMode || shapeMode
      ? "crosshair"
    : eraseMode
      ? "cell"
      : stampMode
        ? "copy"
      : bucketMode
        ? "copy"
        : // ロック中は pan しないので grab (掴める) に見せない
          spaceHeld || mapLocked
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

  renderLinePreview(ctx);
  renderShapePreview(ctx);
  syncLineActionButtons(c);
  syncShapeActionButtons(c);
};

const getLinePreviewToken = (shape: DraftLineShape): string =>
  [
    shape.start.x,
    shape.start.y,
    shape.control.x,
    shape.control.y,
    shape.end.x,
    shape.end.y,
    lineSettings.innerWidth,
    lineSettings.outlineWidth,
    lineSettings.innerColor.r,
    lineSettings.innerColor.g,
    lineSettings.innerColor.b,
    lineSettings.outlineColor.r,
    lineSettings.outlineColor.g,
    lineSettings.outlineColor.b,
  ].join(",");

/**
 * 確定時と**同じ** `rasterizeDraftLine` でプレビューを焼く。
 * こうすると「見えている通りに置かれる」ことが保証される
 * (以前の quadraticCurveTo プレビューは滑らかな線なので、
 * 実際に置かれるドット絵と見た目が食い違っていた)。
 */
const buildLinePreviewCache = (shape: DraftLineShape) => {
  const token = getLinePreviewToken(shape);
  if (linePreviewCache?.token === token) return linePreviewCache;

  // 太さぶん膨らむので bounding box に余白を足す
  const pad = Math.ceil(lineSettings.innerWidth / 2 + lineSettings.outlineWidth) + 2;
  const minX = Math.floor(Math.min(shape.start.x, shape.control.x, shape.end.x)) - pad;
  const minY = Math.floor(Math.min(shape.start.y, shape.control.y, shape.end.y)) - pad;
  const maxX = Math.ceil(Math.max(shape.start.x, shape.control.x, shape.end.x)) + pad;
  const maxY = Math.ceil(Math.max(shape.start.y, shape.control.y, shape.end.y)) + pad;

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  // 制御点を大きく引き回した時に巨大 canvas を作らないための保険
  if (width <= 0 || height <= 0 || width * height > 16_000_000) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const previewCtx = canvas.getContext("2d");
  if (!previewCtx) return null;

  const image = previewCtx.createImageData(width, height);
  const { data } = image;
  rasterizeDraftLine(shape, lineSettings, (x, y, color) => {
    const px = x - minX;
    const py = y - minY;
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const i = (py * width + px) * 4;
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = 255;
  });
  previewCtx.putImageData(image, 0, 0);

  linePreviewCache = { canvas, originX: minX, originY: minY, token };
  return linePreviewCache;
};

const renderLinePreview = (ctx: CanvasRenderingContext2D): void => {
  if (!lineMode || !lineShape) return;
  const start = worldToScreenPixel(lineShape.start);
  const control = worldToScreenPixel(lineShape.control);
  const end = worldToScreenPixel(lineShape.end);
  if (!start || !control || !end) return;

  // 実際に置かれるドットをそのまま貼る (下書きタイルと同じ投影で位置を合わせる)
  const preview = buildLinePreviewCache(lineShape);
  if (preview) {
    const topLeft = worldToScreenPixel({
      x: preview.originX,
      y: preview.originY,
    });
    const bottomRight = worldToScreenPixel({
      x: preview.originX + preview.canvas.width,
      y: preview.originY + preview.canvas.height,
    });
    if (topLeft && bottomRight)
      ctx.drawImage(
        preview.canvas,
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y,
      );
  }

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(control.x, control.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const handles = [start, control, end];
  handles.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 1 ? 7 : 6, 0, Math.PI * 2);
    ctx.fillStyle = index === 1 ? "#3b82f6" : "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";
    ctx.stroke();
  });
  ctx.restore();
};

const getShapePreviewToken = (shape: DraftShapeRect): string => {
  const { minX, minY, maxX, maxY } = getDraftShapeBounds(shape);
  return [
    minX,
    minY,
    maxX,
    maxY,
    shapeSettings.strokeWidth,
    shapeSettings.filled ? 1 : 0,
    shapeSettings.strokeColor.r,
    shapeSettings.strokeColor.g,
    shapeSettings.strokeColor.b,
    shapeSettings.fillColor.r,
    shapeSettings.fillColor.g,
    shapeSettings.fillColor.b,
  ].join(",");
};

/**
 * 確定時と**同じ** `rasterizeDraftShape` でプレビューを焼く。
 * 「見えている通りに置かれる」ことを保証するため、枠のはみ出しや
 * 塗りの有無もそのままドット絵として現れる。
 */
const buildShapePreviewCache = (shape: DraftShapeRect) => {
  const token = getShapePreviewToken(shape);
  if (shapePreviewCache?.token === token) return shapePreviewCache;

  const { minX, minY, maxX, maxY } = getDraftShapeBounds(shape);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  // 巨大な矩形を引かれた時に canvas を作り切れなくなるのを防ぐ
  if (width <= 0 || height <= 0 || width * height > 16_000_000) return null;

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = width;
  previewCanvas.height = height;
  const previewCtx = previewCanvas.getContext("2d");
  if (!previewCtx) return null;

  const image = previewCtx.createImageData(width, height);
  const { data } = image;
  rasterizeDraftShape(shape, shapeSettings, (x, y, color) => {
    const px = x - minX;
    const py = y - minY;
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const i = (py * width + px) * 4;
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = 255;
  });
  previewCtx.putImageData(image, 0, 0);

  shapePreviewCache = { canvas: previewCanvas, originX: minX, originY: minY, token };
  return shapePreviewCache;
};

const renderShapePreview = (ctx: CanvasRenderingContext2D): void => {
  if (!shapeMode || !shapeRect) return;

  const preview = buildShapePreviewCache(shapeRect);
  if (preview) {
    // 下書きタイルと同じ投影で貼るので、ズームしても位置がずれない
    const topLeft = worldToScreenPixel({
      x: preview.originX,
      y: preview.originY,
    });
    const bottomRight = worldToScreenPixel({
      x: preview.originX + preview.canvas.width,
      y: preview.originY + preview.canvas.height,
    });
    if (topLeft && bottomRight)
      ctx.drawImage(
        preview.canvas,
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y,
      );
  }

  const { minX, minY, maxX, maxY } = getDraftShapeBounds(shapeRect);
  const topLeft = worldToScreenPixel({ x: minX, y: minY });
  const bottomRight = worldToScreenPixel({ x: maxX + 1, y: maxY + 1 });
  if (!topLeft || !bottomRight) return;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.strokeRect(
    topLeft.x,
    topLeft.y,
    bottomRight.x - topLeft.x,
    bottomRight.y - topLeft.y,
  );
  ctx.setLineDash([]);

  // 掴める角 (start/end) だけハンドルを出す
  for (const key of ["start", "end"] as const) {
    const point = worldToScreenPixel(shapeRect[key]);
    if (!point) continue;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";
    ctx.stroke();
  }
  ctx.restore();
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
  onUndoRequested: () => void;
  onRedoRequested: () => void;
  onLineAction: (action: "commit" | "cancel") => void;
  onShapeAction: (action: "commit" | "cancel") => void;
}): void => {
  onPaint = handlers.onPaint;
  onErase = handlers.onErase;
  onColorPicked = handlers.onColorPicked;
  onBucketFailed = handlers.onBucketFailed;
  onUndoRequested = handlers.onUndoRequested;
  onRedoRequested = handlers.onRedoRequested;
  onLineAction = handlers.onLineAction;
  onShapeAction = handlers.onShapeAction;
};

export const setDraftCanvasActive = (enabled: boolean): void => {
  if (active === enabled) return;
  active = enabled;
  dirty = true;
  // ストローク途中で抜けた場合に記録を開きっぱなしにしない
  commitHistoryEntry();
  dragMode = null;
  pendingClick = null;
  lastWorld = null;
  lastPointer = null;
  spaceHeld = false;
  lineMode = false;
  shapeMode = false;
  // 下書き終了後に ✓/× が地図上へ残らないよう明示的に片付ける
  resetDraftLineShape();
  resetDraftShape();
  stampMode = null;

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
  mapLocked = false;
  stampMode = null;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  detachMapListeners();
  // decode 済み下地は1枚 4MB。下書きを抜けたら抱え込まない
  clearBaseTileCache();
  canvas?.remove();
  canvas = null;
};
