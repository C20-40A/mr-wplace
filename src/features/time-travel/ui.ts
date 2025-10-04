import { t } from "../../i18n/manager";
import { TimeTravelRouter } from "./router";
import { BaseModalUI, ModalConfig } from "../../components/base-modal-ui";
import { IMG_ICON_TIME_TRAVEL } from "../../assets/iconImages";
import { createResponsiveButton } from "../../components/responsive-button";

// 元の位置に配置されるボタン（復元）
export const createTimeTravelButton = (): HTMLButtonElement => {
  return createResponsiveButton({
    iconSrc: IMG_ICON_TIME_TRAVEL,
    text: t`${"timetravel"}`,
    dataAttribute: "timetravel",
    altText: t`${"timetravel"}`,
  });
};

export const createTimeTravelFAB = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "timetravel-fab-btn";
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"timetravel"}`;
  button.innerHTML = `<img src="${IMG_ICON_TIME_TRAVEL}" alt="${t`${"timetravel"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">`;
  return button;
};

export class TimeTravelUI extends BaseModalUI<TimeTravelRouter> {
  getModalConfig(): ModalConfig {
    return {
      id: "wplace-studio-timetravel-modal",
      title: t`${"timetravel_modal_title"}`,
      maxWidth: "80rem",
    };
  }
}
