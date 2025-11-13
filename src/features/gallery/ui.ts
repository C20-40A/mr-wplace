import { GalleryRouter } from "./router";
import { t } from "../../i18n";
import { createModal, ModalElements } from "@/utils/modal";
import { IMG_ICON_GALLERY } from "@/assets/iconImages";

export class GalleryUI {
  private modalElements: ModalElements;

  constructor(private router: GalleryRouter) {
    this.modalElements = createModal({
      id: "wplace-studio-gallery-modal",
      title: t`${"gallery"}`,
      containerStyle: "max-height: 90vh;",
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

export const createGalleryButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "gallery-btn"; // 重複チェック用ID設定
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"gallery"}`;
  button.innerHTML = `
    <img src="${IMG_ICON_GALLERY}" alt="${t`${"gallery"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">
    `;
  return button;
};
