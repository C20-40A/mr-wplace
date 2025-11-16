import { t } from "../../i18n/manager";
import { TimeTravelRouter } from "./router";
import { createModal, ModalElements } from "@/components/modal";
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

export class TimeTravelUI {
  private modalElements: ModalElements;

  constructor(private router: TimeTravelRouter) {
    this.modalElements = createModal({
      id: "wplace-studio-timetravel-modal",
      title: t`${"timetravel_modal_title"}`,
      maxWidth: "80rem",
      router: this.router,
    });
  }

  showModal(): void {
    this.modalElements.modal.showModal();
  }

  closeModal(): void {
    this.modalElements.modal.close();
  }

  getContainer(): HTMLElement {
    return this.modalElements.container;
  }
}
