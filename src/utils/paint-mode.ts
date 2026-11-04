import { findPaintPixelControls } from "@/constants/selectors";

type PaintModeListener = (active: boolean) => void;

const listeners = new Set<PaintModeListener>();
let observer: MutationObserver | null = null;
let scheduled = false;
let attrObserver: MutationObserver | null = null;
let active = false;

/** paint modal (Paint pixel) が開いているか (DOMに残っていても非表示なら false) */
export const isPaintModeActive = (): boolean => {
  const controls = findPaintPixelControls();
  return !!controls && controls.getClientRects().length > 0;
};

const notify = (): void => {
  const next = isPaintModeActive();
  if (next === active) return;

  active = next;
  syncAttrObserver();
  for (const listener of [...listeners]) {
    try {
      listener(active);
    } catch (error) {
      console.warn("🧑‍🎨 : Paint mode listener error:", error);
    }
  }
};

/** 属性変化(class/hidden/style)の監視はペイントモード中のみ。負荷を抑える */
const syncAttrObserver = (): void => {
  if (!active || !observer) {
    attrObserver?.disconnect();
    attrObserver = null;
    return;
  }
  if (attrObserver) return;
  attrObserver = new MutationObserver(schedule);
  attrObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "hidden", "style"],
    subtree: true,
  });
};

const schedule = (): void => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    notify();
  });
};

/**
 * paint modal の開閉を購読する
 * MutationObserverは全購読者で1本のみ共有する
 *
 * @param listener 状態が変化したときに呼ばれる
 * @param immediate 購読時に現在の状態で1回呼ぶ (default: true)
 * @returns 購読解除関数
 */
export const subscribePaintMode = (
  listener: PaintModeListener,
  immediate = true,
): (() => void) => {
  if (!observer) {
    active = isPaintModeActive();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    syncAttrObserver();
  }

  listeners.add(listener);
  if (immediate) listener(active);

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;

    observer?.disconnect();
    observer = null;
    syncAttrObserver();
    scheduled = false;
  };
};
