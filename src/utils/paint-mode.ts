import { findPaintPixelControls } from "@/constants/selectors";

type PaintModeListener = (active: boolean) => void;

const listeners = new Set<PaintModeListener>();
let observer: MutationObserver | null = null;
let scheduled = false;
let active = false;

/** paint modal (Paint pixel) が開いているか */
export const isPaintModeActive = (): boolean => !!findPaintPixelControls();

const notify = (): void => {
  const next = isPaintModeActive();
  if (next === active) return;

  active = next;
  for (const listener of [...listeners]) {
    try {
      listener(active);
    } catch (error) {
      console.warn("🧑‍🎨 : Paint mode listener error:", error);
    }
  }
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
  }

  listeners.add(listener);
  if (immediate) listener(active);

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;

    observer?.disconnect();
    observer = null;
    scheduled = false;
  };
};
