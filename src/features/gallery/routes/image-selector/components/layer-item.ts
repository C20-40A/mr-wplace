import { GalleryStorage, GalleryItem } from "@/states/galleryStorage";
import {
  toggleDrawState,
  gotoMapPosition,
  moveImage,
} from "../../../common-actions";
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
  clickHint?: string;
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
    clickHint,
  } = params;

  const container = document.createElement("div");
  container.className =
    "layer-item-container bg-base-100 border border-base-300 rounded-lg mb-2 shadow-sm";
  container.dataset.key = item.key;
  container.style.cssText = `
    position: relative;
    display: flex;
    align-items: stretch;
    transition: transform 0.2s, box-shadow 0.2s;
    overflow: hidden;
    will-change: transform;
    touch-action: pan-y;
  `;

  // コンテンツエリア
  const contentArea = createContentArea(item, index, onSelect, clickHint);

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
    onMoveToUnplaced,
  );

  // レイヤー移動ボタン
  const moveContainer = createMoveContainer(
    item,
    index,
    totalCount,
    galleryStorage,
    onRefreshOrder,
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
  item: GalleryItem,
  index: number,
  onSelect: (item: GalleryItem) => void,
  clickHint?: string,
): HTMLElement => {
  const contentArea = document.createElement("div");
  contentArea.style.cssText =
    "flex: 1; display: flex; align-items: center; gap: 0.25rem; min-width: 0; padding: 0.4rem;";

  const mainArea = document.createElement("div");
  mainArea.className = "layer-item-main";
  mainArea.style.cssText = `
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		margin: -0.4rem;
		padding: 0.4rem;
		transition: background 0.15s, transform 0.15s;
		min-width: 0;
    touch-action: pan-y;
	`;
  if (clickHint) mainArea.title = clickHint;

  mainArea.onclick = () => {
    onSelect(item);
  };
  const setHoverState = (isHover: boolean) => {
    mainArea.style.background = isHover ? "rgba(0, 0, 0, 0.04)" : "transparent";
    mainArea.style.transform = isHover ? "translateY(-1px)" : "translateY(0)";
  };
  mainArea.onmouseenter = () => setHoverState(true);
  mainArea.onmouseleave = () => setHoverState(false);

  // サムネイル
  const thumbnail = document.createElement("img");
  thumbnail.className = "border border-base-300 rounded-md";
  thumbnail.src = item.thumbnail ?? item.dataUrl ?? "";
  thumbnail.style.cssText =
    "width: 48px; height: 48px; object-fit: cover; flex-shrink: 0; image-rendering: pixelated;";

  // 情報
  const infoContainer = createInfoContainer(item, index, clickHint);

  // プログレスバー
  const progressBar = createProgressBar(item);

  mainArea.appendChild(thumbnail);
  mainArea.appendChild(infoContainer);
  mainArea.appendChild(progressBar);
  contentArea.appendChild(mainArea);

  return contentArea;
};

// プログレスバー作成（mainArea内部の下部にアブソリュート配置）
const createProgressBar = (item: GalleryItem): HTMLElement => {
  const placedPixels = item.matchedColorStats
    ? Object.values(item.matchedColorStats).reduce((a, b) => a + b, 0)
    : 0;
  const totalPixels = item.totalColorStats
    ? Object.values(item.totalColorStats).reduce((a, b) => a + b, 0)
    : 0;
  const progress = totalPixels > 0 ? (placedPixels / totalPixels) * 100 : 0;

  const progressContainer = document.createElement("div");
  progressContainer.style.cssText = `
    position: absolute;
    bottom: 1px;
    left: 5px;
    right: 0px;
    height: 3px;
    background: rgba(0,0,0,0.1);
    overflow: hidden;
    pointer-events: none;
  `;

  const progressFill = document.createElement("div");
  progressFill.style.cssText = `
    width: ${progress}%;
    height: 100%;
    background: linear-gradient(to right, #3b82f6, #60a5fa);
    transition: width 0.3s;
  `;

  progressContainer.appendChild(progressFill);

  console.log(`🧑‍🎨 : Progress for ${item.key}: ${placedPixels}/${totalPixels} = ${progress.toFixed(1)}%`);

  return progressContainer;
};

// 情報コンテナ作成
const createInfoContainer = (
  item: any,
  index: number,
  clickHint?: string,
): HTMLElement => {
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

  if (clickHint) {
    const hintText = document.createElement("div");
    hintText.style.cssText =
      "font-size: 0.6rem; color: inherit; opacity: 0.6; margin-top: 0.15rem;";
    hintText.textContent = clickHint;
    infoContainer.appendChild(hintText);
  }

  return infoContainer;
};

// ボタン領域作成
const createButtonArea = (
  item: any,
  onShowDetail: ((item: GalleryItem) => void) | null,
  galleryStorage: GalleryStorage,
  onUpdateStatus: (key: string) => Promise<void>,
  onMoveToUnplaced: (key: string) => Promise<void>,
): HTMLElement => {
  const buttonArea = document.createElement("div");
  buttonArea.style.cssText =
    "display: flex; flex-shrink: 0; align-items: center; touch-action: pan-y;";
  buttonArea.onclick = (e) => e.stopPropagation();

  // 2x2グリッド（goto/detail/toggle/delete）
  const actionGrid = createActionGrid(
    item,
    onShowDetail,
    galleryStorage,
    onUpdateStatus,
    onMoveToUnplaced,
  );

  buttonArea.appendChild(actionGrid);

  return buttonArea;
};

// D-pad作成
const createDPad = (
  item: any,
  onRefreshOrder: () => Promise<void>,
): HTMLElement => {
  const dPadContainer = document.createElement("div");
  dPadContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(3, 20px);
    grid-template-rows: repeat(3, 20px);
    touch-action: pan-y;
  `;

  const createMoveImageButton = (
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
  onMoveToUnplaced: (key: string) => Promise<void>,
): HTMLElement => {
  const actionGrid = document.createElement("div");
  actionGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(2, 1.75rem);
    grid-template-rows: repeat(2, 1.75rem);
    margin: 0.25rem;
    touch-action: pan-y;
  `;

  // Gotoボタン
  const gotoBtn = createButton("📍", "btn-success", () => {
    gotoMapPosition(item);
  });

  // 詳細ボタン
  const detailBtn = createButton("🔍", "btn-warning", () => {
    if (onShowDetail) onShowDetail(item);
  });

  // トグルボタン
  const toggleBtn = createButton(
    item.drawEnabled ? "👁" : "🚫",
    item.drawEnabled ? "btn-primary" : "btn-ghost",
    async () => {
      await toggleDrawState(item.key);
      await onUpdateStatus(item.key);
    },
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
  onClick: () => void | Promise<void>,
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
    touch-action: pan-y;
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
  onRefreshOrder: () => Promise<void>,
): HTMLElement => {
  const moveContainer = document.createElement("div");
  moveContainer.className = "bg-base-200 border-l border-base-300";
  moveContainer.style.cssText =
    "display: flex; flex-direction: column; flex-shrink: 0; touch-action: pan-y;";
  moveContainer.onclick = (e) => e.stopPropagation();

  const createLayerMoveButton = (
    direction: "up" | "down",
    symbol: string,
    disabled: boolean,
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
      touch-action: pan-y;
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
    createLayerMoveButton("down", "⌄", index === totalCount - 1),
  );

  return moveContainer;
};
