import { setupElementObserver } from "@/components/element-observer";
import { storage } from "@/utils/browser-api";
import { subscribePaintMode } from "@/utils/paint-mode";
import { t } from "@/i18n";
import { ensureStyle } from "@/utils/style";

/**
 * Palette Expand
 *
 * ペイントパネルのカラーパレットのスクロール制限を外し、全色を一度に表示する。
 * トグルボタンは左上のズーム (+/-) グループの直後に置く。
 * (ズームグループは mobile で max-sm:hidden なので、直後に置けば mobile でも表示される)
 * DOMは触らず、html要素のクラス切り替え + CSSのみで実現する
 */

const BUTTON_ID = "mr-wplace-palette-expand-btn";
const STYLE_ID = "mr-wplace-palette-expand-style";
const ROOT_CLASS = "mr-wplace-palette-expanded";
/** Svelte の class 再描画で消えないよう data 属性で印を付ける */
const UNCLAMP_ATTR = "data-mr-palette-unclamp";
const STORAGE_KEY = "mr_wplace_palette_expand";

const CSS = `
.${ROOT_CLASS}{--paint-palette-max-height:none;}
.${ROOT_CLASS} .paint-palette-scroll{max-height:none !important;}
/* 640-1279px: grid-cols-16 固定 + swatch の最小幅で横にはみ出すので、幅に応じて折り返す */
@media (min-width: 640px) and (max-width: 1279px){
  .${ROOT_CLASS} .paint-palette{grid-template-columns:repeat(auto-fill,minmax(2.25rem,1fr)) !important;}
  .${ROOT_CLASS} .paint-swatch,
  .${ROOT_CLASS} .paint-palette .game-color-swatch{min-width:0 !important;}
}
/* mobile: 全色が縦に並ぶので swatch を平たくして高さを抑える */
@media (max-width: 639px){
  .${ROOT_CLASS} .paint-palette{gap:3px !important;}
  .${ROOT_CLASS} .paint-swatch,
  .${ROOT_CLASS} .paint-palette .game-color-swatch{height:1.5rem !important;min-height:0 !important;aspect-ratio:auto !important;}
}
.${ROOT_CLASS} [${UNCLAMP_ATTR}]{max-height:none !important;height:auto !important;overflow:visible !important;}
`;

const isScrollable = (overflowY: string) =>
  overflowY !== "visible" && overflowY !== "clip";

/**
 * パレット自身〜 floating panel までの高さ制限/スクロールを外す。
 * 下から順に外すことで、外した結果あふれた親も検出できる
 */
const unclampAncestors = (): void => {
  let el = document.querySelector<HTMLElement>(".paint-palette-scroll");
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    if (cs.maxHeight !== "none" || (isScrollable(cs.overflowY) && overflowing)) {
      el.setAttribute(UNCLAMP_ATTR, "");
      console.log("🧑‍🎨 : palette-expand unclamp", el.className);
    }
    if (cs.position === "fixed" || cs.position === "absolute") break;
    el = el.parentElement;
  }
};

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4"><path d="M3 3h5v5H3zM10 3h4v5h-4zM16 3h5v5h-5zM3 10h5v4H3zM10 10h4v4h-4zM16 10h5v4h-5zM3 16h5v5H3zM10 16h4v5h-4zM16 16h5v5h-5z"/></svg>`;

/** paint mode 中の左上ズームグループ (+/- ボタンを持つ div) */
const findZoomGroup = (): Element | null => {
  if (!document.querySelector(".paint-palette")) return null;
  for (const button of document.querySelectorAll("button.btn-circle")) {
    if (button.textContent?.trim() !== "+") continue;
    const group = button.parentElement;
    if (group?.querySelector(":scope > button:nth-of-type(2)")?.textContent?.trim() === "-")
      return group;
  }
  return null;
};

export class PaletteExpand {
  private enabled = false;

  constructor() {
    ensureStyle(STYLE_ID, CSS);

    void storage.get(STORAGE_KEY).then((result) => this.apply(!!result[STORAGE_KEY]));

    setupElementObserver([
      {
        id: BUTTON_ID,
        getTargetElement: findZoomGroup,
        createElement: (group) => {
          group.after(this.createButton());
          // paint mode 突入時 = パネル再描画時なので、ここで祖先の制限も外す
          if (this.enabled) unclampAncestors();
        },
      },
    ]);

    subscribePaintMode((active) => {
      const button = document.getElementById(BUTTON_ID);
      // .btn の display が [hidden] に勝つため style で切り替える
      if (button) button.style.display = active ? "" : "none";
      // パネルは paint mode 突入ごとに再生成されるので、描画後に印を付け直す
      if (active && this.enabled) requestAnimationFrame(unclampAncestors);
    });
  }

  private createButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "btn btn-sm btn-circle";
    button.title = t("palette_show_all_colors");
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(this.enabled));
    button.innerHTML = ICON;
    button.addEventListener("click", () => {
      this.apply(!this.enabled);
      void storage.set({ [STORAGE_KEY]: this.enabled });
    });
    return button;
  }

  private apply(enabled: boolean): void {
    this.enabled = enabled;
    document.documentElement.classList.toggle(ROOT_CLASS, enabled);
    if (enabled) unclampAncestors();
    document.getElementById(BUTTON_ID)?.setAttribute("aria-pressed", String(enabled));
  }
}
