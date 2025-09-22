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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path fill-rule="evenodd" d="M3 4.5a.75.75 0 01.75-.75h16.5a.75.75 0 01.75.75v2.25a.75.75 0 01-.22.53l-6.28 6.28v4.44a.75.75 0 01-.33.62l-3 2a.75.75 0 01-1.17-.62v-6.44l-6.28-6.28A.75.75 0 013 6.75V4.5z" clip-rule="evenodd"/>
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
