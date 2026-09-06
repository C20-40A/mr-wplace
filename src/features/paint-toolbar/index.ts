import { setupElementObserver } from "@/components/element-observer";
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
  // developer trigger はツールバーと重なるため paint mode 中は隠す
  // ボタンが1つも入らなかった場合は空の箱を見せない
  style.textContent = `
    .${PAINT_MODE_CLASS} #user-status-container{display:none !important;}
    .${PAINT_MODE_CLASS} #dev-trigger-btn{display:none !important;}
    #${PAINT_TOOLBAR_ID}:empty{display:none;}.mr-template-percent{position:absolute;top:1px;left:2px;right:2px;z-index:1;font-size:8px;font-weight:700;line-height:10px;color:white;background:rgba(0,0,0,.65);border-radius:4px;text-align:center;}.mr-template-thumb{width:28px;height:20px;margin-top:9px;object-fit:cover;border-radius:4px;background:var(--color-base-300);display:block;}.mr-template-menu{position:absolute;top:calc(100% + 6px);left:0;width:190px;max-height:220px;overflow-y:auto;padding:4px;background:var(--color-base-100);border:1px solid rgba(0,0,0,.15);border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.2);z-index:31;text-align:left;}.mr-template-menu-item{width:100%;display:flex;align-items:center;gap:7px;padding:4px;border-radius:5px;background:transparent;border:0;color:inherit;text-align:left;font-size:11px;}.mr-template-menu-item:hover{background:var(--color-base-200);}.mr-template-menu-item img{width:30px;height:24px;object-fit:cover;border-radius:3px;background:var(--color-base-300);flex:none;}.mr-template-menu-item span{min-width:0;display:flex;flex-direction:column;}.mr-template-menu-progress{font-size:13px;line-height:15px;font-weight:700;}.mr-template-menu-title{font-size:9px;line-height:11px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.mr-template-menu-meter{display:none;width:100px;height:3px;margin-top:2px;overflow:hidden;border-radius:2px;background:var(--color-base-300);}.mr-template-menu-meter b{display:block;height:100%;background:var(--color-primary);transition:width .2s ease;}
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

export interface PaintToolbarButtonConfig {
  id: string;
  /** tooltip 文言 (下方向に表示) */
  tip: string;
  /** button.innerHTML に入れる svg */
  icon: string;
  className?: string;
  /** ON/OFF を持つボタンのみ指定。生成時の見た目に反映される */
  isActive?: () => boolean;
  onClick: () => void;
  /** バッジ追加や hint 表示など、生成直後の追加処理 */
  onCreate?: (button: HTMLButtonElement) => void;
}

const DEFAULT_BUTTON_CLASS = "btn btn-sm btn-circle btn-ghost";

/** ON/OFF ボタンの見た目を切り替える */
export const setPaintToolbarButtonActive = (
  button: HTMLButtonElement,
  active: boolean,
): void => {
  button.classList.toggle("text-primary", active);
  button.classList.toggle("text-base-content", !active);
  button.style.opacity = active ? "1" : "0.5";
};

/** ツールバーへアイコンボタンを登録する (ツールバー再生成時も自動で復元) */
export const registerPaintToolbarButton = ({
  id,
  tip,
  icon,
  className = DEFAULT_BUTTON_CLASS,
  isActive,
  onClick,
  onCreate,
}: PaintToolbarButtonConfig): void => {
  setupElementObserver([
    {
      id,
      getTargetElement: getPaintToolbarContainer,
      createElement: (container) => {
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip tooltip-bottom";
        tooltip.setAttribute("data-tip", tip);

        const button = document.createElement("button");
        button.id = id;
        button.type = "button";
        button.className = className;
        button.style.transition = "opacity 0.2s ease";
        button.innerHTML = icon;
        button.addEventListener("click", onClick);
        if (isActive) setPaintToolbarButtonActive(button, isActive());

        tooltip.appendChild(button);
        container.appendChild(tooltip);
        onCreate?.(button);
      },
    },
  ]);
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
