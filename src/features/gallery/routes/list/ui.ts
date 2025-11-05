import { GalleryItem } from "../../storage";
import { ImageGridComponent, ImageItem } from "./components/ImageGridComponent";
import { gotoMapPosition, toggleDrawState } from "../../common-actions";
import { t } from "@/i18n/manager";

export class GalleryListUI {
  private modal: HTMLDialogElement | null = null;
  private container: HTMLElement | null = null;

  private imageGrid: ImageGridComponent | null = null;
  private onCloseModalCallback?: () => void;

  constructor() {
    this.createModal();
  }

  render(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    container?: HTMLElement,
    onAddClick?: () => void,
    onImageClick?: (item: GalleryItem) => void,
    onCloseModal?: () => void
  ): void {
    // 外部コンテナが指定された場合はそれを使用
    if (container) this.container = container;
    this.onCloseModalCallback = onCloseModal;
    this.renderGalleryList(items, onDelete, onImageClick, onAddClick);
  }

  private renderGalleryList(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    onImageClick?: (item: GalleryItem) => void,
    onAddClick?: () => void
  ): void {
    if (!this.container) return;

    console.log(
      "🧑‍🎨 : renderGalleryList items:",
      items.map((i) => ({
        key: i.key,
        hasCurrentStats: !!i.matchedColorStats,
        hasTotalStats: !!i.totalColorStats,
      }))
    );

    // GalleryItemをImageItemに変換
    const imageItems: ImageItem[] = items.map((item) => {
      // timestampが無効な場合は現在時刻を使用
      const timestamp =
        item.timestamp && !isNaN(item.timestamp) ? item.timestamp : Date.now();

      return {
        key: item.key,
        dataUrl: item.dataUrl,
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
    this.imageGrid = new ImageGridComponent(this.container, {
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
    this.renderGalleryList(updatedItems, onDelete, onImageClick);

    console.log(`🎯 Draw toggle: ${key} -> ${newDrawEnabled}`);
  }

  private createModal(): void {
    this.modal = document.createElement("dialog");
    this.modal.className = "modal";
    this.modal.innerHTML = t`
      <div class="modal-box max-w-6xl relative">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="text-lg font-bold mb-4">${"gallery"}</h3>
        
        <div id="wps-gallery-container" style="min-height: 400px;">
          <!-- ギャラリー一覧がここに表示されます -->
        </div>
      </div>
      
      <form method="dialog" class="modal-backdrop">
        <button>${"close"}</button>
      </form>
    `;

    document.body.appendChild(this.modal);
    this.container = document.getElementById("wps-gallery-container");
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
