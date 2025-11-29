import type { GalleryItem } from "@/states/galleryStorage";

/**
 * 未配置画像アイテム作成
 */
export const createUnplacedItem = (
  item: any,
  onSelect: (item: GalleryItem) => void
): HTMLElement => {
  const container = document.createElement("div");
  container.className = "unplaced-item";
  container.style.cssText = `
    cursor: pointer;
    border-radius: 0.5rem;
    overflow: hidden;
  `;

  const thumbnail = document.createElement("img");
  thumbnail.className = "unplaced-thumb border-2 border-base-300";
  thumbnail.src = item.dataUrl;
  thumbnail.style.cssText =
    "width: 80px; height: 80px; object-fit: cover; display: block; image-rendering: pixelated; transition: transform 0.2s, border-color 0.2s;";

  container.onclick = () => {
    onSelect(item);
  };

  container.appendChild(thumbnail);
  return container;
};
