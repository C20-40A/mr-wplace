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
type PaintSessionListener = (active: boolean) => void;
let paintSessionListener: PaintSessionListener | null = null;

export const setPaintListener = (listener: PaintListener | null): void => {
  paintListener = listener;
};

export const setPaintSessionListener = (
  listener: PaintSessionListener | null
): void => {
  paintSessionListener = listener;
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
};

const handleDelete = (mapRef: unknown, key: unknown): void => {
  if (mapRef !== targetPaintedPixelMap) return;
  if (!isTargetKey(key)) return;
  deleteCapturedCoordinate(key);
  exposeCaptureState({ mapRef: targetPaintedPixelMap });
};

const handleClear = (mapRef: unknown): void => {
  if (mapRef !== targetPaintedPixelMap) return;
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
