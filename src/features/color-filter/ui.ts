import { t } from "../../i18n/manager";
import { ColorFilterRouter } from "./router";
import { createModal, ModalElements } from "@/utils/modal";
import { IMG_ICON_COLOR_FILTER } from "../../assets/iconImages";

export const createColorFilterFAB = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "color-filter-fab-btn";
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"color_filter"}`;
  button.innerHTML = `<img src="${IMG_ICON_COLOR_FILTER}" alt="${t`${"color_filter"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">`;
  return button;
};

export class ColorFilterModal {
  private modalElements: ModalElements;

  constructor(private router: ColorFilterRouter) {
    this.modalElements = createModal({
      id: "wplace-studio-color-filter-modal",
      title: t`${"color_filter"}`,
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
