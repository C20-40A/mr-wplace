import { t } from "../../i18n/manager";
import { TimeTravelRouter } from "./router";
import { BaseModalUI, ModalConfig } from "../../components/base-modal-ui";
import { IMG_TIME_TRAVEL } from "../../assets/iconImages";

// 元の位置に配置されるボタン（復元）
export const createTimeTravelButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-neutral btn-soft mx-3";
  button.style = "margin: 0.5rem;";
  button.setAttribute("data-wplace-timetravel", "true");
  button.innerHTML = t`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
      </svg>
      ${"timetravel"}
    `;
  return button;
};

export const createTimeTravelFAB = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "timetravel-fab-btn";
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"timetravel"}`;
  button.innerHTML = `
            <img src="${IMG_TIME_TRAVEL}" alt="${t`${"timetravel"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">
    `;
  return button;
};

export class TimeTravelUI extends BaseModalUI<TimeTravelRouter> {
  getModalConfig(): ModalConfig {
    return {
      id: "wplace-studio-timetravel-modal",
      title: t`${"timetravel_modal_title"}`,
    };
  }
}
