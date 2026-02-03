import type { GalleryItem } from "@/states/galleryStorage";

/**
 * 未配置画像アイテム作成
 */
export const createUnplacedItem = (
  item: any,
  onSelect: (item: GalleryItem) => void,
  clickHint?: string
): HTMLElement => {
  const container = document.createElement("button");
  container.type = "button";
  container.className = "unplaced-item";
  container.style.cssText = `
    cursor: pointer;
    border-radius: 0.5rem;
    overflow: hidden;
    position: relative;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
    background: transparent;
    border: 0;
    padding: 0;
    text-align: left;
    touch-action: pan-y;
  `;
  if (clickHint) container.title = clickHint;

  const thumbnail = document.createElement("img");
  thumbnail.className = "unplaced-thumb border-2 border-base-300";
  thumbnail.src = item.thumbnail || item.dataUrl || "";
  thumbnail.style.cssText =
    "width: 80px; height: 80px; object-fit: cover; display: block; image-rendering: pixelated; transition: transform 0.2s, border-color 0.2s; position: relative; z-index: 0;";

  if (clickHint) {
    const hintBadge = document.createElement("div");
    hintBadge.style.cssText = `
      position: absolute;
      left: 0.25rem;
      bottom: 0.25rem;
      padding: 0.15rem 0.35rem;
      font-size: 0.55rem;
      line-height: 1;
      border-radius: 0.25rem;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      letter-spacing: 0.02em;
      max-width: calc(100% - 0.5rem);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      z-index: 1;
      pointer-events: none;
    `;
    hintBadge.textContent = clickHint;
    container.appendChild(hintBadge);
  }

  const setHoverState = (isHover: boolean) => {
    container.style.transform = isHover ? "translateY(-1px)" : "translateY(0)";
    container.style.boxShadow = isHover
      ? "0 6px 12px rgba(0, 0, 0, 0.18)"
      : "0 0 0 1px rgba(0, 0, 0, 0.06)";
  };
  container.onmouseenter = () => setHoverState(true);
  container.onmouseleave = () => setHoverState(false);

  container.onclick = () => {
    onSelect(item);
  };

  container.appendChild(thumbnail);
  return container;
};
