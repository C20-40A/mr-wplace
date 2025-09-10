import { GalleryItem } from "../../storage";
import { ImageGridComponent, ImageItem } from "./components/ImageGridComponent";
import { t } from "../../../../i18n/manager";

export class GalleryUI {
  private modal: HTMLDialogElement | null = null;
  private container: HTMLElement | null = null;
  private isImageExpanded: boolean = false;
  private currentItems: GalleryItem[] = [];
  private currentOnDelete: ((key: string) => void) | null = null;
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

  private openImageEditor(): void {
    // ギャラリーモーダルを閉じる
    this.closeModal();

    // 空の状態でImageEditorを開く
    if ((window as any).wplaceStudio?.imageEditor) {
      (window as any).wplaceStudio.imageEditor.clearAndOpen();
    }
  }

  render(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    isSelectionMode: boolean = false,
    onSelect?: (item: GalleryItem) => void
  ): void {
    // 状態を保存
    this.currentItems = items;
    this.currentOnDelete = onDelete;

    if (this.isImageExpanded) {
      return; // 拡大表示中は再レンダリングしない
    }
    this.renderGalleryList(items, onDelete, isSelectionMode, onSelect);
  }

  private renderGalleryList(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    isSelectionMode: boolean = false,
    onSelect?: (item: GalleryItem) => void
  ): void {
    if (!this.container) return;

    // GalleryItemをImageItemに変換
    const imageItems: ImageItem[] = items.map(item => ({
      key: item.key,
      dataUrl: item.dataUrl,
      createdAt: new Date(item.timestamp).toISOString()
    }));

    // 既存のImageGridComponentがあれば破棄
    if (this.imageGrid) {
      this.imageGrid.destroy();
    }

    // 新しいImageGridComponentを作成
    this.imageGrid = new ImageGridComponent(this.container, {
      items: imageItems,
      isSelectionMode,
      onImageClick: (item) => {
        const galleryItem = items.find(gItem => gItem.key === item.key);
        if (galleryItem) {
          this.showExpandedImage(galleryItem);
        }
      },
      onImageSelect: (item) => {
        const galleryItem = items.find(gItem => gItem.key === item.key);
        if (galleryItem && onSelect) {
          onSelect(galleryItem);
          this.closeModal();
        }
      },
      onImageDelete: (key) => {
        onDelete(key);
      },
      onAddClick: () => {
        this.openImageEditor();
      },
      showDeleteButton: !isSelectionMode,
      showAddButton: true
    });

    // レンダリング
    this.imageGrid.render();
  }

  private showExpandedImage(item: GalleryItem): void {
    if (!this.container) return;

    this.isImageExpanded = true;

    // ImageGridComponentを破棄
    if (this.imageGrid) {
      this.imageGrid.destroy();
      this.imageGrid = null;
    }

    this.container.innerHTML = t`
      <div class="flex flex-col items-center justify-center h-full">
        <div class="mb-4 flex items-center gap-2">
          <button id="wps-gallery-back-btn" class="btn btn-sm btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clip-rule="evenodd"/>
            </svg>
            ${'back'}
          </button>
        </div>
        <div class="flex items-center justify-center" style="max-height: 70vh; max-width: 90vw;">
          <img src="${item.dataUrl}" alt="Expanded gallery item" class="" style="image-rendering: pixelated; min-width: 50vw; max-width: 90vw; max-height: 70vh; object-fit: contain; aspect-ratio: auto;">
        </div>
      </div>
    `;

    // 戻るボタンのイベントリスナー
    const backBtn = document.getElementById("wps-gallery-back-btn");
    backBtn?.addEventListener("click", () => {
      this.hideExpandedImage();
    });
  }

  private hideExpandedImage(): void {
    this.isImageExpanded = false;

    // 一覧表示に戻る
    if (this.currentItems && this.currentOnDelete) {
      this.renderGalleryList(this.currentItems, this.currentOnDelete, false);
    }
  }

  private createModal(): void {
    this.modal = document.createElement("dialog");
    this.modal.className = "modal";
    this.modal.innerHTML = t`
      <div class="modal-box max-w-6xl relative">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="text-lg font-bold mb-4">${'gallery'}</h3>
        
        <div id="wps-gallery-container" style="min-height: 400px;">
          <!-- ギャラリー一覧がここに表示されます -->
        </div>
      </div>
      
      <form method="dialog" class="modal-backdrop">
        <button>${'close'}</button>
      </form>
    `;

    document.body.appendChild(this.modal);
    this.container = document.getElementById("wps-gallery-container");
  }

  destroy(): void {
    if (this.imageGrid) {
      this.imageGrid.destroy();
      this.imageGrid = null;
    }
  }
}
