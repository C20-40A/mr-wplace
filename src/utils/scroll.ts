/**
 * ネイティブのスクロールが効かない環境(一部の Android Firefox 等)向けの保険。
 *
 * 設計方針: 正常な環境の挙動を一切変えない。
 * - ジェスチャー中は常にネイティブに任せ、こちらからは動かさない。
 * - 「スクロールの余地があるのに、1 回のジェスチャーで scrollTop が動かなかった」
 *   ときだけ「壊れている」と判定して latch する。
 * - latch 後だけ手動で scrollTop を動かす。
 * - ネイティブが動く環境では scrollTop が変わるので latch しない
 *   (= 二重スクロールは起きない)。
 */

// タップ判定のスロップ(概ね 10px 前後)を確実に超える値にして、
// 「タップ時のわずかな指のズレ」を誤検知しないようにする。
const MIN_GESTURE_PX = 16;
const WHEEL_IDLE_MS = 160;

/** このセッションで「ネイティブスクロールが壊れている」と判定したか */
let nativeScrollBroken = false;

const findScrollableAncestor = (el: HTMLElement): HTMLElement | null => {
  let cur: HTMLElement | null = el;
  while (cur) {
    if (cur.scrollHeight > cur.clientHeight + 1) return cur;
    cur = cur.parentElement;
  }
  return null;
};

const canScrollFurther = (el: HTMLElement, delta: number): boolean => {
  if (delta > 0) return el.scrollTop < el.scrollHeight - el.clientHeight - 1;
  if (delta < 0) return el.scrollTop > 1;
  return false;
};

/**
 * グリッド等の item 上でネイティブスクロールが効かない環境向けのフォールバックを仕込む。
 * 正常環境では何も起きない。
 *
 * @param root アイテムを含む要素 (スクロールコンテナの子孫であること)
 * @param itemSelector ジェスチャー対象となるアイテムのセレクタ
 */
export const attachScrollFallback = (
  root: HTMLElement,
  itemSelector: string,
): void => {
  const scroller = findScrollableAncestor(root);
  if (!scroller) return;

  root.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => {
    let gestureStartTop = scroller.scrollTop;
    let gestureDelta = 0;
    let lastTouchY = 0;
    let wheelTimer: number | undefined;

    const detectBroken = () => {
      if (
        !nativeScrollBroken &&
        Math.abs(gestureDelta) >= MIN_GESTURE_PX &&
        canScrollFurther(scroller, gestureDelta) &&
        scroller.scrollTop === gestureStartTop
      ) {
        nativeScrollBroken = true;
      }
      gestureDelta = 0;
    };

    // デスクトップ: wheel
    item.addEventListener(
      "wheel",
      (e) => {
        const delta = (e as WheelEvent).deltaY;
        if (!delta) return;

        if (nativeScrollBroken) {
          scroller.scrollTop += delta;
          return;
        }

        if (wheelTimer === undefined) {
          gestureStartTop = scroller.scrollTop;
          gestureDelta = 0;
        }
        gestureDelta += delta;
        window.clearTimeout(wheelTimer);
        wheelTimer = window.setTimeout(detectBroken, WHEEL_IDLE_MS);
      },
      { passive: true },
    );

    // モバイル: touch
    item.addEventListener(
      "touchstart",
      (e) => {
        lastTouchY = (e as TouchEvent).touches[0].clientY;
        if (nativeScrollBroken) return;
        gestureStartTop = scroller.scrollTop;
        gestureDelta = 0;
      },
      { passive: true },
    );

    item.addEventListener(
      "touchmove",
      (e) => {
        const y = (e as TouchEvent).touches[0].clientY;
        const delta = lastTouchY - y;
        lastTouchY = y;

        if (nativeScrollBroken) {
          scroller.scrollTop += delta;
          return;
        }
        gestureDelta += delta;
      },
      { passive: true },
    );

    item.addEventListener("touchend", detectBroken, { passive: true });
    item.addEventListener("touchcancel", detectBroken, { passive: true });
  });
};
