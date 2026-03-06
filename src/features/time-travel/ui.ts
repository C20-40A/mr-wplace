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
  button.className = "btn btn-sm btn-circle";
  button.title = t`${"timetravel"}`;
  button.innerHTML = `<img src="${IMG_ICON_TIME_TRAVEL}" alt="${t`${"timetravel"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*6); height: calc(var(--spacing)*6);">`;
  return button;
};

export class TimeTravelUI {
  private modalElements: ModalElements | null = null;
  private onModalClosed?: () => void;

  constructor(private router: TimeTravelRouter) {}

  setOnModalClosed(callback: () => void): void {
    this.onModalClosed = callback;
  }

  isOpen(): boolean {
    return this.modalElements?.modal.open === true;
  }

  showModal(): void {
    if (this.isOpen()) return;

    this.modalElements = createModal({
      id: "wplace-studio-timetravel-modal",
      title: t`${"timetravel_modal_title"}`,
      maxWidth: "80rem",
      router: this.router,
    });

    this.modalElements.modal.addEventListener(
      "close",
      () => {
        this.onModalClosed?.();
        this.modalElements = null;
      },
      { once: true },
    );

    this.modalElements.modal.showModal();
  }

  closeModal(): void {
    this.modalElements?.modal.close();
  }

  getContainer(): HTMLElement {
    if (!this.modalElements) {
      throw new Error("Modal not initialized. Call showModal() first.");
    }
    return this.modalElements.container;
  }
}
