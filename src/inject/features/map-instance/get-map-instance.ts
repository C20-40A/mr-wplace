import { findPositionModal } from "@/constants/selectors";
import { WplaceMap } from "@/inject/types";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const clickPositionModalCloseButton = () => {
  const positionModalElement = findPositionModal();
  if (!positionModalElement) return;

  const closeButton = positionModalElement.querySelector<HTMLButtonElement>(
    'button:has(path[d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"])',
  );

  closeButton?.click();
};

const isMapLike = (value: unknown): value is WplaceMap => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<WplaceMap>;

  return (
    typeof candidate.flyTo === "function" &&
    // flyToだけだと偽陽性があり得るので増やす
    typeof (candidate as any).getCenter === "function" &&
    typeof (candidate as any).getZoom === "function"
  );
};

const findMapRecursively = (
  value: unknown,
  visited = new WeakSet<object>(),
  depth = 0,
): WplaceMap | null => {
  if (isMapLike(value)) return value;
  if (!value || typeof value !== "object") return null;
  if (depth > 3) return null;

  const object = value as object;

  if (visited.has(object)) return null;
  visited.add(object);

  if (Array.isArray(value) || value instanceof Set) {
    for (const child of value) {
      const found = findMapRecursively(child, visited, depth + 1);
      if (found) return found;
    }

    return null;
  }

  if (value instanceof Map) {
    for (const child of value.values()) {
      const found = findMapRecursively(child, visited, depth + 1);
      if (found) return found;
    }

    return null;
  }

  for (const key of Reflect.ownKeys(value)) {
    let child: unknown;

    try {
      child = Reflect.get(value, key);
    } catch {
      continue;
    }

    const found = findMapRecursively(child, visited, depth + 1);
    if (found) return found;
  }

  return null;
};

const dispatchMapClickSequence = (canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect();

  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

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

  canvas.dispatchEvent(
    new MouseEvent("mouseup", {
      ...common,
      buttons: 0,
    }),
  );

  canvas.dispatchEvent(
    new MouseEvent("click", {
      ...common,
      buttons: 0,
    }),
  );
};

export const resolveMapInstanceAsync = async (): Promise<
  WplaceMap | undefined
> => {
  let mapInstance: WplaceMap | null = null;

  const originalValues = Map.prototype.values;
  const originalEntries = Map.prototype.entries;

  let restored = false;

  const restore = () => {
    if (restored) return;
    restored = true;

    Map.prototype.values = originalValues;
  };

  Map.prototype.values = function <K, V>(this: Map<K, V>): MapIterator<V> {
    /*
     * originalEntriesを使うことで、上書きしたvaluesを再帰的に
     * 呼ばず、呼び出し元に返すIteratorも消費しない。
     */
    const entries = originalEntries.call(this) as MapIterator<[K, V]>;

    for (const [, value] of entries) {
      const found = findMapRecursively(value);

      if (found) {
        mapInstance = found;
        restore();
        break;
      }
    }

    return originalValues.call(this) as MapIterator<V>;
  };

  try {
    for (let i = 0; i < 8; i++) {
      await delay(300 + i * 200);

      if (mapInstance) {
        console.log("🧑‍🎨 Map instance found:", mapInstance);
        clickPositionModalCloseButton();
        return mapInstance;
      }

      const canvas = document.querySelector<HTMLCanvasElement>(
        "canvas.maplibregl-canvas",
      );

      if (!canvas) {
        console.debug("Map canvas has not been created yet");
        continue;
      }

      dispatchMapClickSequence(canvas);
    }

    console.warn("Map instance was not captured", {
      canvas: document.querySelector("canvas.maplibregl-canvas"),
      positionModal: findPositionModal(),
    });

    return undefined;
  } finally {
    restore();
  }
};

export const getMapInstanceFromWplace = (): WplaceMap | null => {
  return window.mrWplace?.wplaceMap || null;
};
