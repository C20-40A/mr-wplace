import { findPositionModal } from "@/constants/selectors";
import { WplaceMap } from "@/inject/types";

/*
 * map instance 捕捉 (2段構え)
 * 1. constructor hook (推奨・クリック不要):
 *    maplibre の HandlerManager は Map 生成中に `map.touchZoomRotate = handler` と
 *    「代入」する (class field 定義ではない)。Object.prototype に同名 setter を一時的に生やすと、
 *    その代入で setter が this = map instance で呼ばれる。inject が map 生成より先に動いた時に有効。
 * 2. fallback: Map.prototype.values hook + 疑似クリック (inject が map 生成に間に合わなかった時)
 */
const HOOK_KEY = "touchZoomRotate";
let constructedMap: WplaceMap | null = null;

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 疑似クリックで開いた pixel 選択パネルを閉じる (公式は keydown Escape で onclose する) */
const closeSelectedPixelPanel = () => {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }),
  );
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

const removeConstructorHook = () => {
  const desc = Object.getOwnPropertyDescriptor(Object.prototype, HOOK_KEY);
  if (desc?.set) delete (Object.prototype as Record<string, unknown>)[HOOK_KEY];
};

/** inject 起動直後 (同期) に呼ぶ。map 生成時の代入を横取りして instance を記録する */
export const installMapConstructorHook = (): void => {
  if (HOOK_KEY in Object.prototype) return;
  Object.defineProperty(Object.prototype, HOOK_KEY, {
    configurable: true,
    get: () => undefined,
    set(this: object, value: unknown) {
      // 本来の代入結果を own property として復元する
      Object.defineProperty(this, HOOK_KEY, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      if (!isMapLike(this)) return;
      constructedMap = this;
      removeConstructorHook();
      console.log("🧑‍🎨 : Map instance captured via constructor hook");
    },
  });
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

/** canvas 出現 (= Map constructor 実行済み) まで待ち、constructor hook の結果を返す */
const waitForConstructedMap = async (): Promise<WplaceMap | null> => {
  for (let i = 0; i < 100 && !constructedMap; i++) {
    if (document.querySelector("canvas.maplibregl-canvas")) break;
    await delay(100);
  }
  removeConstructorHook();
  return constructedMap;
};

export const resolveMapInstanceAsync = async (): Promise<
  WplaceMap | undefined
> => {
  const constructed = await waitForConstructedMap();
  if (constructed) return constructed;
  console.log("🧑‍🎨 : Constructor hook missed, falling back to click capture");

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
        closeSelectedPixelPanel();
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
