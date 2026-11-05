type DomChangeListener = () => void;

const listeners = new Set<DomChangeListener>();
let observer: MutationObserver | null = null;
let scheduled = false;

const flush = (): void => {
  scheduled = false;
  // listener 内で unsubscribe されても安全なようにスナップショットで回す
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.warn("🧑‍🎨 : DOM change listener error:", error);
    }
  }
};

const schedule = (): void => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(flush);
};

/**
 * document.body 配下の childList 変化を購読する。
 * MutationObserver は全購読者で1本だけ共有し、通知は1フレーム1回にまとめる
 * (rAF は描画前に走るので、要素の非表示などもちらつかずに間に合う)。
 *
 * @returns 購読解除関数
 */
export const onDomChange = (listener: DomChangeListener): (() => void) => {
  listeners.add(listener);
  if (!observer) {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || !observer) return;
    observer.disconnect();
    observer = null;
  };
};
