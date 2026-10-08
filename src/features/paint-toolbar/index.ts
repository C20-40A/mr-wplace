import { setupElementObserver } from "@/components/element-observer";
import { findPaintPixelControls } from "@/constants/selectors";
import { subscribePaintMode } from "@/utils/paint-mode";
import { ensureStyle } from "@/utils/style";

export const PAINT_TOOLBAR_ID = "mr-wplace-paint-toolbar";
const PAINT_MODE_CLASS = "mr-wplace-paint-mode";
/** mobile mode = toolbar が独立 floating 表示されている状態 (desktop の inject 先が見つからない場合) */
export const PAINT_TOOLBAR_FALLBACK_CLASS = "mr-wplace-paint-toolbar-fallback";
const STYLE_ID = "mr-wplace-paint-toolbar-style";

/** paint mode 中だけ表示される拡張ボタンのコンテナ */
export const getPaintToolbarContainer = (): HTMLElement | null =>
  document.getElementById(PAINT_TOOLBAR_ID);

const ensureStyles = (): void => {
  // フォールバック時だけ上部の既存UIと重なるため、それらを隠す。
  // ボタンが1つも入らなかった場合は空の箱を見せない。
  ensureStyle(STYLE_ID, `
    .${PAINT_MODE_CLASS}.${PAINT_TOOLBAR_FALLBACK_CLASS} #user-status-container{display:none !important;}
    .${PAINT_MODE_CLASS}.${PAINT_TOOLBAR_FALLBACK_CLASS} #dev-trigger-btn{display:none !important;}
    #${PAINT_TOOLBAR_ID}:empty{display:none;}.mr-paint-tb-item{position:relative;display:inline-flex;}.btn.mr-paint-tb-btn{flex-direction:column;gap:1px;padding:0;}.mr-paint-tb-btn svg{width:20px !important;height:20px !important;}.mr-paint-tb-label{font-size:8px;line-height:9px;font-weight:600;letter-spacing:-.02em;white-space:nowrap;pointer-events:none;}.mr-template-percent{position:absolute;bottom:1px;left:2px;right:2px;z-index:1;font-size:8px;font-weight:700;line-height:9px;color:white;background:rgba(0,0,0,.65);border-radius:4px;text-align:center;}.mr-template-thumb{width:28px;height:19px;margin-bottom:2px;object-fit:cover;border-radius:4px;background:var(--color-base-300);display:block;}.mr-template-menu{position:absolute;top:calc(100% + 6px);left:0;width:190px;max-height:220px;overflow-y:auto;padding:4px;background:var(--color-base-100);border:1px solid rgba(0,0,0,.15);border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.2);z-index:31;text-align:left;}.mr-template-menu-up{top:auto;bottom:calc(100% + 6px);}.mr-template-menu-item{width:100%;display:flex;align-items:center;gap:7px;padding:4px;border-radius:5px;background:transparent;border:0;color:inherit;text-align:left;font-size:11px;}.mr-template-menu-item:hover{background:var(--color-base-200);}.mr-template-menu-item img{width:30px;height:24px;object-fit:cover;border-radius:3px;background:var(--color-base-300);flex:none;}.mr-template-menu-item span{min-width:0;display:flex;flex-direction:column;}.mr-template-menu-progress{font-size:13px;line-height:15px;font-weight:700;}.mr-template-menu-title{font-size:9px;line-height:11px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.mr-template-menu-meter{display:none;width:100px;height:3px;margin-top:2px;overflow:hidden;border-radius:2px;background:var(--color-base-300);}.mr-template-menu-meter b{display:block;height:100%;background:var(--color-primary);transition:width .2s ease;}
  `);
};

const findDesktopRedoTooltip = (): HTMLElement | null => {
  if (!window.matchMedia("(min-width: 640px)").matches) return null;

  const redo = document.querySelector<HTMLButtonElement>(
    '.paint-toolbar .paint-tools button[aria-label="Redo"], .paint-toolbar .paint-tools button[title="Redo"]',
  );
  return redo?.closest<HTMLElement>(".tooltip") ?? null;
};

const createToolbar = (): HTMLElement => {
  const toolbar = document.createElement("div");
  toolbar.id = PAINT_TOOLBAR_ID;

  const redoTooltip = findDesktopRedoTooltip();
  if (redoTooltip) {
    document.documentElement.classList.remove(PAINT_TOOLBAR_FALLBACK_CLASS);
    toolbar.style.cssText =
      "display:flex;align-items:center;gap:2px;margin-left:2px;pointer-events:all;";
    redoTooltip.after(toolbar);
    return toolbar;
  }

  document.documentElement.classList.add(PAINT_TOOLBAR_FALLBACK_CLASS);
  // wplace の panel 用 class (game UI 時は自動で bevel 枠になる)
  toolbar.className =
    "game-panel-surface bg-base-100 border-base-300 rounded-box border shadow-xl";
  toolbar.style.cssText = `
    position: absolute;
    top: 5px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    pointer-events: all;
    padding: 4px 8px;
    z-index: 30;
  `;
  document.body.appendChild(toolbar);
  return toolbar;
};

export interface PaintToolbarButtonConfig {
  id: string;
  /** tooltip 文言 (下方向に表示) */
  tip: string;
  /** button.innerHTML に入れる svg */
  icon: string;
  /** アイコン下に表示する極小ラベル (英語1単語) */
  label?: string;
  className?: string;
  /** ON/OFF を持つボタンのみ指定。生成時の見た目に反映される */
  isActive?: () => boolean;
  onClick: () => void;
  /** バッジ追加や hint 表示など、生成直後の追加処理 */
  onCreate?: (button: HTMLButtonElement) => void;
}

// wplace 公式の toggle ボタンと同じ class
const DEFAULT_BUTTON_CLASS = "btn btn-circle btn-ghost sm:btn-sm size-11 shrink-0";

export const PAINT_TOOLBAR_ITEM_CLASS = "mr-paint-tb-item";

/** ON/OFF 状態を反映する (見た目は公式同様 aria-pressed に任せる) */
export const setPaintToolbarButtonActive = (
  button: HTMLButtonElement,
  active: boolean,
): void => {
  button.setAttribute("aria-pressed", String(active));
};

/** ツールバーへアイコンボタンを登録する (ツールバー再生成時も自動で復元) */
export const registerPaintToolbarButton = ({
  id,
  tip,
  icon,
  label,
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
        // menu 等の position 基準 & 並び替え単位の wrapper (tooltip は公式同様 title で出す)
        const item = document.createElement("div");
        item.className = PAINT_TOOLBAR_ITEM_CLASS;

        const button = document.createElement("button");
        button.id = id;
        button.type = "button";
        button.title = tip;
        button.setAttribute("aria-label", tip);
        // ラベル付きは縦並び (icon + label)。サイズは公式 class に従う
        button.className = label ? `${className} mr-paint-tb-btn` : className;
        button.innerHTML = label
          ? `${icon}<span class="mr-paint-tb-label">${label}</span>`
          : icon;
        if (!label) button.querySelector("svg")?.classList.add("size-5");
        button.addEventListener("click", onClick);
        if (isActive) setPaintToolbarButtonActive(button, isActive());

        item.appendChild(button);
        container.appendChild(item);
        onCreate?.(button);
      },
    },
  ]);
};

export class PaintToolbar {
  private unsubscribe: (() => void) | null = null;

  constructor() {
    ensureStyles();
    setupElementObserver([
      {
        id: PAINT_TOOLBAR_ID,
        getTargetElement: () =>
          findPaintPixelControls() ? document.body : null,
        createElement: () => {
          createToolbar();
          console.log("🧑‍🎨 : Paint toolbar created");
        },
      },
    ]);
    this.unsubscribe = subscribePaintMode((active) => {
      document.documentElement.classList.toggle(PAINT_MODE_CLASS, active);
      if (!active) {
        document.documentElement.classList.remove(PAINT_TOOLBAR_FALLBACK_CLASS);
        document.getElementById(PAINT_TOOLBAR_ID)?.remove();
      }
    });
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    document.documentElement.classList.remove(PAINT_MODE_CLASS);
    document.documentElement.classList.remove(PAINT_TOOLBAR_FALLBACK_CLASS);
    document.getElementById(PAINT_TOOLBAR_ID)?.remove();
  }
}
