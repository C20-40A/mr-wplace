import type { ImageItem } from "../../list/components";
import { convertGalleryItemToImageItem } from "./utils";

/**
 * 未配置画像アイテム作成
 */
export const createUnplacedItem = (
  item: any,
  onSelect: (item: ImageItem) => void
): HTMLElement => {
  const container = document.createElement("div");
  container.style.cssText = `
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 0.5rem;
    overflow: hidden;
  `;

  const thumbnail = document.createElement("img");
  thumbnail.src = item.dataUrl;
  thumbnail.style.cssText =
    "width: 80px; height: 80px; object-fit: cover; border: 2px solid #e5e7eb; display: block;";

  container.onmouseenter = () => {
    thumbnail.style.transform = "scale(1.05)";
    thumbnail.style.borderColor = "#6366f1";
  };
  container.onmouseleave = () => {
    thumbnail.style.transform = "scale(1)";
    thumbnail.style.borderColor = "#e5e7eb";
  };
  container.onclick = () => {
    onSelect(convertGalleryItemToImageItem(item));
  };

  container.appendChild(thumbnail);
  return container;
};
