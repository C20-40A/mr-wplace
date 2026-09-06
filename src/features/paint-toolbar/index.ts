import { subscribePaintMode } from "@/utils/paint-mode";

export const PAINT_TOOLBAR_ID = "mr-wplace-paint-toolbar";
const PAINT_MODE_CLASS = "mr-wplace-paint-mode";
const STYLE_ID = "mr-wplace-paint-toolbar-style";

/**
 * paint mode 中だけ表示されるフローティングツールバー
 * 位置は user-status-container と同じ (上部中央)
 *
 * paint modal 内へ直接ボタンを差し込む代わりに、
 * 各featureはこのコンテナを getTargetElement に指定して集約する
 */
export const getPaintToolbarContainer = (): HTMLElement | null =>
  document.getElementById(PAINT_TOOLBAR_ID);

const ensureStyles = (): void => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  // paint mode 中は user-status を隠し、その位置をツールバーが引き継ぐ
  // ボタンが1つも入らなかった場合は空の箱を見せない
  style.textContent = `
    .${PAINT_MODE_CLASS} #user-status-container{display:none !important;}
    #${PAINT_TOOLBAR_ID}:empty{display:none;}
  `;
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
  private unsubscribe: (() => void) | null = null;

  constructor() {
    ensureStyles();
    this.unsubscribe = subscribePaintMode((active) =>
      active ? this.activate() : this.deactivate(),
    );
  }

  private activate(): void {
    document.documentElement.classList.add(PAINT_MODE_CLASS);
    if (getPaintToolbarContainer()) return;

    document.body.appendChild(createToolbar());
    console.log("🧑‍🎨 : Paint toolbar created");
  }

  private deactivate(): void {
    document.documentElement.classList.remove(PAINT_MODE_CLASS);
    getPaintToolbarContainer()?.remove();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.deactivate();
  }
}
