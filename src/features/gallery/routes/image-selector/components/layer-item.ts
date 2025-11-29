import { GalleryStorage, GalleryItem } from "@/states/galleryStorage";
import {
  toggleDrawState,
  gotoMapPosition,
  moveImage,
} from "../../../common-actions";
import { convertGalleryItemToImageItem } from "./utils";
import { sendGalleryImagesToInject } from "@/content";

interface LayerItemParams {
  item: any;
  index: number;
  totalCount: number;
  onSelect: (item: GalleryItem) => void;
  onShowDetail: ((item: GalleryItem) => void) | null;
  onUpdateStatus: (key: string) => Promise<void>;
  onMoveToUnplaced: (key: string) => Promise<void>;
  onRefreshOrder: () => Promise<void>;
  galleryStorage: GalleryStorage;
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
    galleryStorage,
  } = params;

  const container = document.createElement("div");
  container.className =
    "layer-item-container bg-base-100 border border-base-300 rounded-lg mb-2 shadow-sm";
  container.dataset.key = item.key;
  container.style.cssText = `
    display: flex;
    align-items: stretch;
    transition: transform 0.2s, box-shadow 0.2s;
    overflow: hidden;
    will-change: transform;
  `;

  // コンテンツエリア
  const contentArea = createContentArea(item, index, onSelect);

  // Divider
  const divider = document.createElement("div");
  divider.className = "bg-base-300";
  divider.style.cssText = "width: 1px; align-self: stretch; margin: 0.25rem";

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
  onSelect: (item: GalleryItem) => void
): HTMLElement => {
  const contentArea = document.createElement("div");
  contentArea.style.cssText =
    "flex: 1; display: flex; align-items: center; gap: 0.25rem; min-width: 0; padding: 0.4rem;";

  const mainArea = document.createElement("div");
  mainArea.className = "layer-item-main";
  mainArea.style.cssText = `
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		margin: -0.4rem;
		padding: 0.4rem;
		transition: background 0.15s, transform 0.15s;
		min-width: 0;
	`;

  mainArea.onclick = () => {
    onSelect(convertGalleryItemToImageItem(item));
  };

  // サムネイル
  const thumbnail = document.createElement("img");
  thumbnail.className = "border border-base-300 rounded-md";
  thumbnail.src = item.thumbnail || item.dataUrl;
  thumbnail.style.cssText =
    "width: 48px; height: 48px; object-fit: cover; flex-shrink: 0; image-rendering: pixelated;";

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
  indexLabel.className = "text-sm font-semibold text-base-content";
  indexLabel.textContent = `#${index + 1}`;

  const statusBadge = document.createElement("div");
  statusBadge.className = item.drawEnabled
    ? "badge badge-success badge-sm"
    : "badge badge-error badge-sm";
  statusBadge.dataset.role = "status";
  statusBadge.textContent = item.drawEnabled ? "✓ ON" : "✗ OFF";

  layerInfo.appendChild(indexLabel);
  layerInfo.appendChild(statusBadge);

  infoContainer.appendChild(layerInfo);

  // タイトル表示（タイトルがある場合のみ）
  if (item.title) {
    const titleText = document.createElement("div");
    titleText.className = "text-xs text-base-content/70 mt-1 truncate";
    titleText.dataset.role = "title";
    titleText.textContent = item.title;
    infoContainer.appendChild(titleText);
  }

  return infoContainer;
};

// ボタン領域作成
const createButtonArea = (
  item: any,
  onShowDetail: ((item: GalleryItem) => void) | null,
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
    btn.className = "btn btn-xs btn-info";
    btn.textContent = symbol;
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.15s;
      grid-column: ${gridColumn};
      grid-row: ${gridRow};
      user-select: none;
    `;
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
  onShowDetail: ((item: GalleryItem) => void) | null,
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
  const gotoBtn = createButton("📍", "btn-success", () => {
    gotoMapPosition(item);
  });

  // 詳細ボタン
  const detailBtn = createButton("🔍", "btn-warning", () => {
    if (onShowDetail) {
      onShowDetail(convertGalleryItemToImageItem(item));
    }
  });

  // トグルボタン
  const toggleBtn = createButton(
    item.drawEnabled ? "👁" : "🚫",
    item.drawEnabled ? "btn-primary" : "btn-ghost",
    async () => {
      await toggleDrawState(item.key);
      await onUpdateStatus(item.key);
    }
  );
  toggleBtn.dataset.role = "toggle";

  // 削除ボタン
  const deleteBtn = createButton("×", "btn-error", async () => {
    await galleryStorage.save({
      ...item,
      drawPosition: undefined,
      drawEnabled: false,
    });

    // Notify inject side to update overlay layers
    await sendGalleryImagesToInject();

    await onMoveToUnplaced(item.key);
  });
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
  btnClass: string,
  onClick: () => void | Promise<void>
): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.className = `btn btn-xs ${btnClass}`;
  btn.innerHTML = content;
  btn.style.cssText = `
    border-radius: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    transition: all 0.15s;
  `;
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
  moveContainer.className = "bg-base-200 border-l border-base-300";
  moveContainer.style.cssText =
    "display: flex; flex-direction: column; flex-shrink: 0;";
  moveContainer.onclick = (e) => e.stopPropagation();

  const createLayerMoveButton = (
    direction: "up" | "down",
    symbol: string,
    disabled: boolean
  ) => {
    const btn = document.createElement("button");
    btn.className = disabled
      ? "btn btn-xs btn-disabled"
      : "btn btn-xs btn-ghost";
    btn.textContent = symbol;
    btn.disabled = disabled;

    btn.style.cssText = `
      width: 1.2rem;
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      transition: transform 0.15s;
      will-change: transform;
    `;
    if (!disabled) {
      btn.onclick = async () => {
        await galleryStorage.moveLayer(item.key, direction);

        // Notify inject side to update overlay layers
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
