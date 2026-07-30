import type {
  CapturedPaintedCoordinate,
  PaintedPixelMap,
  PaintedPixelValue,
} from "@/inject/types";
import { findPaintPixelControls } from "@/constants/selectors";

const TARGET_KEY_REGEX =
  /^t=\((-?\d+),(-?\d+)\);p=\((\d+),(\d+)\);s=(-?\d+)$/;
const MAX_CAPTURED_COORDINATES = 5000;

let isCaptureEnabled = false;
let originalMapSet: typeof Map.prototype.set | null = null;
let originalMapDelete: typeof Map.prototype.delete | null = null;
let originalMapClear: typeof Map.prototype.clear | null = null;
let targetPaintedPixelMap: PaintedPixelMap | null = null;
let paintModalObserver: MutationObserver | null = null;
let isPaintControlsVisible = false;
let visibilityCheckScheduled = false;

const capturedCoordinates = new Map<string, CapturedPaintedCoordinate>();
const captureOrder: string[] = [];

// Paint event listener for external modules (e.g., paint-stats-updater)
type PaintListener = (coord: CapturedPaintedCoordinate) => void;
let paintListener: PaintListener | null = null;
// Secondary paint listener (e.g., area-fill charge tracking)
let secondaryPaintListener: PaintListener | null = null;
// Draft paint listener (draft-draw accumulates pixels without consuming charges)
let draftPaintListener: PaintListener | null = null;
type PaintDeleteListener = (
  coord: Pick<
    CapturedPaintedCoordinate,
    "tileX" | "tileY" | "pixelX" | "pixelY" | "colorIdx" | "color"
  >
) => void;
let paintDeleteListener: PaintDeleteListener | null = null;
type PaintClearListener = () => void;
let paintClearListener: PaintClearListener | null = null;
type PaintSessionListener = (active: boolean) => void;
let paintSessionListener: PaintSessionListener | null = null;

export const setPaintListener = (listener: PaintListener | null): void => {
  paintListener = listener;
};

export const setSecondaryPaintListener = (
  listener: PaintListener | null
): void => {
  secondaryPaintListener = listener;
};

export const setDraftPaintListener = (
  listener: PaintListener | null
): void => {
  draftPaintListener = listener;
};

export const setPaintSessionListener = (
  listener: PaintSessionListener | null
): void => {
  paintSessionListener = listener;
};

export const setPaintDeleteListener = (
  listener: PaintDeleteListener | null
): void => {
  paintDeleteListener = listener;
};

export const setPaintClearListener = (
  listener: PaintClearListener | null
): void => {
  paintClearListener = listener;
};

const isTargetKey = (key: unknown): key is string =>
  typeof key === "string" &&
  key.startsWith("t=(") &&
  key.includes(";p=(") &&
  key.includes(";s=");

const normalizeColor = (
  color: unknown
): CapturedPaintedCoordinate["color"] | undefined => {
  if (!color || typeof color !== "object") return undefined;

  const candidate = color as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
  if (
    typeof candidate.r !== "number" ||
    typeof candidate.g !== "number" ||
    typeof candidate.b !== "number"
  )
    return undefined;

  return {
    r: candidate.r,
    g: candidate.g,
    b: candidate.b,
    a: typeof candidate.a === "number" ? candidate.a : 255,
  };
};

const parseTargetKey = (
  key: string
): Omit<
  CapturedPaintedCoordinate,
  "key" | "timestamp" | "color" | "colorIdx"
> | null => {
  const match = TARGET_KEY_REGEX.exec(key);
  if (!match) return null;

  return {
    tileX: Number(match[1]),
    tileY: Number(match[2]),
    pixelX: Number(match[3]),
    pixelY: Number(match[4]),
    season: Number(match[5]),
  };
};

const writeCapturedCoordinateRaw = (
  key: string,
  record: CapturedPaintedCoordinate
): void => {
  if (originalMapSet) {
    originalMapSet.call(capturedCoordinates, key, record);
    return;
  }
  capturedCoordinates.set(key, record);
};

const deleteCapturedCoordinateRaw = (key: string): void => {
  if (originalMapDelete) {
    originalMapDelete.call(capturedCoordinates, key);
    return;
  }
  capturedCoordinates.delete(key);
};

const clearCapturedCoordinatesRaw = (): void => {
  if (originalMapClear) {
    originalMapClear.call(capturedCoordinates);
    return;
  }
  capturedCoordinates.clear();
};

const removeFromCaptureOrder = (key: string): void => {
  const index = captureOrder.indexOf(key);
  if (index !== -1) captureOrder.splice(index, 1);
};

const clearCapturedCoordinates = (): void => {
  clearCapturedCoordinatesRaw();
  captureOrder.length = 0;
};

const deleteCapturedCoordinate = (key: string): void => {
  deleteCapturedCoordinateRaw(key);
  removeFromCaptureOrder(key);
};

const upsertCapturedCoordinateWithLimit = (
  key: string,
  record: CapturedPaintedCoordinate
): void => {
  const isNewKey = !capturedCoordinates.has(key);
  writeCapturedCoordinateRaw(key, record);

  if (!isNewKey) return;
  captureOrder.push(key);

  if (captureOrder.length <= MAX_CAPTURED_COORDINATES) return;
  const oldestKey = captureOrder.shift();
  if (oldestKey) deleteCapturedCoordinateRaw(oldestKey);
};

type MrWplaceGlobal = NonNullable<Window["mrWplace"]>;

const getMrWplace = (): MrWplaceGlobal => {
  if (!window.mrWplace) {
    window.mrWplace = {} as MrWplaceGlobal;
  }
  return window.mrWplace as MrWplaceGlobal;
};

const exposeCaptureState = ({
  mapRef,
  clearMapRef = false,
}: {
  mapRef?: PaintedPixelMap | null;
  clearMapRef?: boolean;
} = {}): void => {
  const mrWplace = getMrWplace();
  if (clearMapRef) delete mrWplace.paintedPixelMap;
  else if (mapRef) mrWplace.paintedPixelMap = mapRef;
  mrWplace.paintedPixelEntries = capturedCoordinates;
};

const toPaintedPixelMap = (value: unknown): PaintedPixelMap | null => {
  if (!(value instanceof Map)) return null;
  if (value === capturedCoordinates) return null;
  return value as PaintedPixelMap;
};

const buildRecord = (
  key: string,
  value: unknown
): CapturedPaintedCoordinate | null => {
  const parsed = parseTargetKey(key);
  if (!parsed) return null;

  const record: CapturedPaintedCoordinate = {
    key,
    ...parsed,
    timestamp: Date.now(),
  };

  if (value && typeof value === "object") {
    const candidate = value as PaintedPixelValue;
    if (typeof candidate.colorIdx === "number") record.colorIdx = candidate.colorIdx;
    const normalizedColor = normalizeColor(candidate.color);
    if (normalizedColor) record.color = normalizedColor;
  }

  return record;
};

const captureFromTargetMapSnapshot = (mapRef: PaintedPixelMap): void => {
  for (const [key, value] of mapRef.entries()) {
    if (!isTargetKey(key)) continue;
    const record = buildRecord(key, value);
    if (!record) continue;
    upsertCapturedCoordinateWithLimit(key, record);
  }
};

const setTargetPaintedPixelMap = (mapRef: PaintedPixelMap): void => {
  const switched = targetPaintedPixelMap !== mapRef;
  targetPaintedPixelMap = mapRef;

  if (switched) {
    clearCapturedCoordinates();
    captureFromTargetMapSnapshot(mapRef);
    console.log("🧑‍🎨 : Painted pixel map switched");
  }

  exposeCaptureState({ mapRef });
  paintSessionListener?.(true);
};

const handleSet = (mapRef: unknown, key: string, value: unknown): void => {
  const map = toPaintedPixelMap(mapRef);
  if (!map) return;
  isPaintControlsVisible = true;
  if (targetPaintedPixelMap !== map) setTargetPaintedPixelMap(map);

  const record = buildRecord(key, value);
  if (!record) return;
  upsertCapturedCoordinateWithLimit(key, record);
  exposeCaptureState({ mapRef: map });
  paintListener?.(record);
  secondaryPaintListener?.(record);
  draftPaintListener?.(record);
};

const handleDelete = (mapRef: unknown, key: unknown): void => {
  if (mapRef !== targetPaintedPixelMap) return;
  if (!isTargetKey(key)) return;
  const deletedRecord = buildRecord(key, targetPaintedPixelMap?.get(key));
  if (deletedRecord)
    paintDeleteListener?.({
      tileX: deletedRecord.tileX,
      tileY: deletedRecord.tileY,
      pixelX: deletedRecord.pixelX,
      pixelY: deletedRecord.pixelY,
      colorIdx: deletedRecord.colorIdx,
      color: deletedRecord.color,
    });
  deleteCapturedCoordinate(key);
  exposeCaptureState({ mapRef: targetPaintedPixelMap });
};

const handleClear = (mapRef: unknown): void => {
  if (mapRef !== targetPaintedPixelMap) return;
  if (capturedCoordinates.size > 0) paintClearListener?.();
  clearCapturedCoordinates();
  exposeCaptureState({ mapRef: targetPaintedPixelMap });
};

const resetPaintedMapState = (reason: string): void => {
  if (!targetPaintedPixelMap && capturedCoordinates.size === 0) return;

  targetPaintedPixelMap = null;
  clearCapturedCoordinates();
  exposeCaptureState({ clearMapRef: true });
  paintSessionListener?.(false);
  console.log(`🧑‍🎨 : Painted pixel map state reset (${reason})`);
};

const checkPaintControlsVisibility = (): void => {
  if (!isPaintControlsVisible) return;
  if (findPaintPixelControls()) return;

  resetPaintedMapState("paint modal closed");
  isPaintControlsVisible = false;
};

const setupPaintModalObserver = (): void => {
  if (paintModalObserver) return;

  isPaintControlsVisible = !!findPaintPixelControls();

  paintModalObserver = new MutationObserver(() => {
    if (visibilityCheckScheduled) return;
    visibilityCheckScheduled = true;

    requestAnimationFrame(() => {
      visibilityCheckScheduled = false;
      checkPaintControlsVisibility();
    });
  });

  paintModalObserver.observe(document.body, { childList: true, subtree: true });
};

const teardownPaintModalObserver = (): void => {
  paintModalObserver?.disconnect();
  paintModalObserver = null;
  visibilityCheckScheduled = false;
};

export const setupPaintedCoordinatesCapture = (): void => {
  if (isCaptureEnabled) return;

  exposeCaptureState();
  originalMapSet = Map.prototype.set;
  originalMapDelete = Map.prototype.delete;
  originalMapClear = Map.prototype.clear;

  Map.prototype.set = function (
    this: Map<unknown, unknown>,
    key: unknown,
    value: unknown
  ): Map<unknown, unknown> {
    if (isTargetKey(key)) handleSet(this, key, value);
    return originalMapSet!.call(this, key, value);
  } as typeof Map.prototype.set;

  Map.prototype.delete = function (
    this: Map<unknown, unknown>,
    key: unknown
  ): boolean {
    handleDelete(this, key);
    return originalMapDelete!.call(this, key);
  } as typeof Map.prototype.delete;

  Map.prototype.clear = function (this: Map<unknown, unknown>): void {
    handleClear(this);
    return originalMapClear!.call(this);
  } as typeof Map.prototype.clear;

  setupPaintModalObserver();
  isCaptureEnabled = true;
  console.log("🧑‍🎨 : Painted coordinates capture enabled");
};

export const getCapturedPaintedCoordinates = (): Map<
  string,
  CapturedPaintedCoordinate
> => capturedCoordinates;

/**
 * wplace 本体のペイント予約 Map へ直接書き込む (下書き編集の seed 用)。
 *
 * NOTE: 下書きの蓄積 (draft-store) だけでは「配置済み」の見た目にならない
 * (wplace 本体が予約中ピクセルとして描画するのは自身の Map にある分だけ)。
 * ここで targetPaintedPixelMap.set() を呼ぶと、フックした handleSet 経由で
 * 通常のペイントと同じ扱いになり、画面にも即座に反映される。
 *
 * ペイントモーダルが開いていない (targetPaintedPixelMap 未捕捉) 場合は無視する。
 */
const getKnownSeason = (): number => {
  for (const coord of capturedCoordinates.values()) return coord.season;
  return 0;
};

export const seedPaintedPixel = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
  color: { r: number; g: number; b: number },
  colorIdx: number,
): boolean => {
  if (!targetPaintedPixelMap) return false;

  const season = getKnownSeason();
  const key = `t=(${tileX},${tileY});p=(${pixelX},${pixelY});s=${season}`;
  targetPaintedPixelMap.set(key, {
    color: { r: color.r, g: color.g, b: color.b, a: 255 },
    colorIdx,
  } as PaintedPixelValue);
  return true;
};

const dispatchCanvasClickSequence = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): void => {
  const common: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
    view: window,
  };

  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      ...common,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    }),
  );
  canvas.dispatchEvent(new MouseEvent("mousedown", common));
  canvas.dispatchEvent(
    new PointerEvent("pointerup", {
      ...common,
      buttons: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    }),
  );
  canvas.dispatchEvent(new MouseEvent("mouseup", { ...common, buttons: 0 }));
  canvas.dispatchEvent(new MouseEvent("click", { ...common, buttons: 0 }));
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * targetPaintedPixelMap は wplace 自身が最初に1pxペイントするまで捕捉されない
 * (Map.prototype.set フックが t=(...) キーを検知して初めて発見する仕組みのため)。
 *
 * 下書き編集で「配置済みの見た目」から始めるには、seed 前にこの Map を
 * 強制的に捕捉させる必要がある。ペイントモーダル中央のキャンバスへ合成クリックを
 * 発火させ、wplace 自身のクリックハンドラに1pxペイントさせて捕捉をトリガーする。
 * 捕捉後、そのダミーピクセルは即座に削除して痕跡を残さない。
 *
 * ペイントモーダルが開いていない場合や、タイムアウトしても捕捉できない場合は false。
 */
export const ensurePaintedPixelMapCaptured = async (
  timeoutMs = 2000,
): Promise<boolean> => {
  if (targetPaintedPixelMap) return true;

  const canvas = document.querySelector<HTMLCanvasElement>(
    "canvas.maplibregl-canvas",
  );
  if (!canvas) return false;

  const beforeKeys = targetPaintedPixelMap
    ? new Set((targetPaintedPixelMap as PaintedPixelMap).keys())
    : new Set<string>();

  const rect = canvas.getBoundingClientRect();
  dispatchCanvasClickSequence(
    canvas,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );

  const deadline = Date.now() + timeoutMs;
  while (!targetPaintedPixelMap && Date.now() < deadline) {
    await delay(50);
  }
  if (!targetPaintedPixelMap) return false;

  // 合成クリックで生まれたダミーピクセルだけを特定して削除する
  const map = targetPaintedPixelMap as PaintedPixelMap;
  for (const key of map.keys()) {
    if (!beforeKeys.has(key)) {
      map.delete(key);
      break;
    }
  }

  return true;
};

/**
 * 指定した lat/lng へ合成クリックを発火し、wplace 自身のクリックハンドラに
 * 1px ペイントさせる (tile 単位で paint-preview-{tileX,tileY} レイヤーを
 * 動的生成させるためのトリガー。1px 分の charges を消費する)。
 *
 * NOTE: wplace のクリックハンドラは (lat,lng) を Map.unproject 相当の
 * 逆変換なしで直接使わず、画面座標(clientX/clientY)から map.unproject する
 * 実装のため、ここでは map.project(lngLat) で画面座標へ変換してから
 * canvas へ合成イベントを送る。
 */
export const clickAtLatLng = (
  map: { project: (lngLat: { lng: number; lat: number }) => { x: number; y: number } },
  lat: number,
  lng: number,
): boolean => {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "canvas.maplibregl-canvas",
  );
  if (!canvas) return false;

  const point = map.project({ lat, lng });
  const rect = canvas.getBoundingClientRect();
  dispatchCanvasClickSequence(canvas, rect.left + point.x, rect.top + point.y);
  return true;
};

/**
 * tileKey ("tx,ty") を末尾に持つ paint-preview-* レイヤー/source の id を
 * style から検索する。Umt のインスタンス id は起動毎に乱数を含むため、
 * サフィックス一致で判定する。
 */
export const findPaintPreviewSourceId = (
  map: { getStyle: () => { layers?: Array<{ id: string }> } | null },
  tileX: number,
  tileY: number,
): string | null => {
  const style = map.getStyle();
  const layers = style?.layers ?? [];
  const suffix = `-${tileX},${tileY}`;
  for (const layer of layers) {
    if (layer.id.startsWith("paint-preview-") && layer.id.endsWith(suffix)) {
      return layer.id;
    }
  }
  return null;
};

/**
 * 指定タイルの paint-preview canvas へ複数ピクセルを直接描画し、再生させる。
 *
 * 背景: paint-preview の実体は tile 単位の ImageSource で、内部 canvas は
 * (0,0) がタイル "左下" に対応する (Y軸反転)。wplace 本体のコードでも
 * `tileSize - pixelY - 1` という式で変換しており、それに倣う。
 *
 * この関数は source が既に存在するタイルにのみ使える (未生成なら false)。
 * source の動的生成は wplace 自身の1pxペイント (clickAtLatLng) でのみ行える。
 */
export const fillPaintPreviewTile = (
  map: { getSource: (id: string) => any; getStyle: () => any },
  tileX: number,
  tileY: number,
  pixels: Array<{ pixelX: number; pixelY: number; r: number; g: number; b: number }>,
  tileSize = 1000,
): boolean => {
  const sourceId = findPaintPreviewSourceId(map, tileX, tileY);
  if (!sourceId) return false;

  const source = map.getSource(sourceId);
  const canvas: HTMLCanvasElement | undefined = source?.options?.canvas;
  if (!canvas) return false;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  for (const pixel of pixels) {
    ctx.fillStyle = `rgb(${pixel.r},${pixel.g},${pixel.b})`;
    // Y軸反転: canvas (0,0) はタイル左下に対応する
    ctx.fillRect(pixel.pixelX, tileSize - pixel.pixelY - 1, 1, 1);
  }

  source.play?.();
  return true;
};

export const stopPaintedCoordinatesCapture = (): void => {
  if (
    !isCaptureEnabled ||
    !originalMapSet ||
    !originalMapDelete ||
    !originalMapClear
  )
    return;

  Map.prototype.set = originalMapSet;
  Map.prototype.delete = originalMapDelete;
  Map.prototype.clear = originalMapClear;
  teardownPaintModalObserver();

  targetPaintedPixelMap = null;
  isCaptureEnabled = false;
  console.log("🧑‍🎨 : Painted coordinates capture disabled");
};
