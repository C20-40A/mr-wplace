import { findPaintPixelControls } from "@/constants/selectors";

export const PAINT_TOOLBAR_ID = "mr-wplace-paint-toolbar";
const USER_STATUS_ID = "user-status-container";

/**
 * paint mode 中だけ表示されるフローティングツールバー
 * 位置は user-status-container と同じ (上部中央)
 *
 * paint modal 内へ直接ボタンを差し込む代わりに、
 * 各featureはこのコンテナを getTargetElement に指定して集約する
 */
export const getPaintToolbarContainer = (): HTMLElement | null =>
  document.getElementById(PAINT_TOOLBAR_ID);

const STYLE_ID = "mr-wplace-paint-toolbar-style";

/** ボタンが1つも入らなかった場合に空の箱が見えないようにする */
const ensureStyles = (): void => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `#${PAINT_TOOLBAR_ID}:empty{display:none;}`;
  (document.head || document.documentElement).appendChild(style);
};

const createToolbar = (): HTMLElement => {
  const toolbar = document.createElement("div");
  toolbar.id = PAINT_TOOLBAR_ID;
  toolbar.style.cssText = `
    position: absolute;
    top: 5px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    pointer-events: all;
    background-color: var(--color-base-100);
    border-radius: 12px;
    padding: 2px 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.1);
    z-index: 30;
  `;
  return toolbar;
};

export class PaintToolbar {
  private observer: MutationObserver | null = null;
  private active = false;

  constructor() {
    ensureStyles();
    this.observer = new MutationObserver(() => this.check());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.check();
  }

  private check(): void {
    const inPaintMode = !!findPaintPixelControls();
    if (inPaintMode === this.active) return;

    if (inPaintMode) {
      this.activate();
      return;
    }
    this.deactivate();
  }

  private activate(): void {
    this.active = true;

    const userStatus = document.getElementById(USER_STATUS_ID);
    if (userStatus) userStatus.style.display = "none";

    if (!getPaintToolbarContainer()) {
      document.body.appendChild(createToolbar());
      console.log("🧑‍🎨 : Paint toolbar created");
    }
  }

  private deactivate(): void {
    this.active = false;

    getPaintToolbarContainer()?.remove();

    const userStatus = document.getElementById(USER_STATUS_ID);
    if (userStatus) userStatus.style.display = "";
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.deactivate();
  }
}
