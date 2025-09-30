import { GalleryItem } from "../../storage";
import { ImageGridComponent, ImageItem } from "./components/ImageGridComponent";
import { gotoMapPosition, toggleDrawState } from "../../common-actions";
import { t } from "../../../../i18n/manager";

export class GalleryListUI {
  private modal: HTMLDialogElement | null = null;
  private container: HTMLElement | null = null;

  private imageGrid: ImageGridComponent | null = null;

  constructor() {
    this.createModal();
  }

  showModal(): void {
    this.modal?.showModal();
  }

  closeModal(): void {
    this.modal?.close();
  }

  render(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    isSelectionMode: boolean = false,
    onSelect?: (item: GalleryItem) => void,
    container?: HTMLElement,
    onAddClick?: () => void,
    onImageClick?: (item: GalleryItem) => void
  ): void {
    // 外部コンテナが指定された場合はそれを使用
    if (container) this.container = container;
    this.renderGalleryList(
      items,
      onDelete,
      isSelectionMode,
      onSelect,
      onImageClick,
      onAddClick
    );
  }

  private renderGalleryList(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    isSelectionMode: boolean = false,
    onSelect?: (item: GalleryItem) => void,
    onImageClick?: (item: GalleryItem) => void,
    onAddClick?: () => void
  ): void {
    if (!this.container) return;

    // GalleryItemをImageItemに変換
    const imageItems: ImageItem[] = items.map((item) => ({
      key: item.key,
      dataUrl: item.dataUrl,
      createdAt: new Date(item.timestamp).toISOString(),
      drawPosition: item.drawPosition,
      drawEnabled: item.drawEnabled,
      hasDrawPosition: !!item.drawPosition,
    }));

    // 既存のImageGridComponentがあれば破棄
    if (this.imageGrid) this.imageGrid.destroy();

    // 新しいImageGridComponentを作成
    this.imageGrid = new ImageGridComponent(this.container, {
      items: imageItems,
      isSelectionMode,
      onImageClick: (item) => {
        const galleryItem = items.find((gItem) => gItem.key === item.key);
        if (galleryItem && onImageClick) {
          onImageClick(galleryItem);
        }
      },
      onImageSelect: (item) => {
        const galleryItem = items.find((gItem) => gItem.key === item.key);
        if (galleryItem && onSelect) {
          onSelect(galleryItem);
          this.closeModal();
        }
      },
      onDrawToggle: (key) => {
        this.handleDrawToggle(
          key,
          items,
          onDelete,
          isSelectionMode,
          onSelect,
          onImageClick
        );
      },
      onImageDelete: (key) => {
        onDelete(key);
      },
      onGotoPosition: (item) => {
        const galleryItem = items.find((gItem) => gItem.key === item.key);
        if (galleryItem) {
          this.handleGotoPosition(galleryItem);
        }
      },
      onAddClick: onAddClick || (() => {}),
      showDeleteButton: !isSelectionMode,
      showAddButton: true,
    });

    // レンダリング
    this.imageGrid.render();
  }

  private async handleDrawToggle(
    key: string,
    items: GalleryItem[],
    onDelete: (key: string) => void,
    isSelectionMode: boolean,
    onSelect?: (item: GalleryItem) => void,
    onImageClick?: (item: GalleryItem) => void
  ): Promise<void> {
    const newDrawEnabled = await toggleDrawState(key);

    // 画面を再描画
    const galleryStorage = new (await import("../../storage")).GalleryStorage();
    const updatedItems = await galleryStorage.getAll();
    this.renderGalleryList(
      updatedItems,
      onDelete,
      isSelectionMode,
      onSelect,
      onImageClick
    );

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

    // モーダルが存在する場合のみ閉じる（外部コンテナ使用時は閉じない）
    if (this.modal) this.closeModal();
  }

  destroy(): void {
    if (this.imageGrid) {
      this.imageGrid.destroy();
      this.imageGrid = null;
    }
  }
}
