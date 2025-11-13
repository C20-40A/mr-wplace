import { GalleryItem } from "../../storage";
import { ImageGridComponent, ImageItem } from "./components/ImageGridComponent";
import { gotoMapPosition, toggleDrawState } from "../../common-actions";

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
    onCloseModal?: () => void
  ): void {
    if (!container) return;

    this.container = container;
    this.onCloseModalCallback = onCloseModal;

    this.renderGalleryList(
      container,
      items,
      onDelete,
      onImageClick,
      onAddClick
    );
  }

  private renderGalleryList(
    container: HTMLElement,
    items: GalleryItem[],
    onDelete: (key: string) => void,
    onImageClick?: (item: GalleryItem) => void,
    onAddClick?: () => void
  ): void {
    // Sort items by layerOrder (drawPosition items first, sorted by layerOrder, then items without drawPosition)
    const sortedItems = [...items].sort((a, b) => {
      const aHasDrawPos = !!a.drawPosition;
      const bHasDrawPos = !!b.drawPosition;

      // Both have drawPosition: sort by layerOrder
      if (aHasDrawPos && bHasDrawPos)
        return (b.layerOrder ?? 0) - (a.layerOrder ?? 0);

      return 0;
    });

    // GalleryItemをImageItemに変換
    const imageItems: ImageItem[] = sortedItems.map((item) => {
      // timestampが無効な場合は現在時刻を使用
      const timestamp =
        item.timestamp && !isNaN(item.timestamp) ? item.timestamp : Date.now();

      return {
        key: item.key,
        dataUrl: item.dataUrl,
        thumbnail: item.thumbnail,
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
    this.imageGrid = new ImageGridComponent(container, {
      items: imageItems,
      isSelectionMode: false, // list routeは選択モードなし
      onImageClick: (item) => {
        const galleryItem = items.find((gItem) => gItem.key === item.key);
        if (galleryItem && onImageClick) {
          onImageClick(galleryItem);
        }
      },
      onDrawToggle: (key) => {
        this.handleDrawToggle(key, onDelete, onImageClick);
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
    onImageClick?: (item: GalleryItem) => void
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
        onImageClick
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
