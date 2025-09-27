import { IMG_ICON_GALLERY } from "../../assets/iconImages";
import { t } from "../../i18n/manager";

export const createDrawButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-primary";
  button.setAttribute("data-wplace-draw", "true");
  button.innerHTML = t`
    <img src="${IMG_ICON_GALLERY}" alt="${"draw_image"}" style="image-rendering: pixelated;">
    ${"draw_image"}`;
  return button;
};
