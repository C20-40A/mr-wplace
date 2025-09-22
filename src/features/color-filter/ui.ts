import { t } from "../../i18n/manager";
import { ColorFilterRouter } from "./router";
import { BaseModalUI, ModalConfig } from "../../components/base-modal-ui";

// 新しいFABボタン（丸い・SVGのみ）
export const createColorFilterFAB = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "color-filter-fab-btn";
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"color_filter"}`;
  button.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="size-5">
  <!-- 漏斗（下に下げる） -->
  <path d="M3 13h18l-6.5 5v3.5l-4 2.5v-6L3 13z" 
        stroke-width="1.5" stroke-linejoin="round"/>
  <!-- 水滴（上に上げる & 大きめ） -->
  <path d="M12 0c-2 2.8-3.5 5-3.5 7a3.5 3.5 0 007 0c0-2-1.5-4.2-3.5-7z" 
        stroke="black" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
    `;
  return button;
};

export class ColorFilterModal extends BaseModalUI<ColorFilterRouter> {
  getModalConfig(): ModalConfig {
    return {
      id: "wplace-studio-color-filter-modal",
      title: t`${"color_filter"}`,
    };
  }
}
