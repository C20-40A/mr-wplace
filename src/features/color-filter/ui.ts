import { t } from "../../i18n/manager";
import { ColorFilterRouter } from "./router";
import { createModal, ModalElements } from "@/components/modal";
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
  private modalElements: ModalElements | null = null;

  constructor(private router: ColorFilterRouter) {}

  showModal(): void {
    // モーダルが既に存在している場合は削除（毎回作り直す）
    if (this.modalElements?.modal.parentElement) {
      this.modalElements.modal.remove();
      this.modalElements = null;
    }

    // 新しいモーダルを作成
    this.modalElements = createModal({
      id: "wplace-studio-color-filter-modal",
      title: t`${"color_filter"}`,
      router: this.router,
    });

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
