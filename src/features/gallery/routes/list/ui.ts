import { GalleryItem } from "../../storage";
import { ImageGridComponent, ImageItem } from "./components/ImageGridComponent";
import { gotoMapPosition, toggleDrawState } from "../../common-actions";
import { t } from "@/i18n";

export type GallerySortType = "layer" | "distance" | "created";

export class GalleryListUI {
  private container: HTMLElement | null = null;

  private imageGrid: ImageGridComponent | null = null;
  private onCloseModalCallback?: () => void;

  constructor() {}

  render(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    container?: HTMLElement,
    onAddClick?: () => void,
    onImageClick?: (item: GalleryItem) => void,
    onCloseModal?: () => void,
    sortType?: GallerySortType,
    onSortChange?: (sortType: GallerySortType) => void
  ): void {
    if (!container) return;

    this.container = container;
    this.onCloseModalCallback = onCloseModal;

    this.renderGalleryList(
      container,
      items,
      onDelete,
      onImageClick,
      onAddClick,
      sortType,
      onSortChange
    );
  }

  private renderGalleryList(
    container: HTMLElement,
    items: GalleryItem[],
    onDelete: (key: string) => void,
    onImageClick?: (item: GalleryItem) => void,
    onAddClick?: () => void,
    sortType?: GallerySortType,
    onSortChange?: (sortType: GallerySortType) => void
  ): void {
    // Clear container
    container.innerHTML = "";

    // Create sort dropdown
    const sortContainer = document.createElement("div");
    sortContainer.className = "flex items-center gap-2 mb-4";
    sortContainer.innerHTML = `
      <select id="wps-gallery-sort" class="select select-sm select-bordered">
        <option value="layer">${t`${"sort_layer"}`}</option>
        <option value="distance">${t`${"sort_distance"}`}</option>
        <option value="created">${t`${"sort_created"}`}</option>
      </select>
    `;
    container.appendChild(sortContainer);

    const sortSelect = sortContainer.querySelector(
      "#wps-gallery-sort"
    ) as HTMLSelectElement;
    if (sortType) sortSelect.value = sortType;
    if (onSortChange) {
      sortSelect.addEventListener("change", (e) => {
        onSortChange((e.target as HTMLSelectElement).value as GallerySortType);
      });
    }

    // Create grid container
    const gridContainer = document.createElement("div");
    container.appendChild(gridContainer);

    // Sort items - no sorting here, handled by parent
    const sortedItems = [...items];

    // GalleryItemをImageItemに変換
    const imageItems: ImageItem[] = sortedItems.map((item) => {
      // timestampが無効な場合は現在時刻を使用
      const timestamp =
        item.timestamp && !isNaN(item.timestamp) ? item.timestamp : Date.now();

      return {
        key: item.key,
        dataUrl: item.dataUrl,
        title: item.title,
        createdAt: new Date(timestamp).toISOString(),
        drawPosition: item.drawPosition,
        drawEnabled: item.drawEnabled,
        hasDrawPosition: !!item.drawPosition,
        currentColorStats: item.matchedColorStats,
        totalColorStats: item.totalColorStats,
      };
    });

    // 既存のImageGridComponentがあれば破棄
    if (this.imageGrid) this.imageGrid.destroy();

    // 新しいImageGridComponentを作成
    this.imageGrid = new ImageGridComponent(gridContainer, {
      items: imageItems,
      isSelectionMode: false, // list routeは選択モードなし
      onImageClick: (item) => {
        const galleryItem = items.find((gItem) => gItem.key === item.key);
        if (galleryItem && onImageClick) {
          onImageClick(galleryItem);
        }
      },
      onDrawToggle: (key) => {
        this.handleDrawToggle(key, onDelete, onImageClick, sortType, onSortChange);
      },
      onImageDelete: (key) => {
        onDelete(key);
      },
      onGotoPosition: (item) => {
        const galleryItem = items.find((gItem) => gItem.key === item.key);
        if (galleryItem) this.handleGotoPosition(galleryItem);
      },
      onAddClick: onAddClick || (() => {}),
      showDeleteButton: true, // list routeは削除ボタン表示
      showAddButton: true,
    });

    // レンダリング
    this.imageGrid.render();
  }

  private async handleDrawToggle(
    key: string,
    onDelete: (key: string) => void,
    onImageClick?: (item: GalleryItem) => void,
    sortType?: GallerySortType,
    onSortChange?: (sortType: GallerySortType) => void
  ): Promise<void> {
    const newDrawEnabled = await toggleDrawState(key);

    // 画面を再描画
    const galleryStorage = new (await import("../../storage")).GalleryStorage();
    const updatedItems = await galleryStorage.getAll();

    if (this.container) {
      this.renderGalleryList(
        this.container,
        updatedItems,
        onDelete,
        onImageClick,
        undefined,
        sortType,
        onSortChange
      );
    }

    console.log(`🎯 Draw toggle: ${key} -> ${newDrawEnabled}`);
  }

  private async handleGotoPosition(item: GalleryItem): Promise<void> {
    await gotoMapPosition(item);

    // 親のモーダルを閉じる（コールバック経由）
    if (this.onCloseModalCallback) {
      this.onCloseModalCallback();
    }
  }

  destroy(): void {
    if (this.imageGrid) {
      this.imageGrid.destroy();
      this.imageGrid = null;
    }
  }
}
