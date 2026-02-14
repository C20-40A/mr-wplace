import { GalleryItem } from "@/states/galleryStorage";
import { moveImage } from "../common-actions";

interface DPadOptions {
  item: GalleryItem;
  onMove?: () => Promise<void>;
  size?: "sm" | "md" | "lg";
  opacity?: number;
}

const sizeMap = {
  sm: { grid: "16px", fontSize: "0.65rem" },
  md: { grid: "20px", fontSize: "0.75rem" },
  lg: { grid: "24px", fontSize: "0.85rem" },
};

/**
 * D-pad（方向キー）コンポーネント作成
 */
export const createDPad = (options: DPadOptions): HTMLElement => {
  const { item, onMove, size = "md", opacity = 1 } = options;
  const { grid, fontSize } = sizeMap[size];

  const dPadContainer = document.createElement("div");
  dPadContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(3, ${grid});
    grid-template-rows: repeat(3, ${grid});
    touch-action: pan-y;
    opacity: ${opacity};
  `;

  const createMoveButton = (
    direction: "up" | "down" | "left" | "right",
    symbol: string,
    gridColumn: string,
    gridRow: string,
  ) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-xs btn-info";
    btn.textContent = symbol;
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${fontSize};
      font-weight: 600;
      transition: all 0.15s;
      grid-column: ${gridColumn};
      grid-row: ${gridRow};
      user-select: none;
    `;
    btn.onclick = async (e) => {
      e.stopPropagation();
      await moveImage(item, direction);
      if (onMove) await onMove();
    };
    return btn;
  };

  dPadContainer.appendChild(createMoveButton("up", "↑", "2", "1"));
  dPadContainer.appendChild(createMoveButton("left", "←", "1", "2"));
  dPadContainer.appendChild(createMoveButton("right", "→", "3", "2"));
  dPadContainer.appendChild(createMoveButton("down", "↓", "2", "3"));

  return dPadContainer;
};
