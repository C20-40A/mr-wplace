import { GalleryRouter } from "./router";
import { t } from "../../i18n";
import { createModal, ModalElements } from "@/components/modal";
import { IMG_ICON_GALLERY } from "@/assets/iconImages";

export class GalleryUI {
  private modalElements: ModalElements | null = null;
  private onModalClose?: () => void;

  constructor(private router: GalleryRouter) {}

  /**
   * モーダルが閉じられたときのコールバックを設定
   */
  setOnModalClose(callback: () => void): void {
    this.onModalClose = callback;
  }

  showModal(): void {
    // モーダルが既に存在している場合は削除（毎回作り直す）
    if (this.modalElements?.modal.parentElement) {
      this.modalElements.modal.remove();
      this.modalElements = null;
    }

    // 新しいモーダルを作成
    this.modalElements = createModal({
      id: "wplace-studio-gallery-modal",
      title: t`${"gallery"}`,
      containerStyle: "max-height: 90vh;",
      router: this.router,
    });

    // close イベントリスナーを登録
    this.modalElements.modal.addEventListener("close", () => {
      console.log("🧑‍🎨 : Gallery modal closed, cleaning up...");
      this.onModalClose?.();
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
