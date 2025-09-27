import { GalleryRouter } from "./router";
import { t } from "../../i18n";
import { BaseModalUI, ModalConfig } from "../../components/base-modal-ui";
import { IMG_ICON_GALLERY } from "../../assets/iconImages";

export class GalleryUI extends BaseModalUI<GalleryRouter> {
  getModalConfig(): ModalConfig {
    return {
      id: "wplace-studio-gallery-modal",
      title: t`${"gallery"}`,
    };
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
