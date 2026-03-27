import { t } from "@/i18n/manager";
import { IMG_ICON_BOOKMARK } from "@/assets/iconImages";
import { createResponsiveButton } from "@/components/responsive-button";

export const createSaveBookmarkButton = (): HTMLButtonElement => {
  return createResponsiveButton({
    iconSrc: IMG_ICON_BOOKMARK,
    text: t`${"bookmark"}`,
    dataAttribute: "save",
    altText: t`${"bookmark"}`,
  });
};

export const createBookmarkButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "bookmarks-btn"; // 重複チェック用ID設定
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"bookmarks"}`;
  button.innerHTML = `
    <img src="${IMG_ICON_BOOKMARK}" alt="${t`${"bookmarks"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">
  `;
  return button;
};
