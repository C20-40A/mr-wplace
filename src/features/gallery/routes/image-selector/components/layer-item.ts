import type { ImageItem } from "../../list/components";
import { GalleryStorage } from "../../../storage";
import {
  toggleDrawState,
  gotoMapPosition,
  moveImage,
} from "../../../common-actions";
import { convertGalleryItemToImageItem } from "./utils";

interface LayerItemParams {
  item: any;
  index: number;
  totalCount: number;
  onSelect: (item: ImageItem) => void;
  onShowDetail: ((item: ImageItem) => void) | null;
  onUpdateStatus: (key: string) => Promise<void>;
  onMoveToUnplaced: (key: string) => Promise<void>;
  onRefreshOrder: () => Promise<void>;
}

/**
 * レイヤーアイテム作成
 */
export const createLayerItem = (params: LayerItemParams): HTMLElement => {
  const {
    item,
    index,
    totalCount,
    onSelect,
    onShowDetail,
    onUpdateStatus,
    onMoveToUnplaced,
    onRefreshOrder,
  } = params;
  const galleryStorage = new GalleryStorage();

  const container = document.createElement("div");
  container.dataset.key = item.key;
  container.style.cssText = `
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: stretch;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  `;

  // コンテンツエリア
  const contentArea = createContentArea(item, index, onSelect, container);

  // Divider
  const divider = document.createElement("div");
  divider.style.cssText =
    "width: 1px; background: #e5e7eb; align-self: stretch; margin: 0.25rem";

  // ボタン領域
  const buttonArea = createButtonArea(
    item,
    onShowDetail,
    galleryStorage,
    onUpdateStatus,
    onMoveToUnplaced
  );

  // レイヤー移動ボタン
  const moveContainer = createMoveContainer(
    item,
    index,
    totalCount,
    galleryStorage,
    onRefreshOrder
  );

  container.appendChild(contentArea);
  container.appendChild(divider);
  container.appendChild(buttonArea);
  container.appendChild(moveContainer);

  // D-pad追加
  const dPadContainer = createDPad(item, onRefreshOrder);
  buttonArea.insertBefore(dPadContainer, buttonArea.firstChild);

  return container;
};

// コンテンツエリア作成
const createContentArea = (
  item: any,
  index: number,
  onSelect: (item: ImageItem) => void,
  container: HTMLElement
): HTMLElement => {
  const contentArea = document.createElement("div");
  contentArea.style.cssText =
    "flex: 1; display: flex; align-items: center; gap: 0.25rem; min-width: 0; padding: 0.4rem;";

  const mainArea = document.createElement("div");
  mainArea.style.cssText = `
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		margin: -0.4rem; 
		padding: 0.4rem;
		transition: background 0.15s;
		min-width: 0;
	`;

  mainArea.onmouseenter = () => {
    mainArea.style.background = "#f3f4f6";
    container.style.transform = "translateY(-1px)";
    container.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
  };
  mainArea.onmouseleave = () => {
    mainArea.style.background = "transparent";
    container.style.transform = "translateY(0)";
    container.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
  };
  mainArea.onclick = () => {
    onSelect(convertGalleryItemToImageItem(item));
  };

  // サムネイル
  const thumbnail = document.createElement("img");
  thumbnail.src = item.dataUrl;
  thumbnail.style.cssText =
    "width: 48px; height: 48px; object-fit: cover; border-radius: 0.375rem; flex-shrink: 0; border: 1px solid #e5e7eb; image-rendering: pixelated;";

  // 情報
  const infoContainer = createInfoContainer(item, index);

  mainArea.appendChild(thumbnail);
  mainArea.appendChild(infoContainer);
  contentArea.appendChild(mainArea);

  return contentArea;
};

// 情報コンテナ作成
const createInfoContainer = (item: any, index: number): HTMLElement => {
  const infoContainer = document.createElement("div");
  infoContainer.style.cssText = "flex: 1; min-width: 0;";

  const layerInfo = document.createElement("div");
  layerInfo.style.cssText = "display: flex; align-items: center; gap: 0.5rem;";

  const indexLabel = document.createElement("div");
  indexLabel.textContent = `#${index + 1}`;
  indexLabel.style.cssText =
    "font-weight: 600; font-size: 0.875rem; color: #374151;";

  const statusBadge = document.createElement("div");
  statusBadge.dataset.role = "status";
  statusBadge.textContent = item.drawEnabled ? "✓ ON" : "✗ OFF";
  statusBadge.style.cssText = `
    font-size: 0.75rem;
    padding: 0.1rem 0.2rem;
    border-radius: 0.25rem;
    font-weight: 500;
    background: ${item.drawEnabled ? "#d1fae5" : "#fee2e2"};
    color: ${item.drawEnabled ? "#065f46" : "#991b1b"};
  `;

  layerInfo.appendChild(indexLabel);
  layerInfo.appendChild(statusBadge);

  infoContainer.appendChild(layerInfo);

  // タイトル表示（タイトルがある場合のみ）
  if (item.title) {
    const titleText = document.createElement("div");
    titleText.dataset.role = "title";
    titleText.textContent = item.title;
    titleText.style.cssText =
      "font-size: 0.75rem; color: #4b5563; margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
    infoContainer.appendChild(titleText);
  }

  return infoContainer;
};

// ボタン領域作成
const createButtonArea = (
  item: any,
  onShowDetail: ((item: ImageItem) => void) | null,
  galleryStorage: GalleryStorage,
  onUpdateStatus: (key: string) => Promise<void>,
  onMoveToUnplaced: (key: string) => Promise<void>
): HTMLElement => {
  const buttonArea = document.createElement("div");
  buttonArea.style.cssText =
    "display: flex; flex-shrink: 0; align-items: center;";
  buttonArea.onclick = (e) => e.stopPropagation();

  // 2x2グリッド（goto/detail/toggle/delete）
  const actionGrid = createActionGrid(
    item,
    onShowDetail,
    galleryStorage,
    onUpdateStatus,
    onMoveToUnplaced
  );

  buttonArea.appendChild(actionGrid);

  return buttonArea;
};

// D-pad作成
const createDPad = (
  item: any,
  onRefreshOrder: () => Promise<void>
): HTMLElement => {
  const dPadContainer = document.createElement("div");
  dPadContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(3, 20px);
    grid-template-rows: repeat(3, 20px);
  `;

  const createMoveImageButton = (
    direction: "up" | "down" | "left" | "right",
    symbol: string,
    gridColumn: string,
    gridRow: string
  ) => {
    const btn = document.createElement("button");
    btn.textContent = symbol;
    btn.style.cssText = `
      background: #e0f2fe;
      border: 1px solid #bae6fd;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.75rem;
      color: #0369a1;
      font-weight: 600;
      transition: all 0.15s;
      grid-column: ${gridColumn};
      grid-row: ${gridRow};
    `;
    btn.onmouseenter = () => {
      btn.style.background = "#bae6fd";
      btn.style.transform = "scale(1.05)";
    };
    btn.onmouseleave = () => {
      btn.style.background = "#e0f2fe";
      btn.style.transform = "scale(1)";
    };
    btn.onclick = async () => {
      await moveImage(item, direction);
      await onRefreshOrder();
    };
    return btn;
  };

  dPadContainer.appendChild(createMoveImageButton("up", "↑", "2", "1"));
  dPadContainer.appendChild(createMoveImageButton("left", "←", "1", "2"));
  dPadContainer.appendChild(createMoveImageButton("right", "→", "3", "2"));
  dPadContainer.appendChild(createMoveImageButton("down", "↓", "2", "3"));

  return dPadContainer;
};

// アクショングリッド作成
const createActionGrid = (
  item: any,
  onShowDetail: ((item: ImageItem) => void) | null,
  galleryStorage: GalleryStorage,
  onUpdateStatus: (key: string) => Promise<void>,
  onMoveToUnplaced: (key: string) => Promise<void>
): HTMLElement => {
  const actionGrid = document.createElement("div");
  actionGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(2, 1.75rem);
    grid-template-rows: repeat(2, 1.75rem);
    margin: 0.25rem;
  `;

  // Gotoボタン
  const gotoBtn = createButton("📍", "#d1fae5", "#a7f3d0", () => {
    gotoMapPosition(item);
  });

  // 詳細ボタン
  const detailBtn = createButton("🔍", "#fef3c7", "#fde68a", () => {
    if (onShowDetail) {
      onShowDetail(convertGalleryItemToImageItem(item));
    }
  });

  // トグルボタン
  const toggleBtn = createButton(
    item.drawEnabled ? "👁" : "🚫",
    item.drawEnabled ? "#dbeafe" : "#f3f4f6",
    item.drawEnabled ? "#bfdbfe" : "#e5e7eb",
    async () => {
      await toggleDrawState(item.key);
      await onUpdateStatus(item.key);
    }
  );
  toggleBtn.dataset.role = "toggle";

  // 削除ボタン
  const deleteBtn = createButton("×", "#fee2e2", "#fecaca", async () => {
    await galleryStorage.save({
      ...item,
      drawPosition: undefined,
      drawEnabled: false,
    });

    // Notify inject side to update overlay layers
    const { sendGalleryImagesToInject } = await import("@/content");
    await sendGalleryImagesToInject();

    await onMoveToUnplaced(item.key);
  });
  deleteBtn.style.color = "#991b1b";
  deleteBtn.style.fontSize = "1rem";

  actionGrid.appendChild(gotoBtn);
  actionGrid.appendChild(detailBtn);
  actionGrid.appendChild(toggleBtn);
  actionGrid.appendChild(deleteBtn);

  return actionGrid;
};

// ボタン作成ヘルパー
const createButton = (
  content: string,
  bg: string,
  hoverBg: string,
  onClick: () => void | Promise<void>
): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.innerHTML = content;
  btn.style.cssText = `
    background: ${bg};
    border: 1px solid ${hoverBg};
    border-radius: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  `;
  btn.onmouseenter = () => {
    btn.style.background = hoverBg;
    btn.style.transform = "scale(1.1)";
  };
  btn.onmouseleave = () => {
    btn.style.background = bg;
    btn.style.transform = "scale(1)";
  };
  btn.onclick = () => {
    const result = onClick();
    if (result instanceof Promise) {
      result.catch((err) => console.error("🧑‍🎨 : Button action error:", err));
    }
  };
  return btn;
};

// レイヤー移動コンテナ作成
const createMoveContainer = (
  item: any,
  index: number,
  totalCount: number,
  galleryStorage: GalleryStorage,
  onRefreshOrder: () => Promise<void>
): HTMLElement => {
  const moveContainer = document.createElement("div");
  moveContainer.style.cssText =
    "display: flex; flex-direction: column; flex-shrink: 0; background: #f9fafb; border-left: 1px solid #e5e7eb;";
  moveContainer.onclick = (e) => e.stopPropagation();

  const createLayerMoveButton = (
    direction: "up" | "down",
    symbol: string,
    disabled: boolean
  ) => {
    const btn = document.createElement("button");
    btn.textContent = symbol;
    btn.disabled = disabled;
    const activeBg = "#ffffff";
    const activeText = "#1f2937";
    const hoverBg = "#f3f4f6";

    btn.style.cssText = `
      background: ${disabled ? "#f3f4f6" : activeBg};
      width: 1.2rem;
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      cursor: ${disabled ? "not-allowed" : "pointer"};
      font-size: 0.75rem;
      color: ${disabled ? "#9ca3af" : activeText};
      font-weight: 600;
      opacity: ${disabled ? "0.8" : "1"};
      transition: all 0.15s;
    `;
    if (!disabled) {
      btn.onmouseenter = () => {
        btn.style.background = hoverBg;
        btn.style.transform = "scale(1.05)";
      };
      btn.onmouseout = () => {
        btn.style.background = activeBg;
        btn.style.transform = "scale(1)";
      };
      btn.onclick = async () => {
        await galleryStorage.moveLayer(item.key, direction);

        // Notify inject side to update overlay layers
        const { sendGalleryImagesToInject } = await import("@/content");
        await sendGalleryImagesToInject();

        await onRefreshOrder();
      };
    }
    return btn;
  };

  moveContainer.appendChild(createLayerMoveButton("up", "⌃", index === 0));
  moveContainer.appendChild(
    createLayerMoveButton("down", "⌄", index === totalCount - 1)
  );

  return moveContainer;
};
