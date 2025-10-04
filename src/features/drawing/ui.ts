import { IMG_ICON_GALLERY } from "../../assets/iconImages";
import { t } from "../../i18n/manager";
import { createResponsiveButton } from "../../components/responsive-button";

export const createDrawButton = (): HTMLButtonElement => {
  return createResponsiveButton({
    iconSrc: IMG_ICON_GALLERY,
    text: t`${"draw_image"}`,
    dataAttribute: "draw",
    altText: t`${"draw_image"}`,
  });
};
