import { GalleryItem } from "./storage";

export class GalleryUI {
  private modal: HTMLDialogElement | null = null;
  private container: HTMLElement | null = null;
  private isImageExpanded: boolean = false;
  private currentItems: GalleryItem[] = [];
  private currentOnDelete: ((key: string) => void) | null = null;

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

    // +ボタンを表示
    this.toggleAddButton(true);

    if (items.length === 0) {
      this.container.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <p>保存された画像がありません</p>
        </div>
      `;
      return;
    }

    const itemsHtml = items
      .map(
        (item) => `
      <div class="border rounded-lg overflow-hidden shadow relative gallery-item" data-item-key="${
        item.key
      }">
        ${
          !isSelectionMode
            ? `<button class="btn btn-xs btn-circle btn-ghost absolute -top-1 -right-1 z-10 opacity-50 hover:opacity-80 bg-white border border-gray-200 shadow-sm" data-delete="${item.key}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>
          </svg>
        </button>`
            : ""
        }
        <img src="${
          item.dataUrl
        }" alt="Gallery item" class="w-full h-32 aspect-square object-contain cursor-pointer" style="image-rendering: pixelated; object-fit: contain;">
      </div>
    `
      )
      .join("");

    this.container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        ${itemsHtml}
      </div>
    `;

    // 削除ボタンのイベントリスナー（通常モードのみ）
    if (!isSelectionMode) {
      this.container.querySelectorAll("[data-delete]").forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation(); // 画像クリックイベントとの競合を防ぐ
          const key = (e.currentTarget as HTMLElement).getAttribute(
            "data-delete"
          );
          if (key && confirm("この画像を削除しますか？")) {
            onDelete(key);
          }
        });
      });

      // 拡大表示のイベントリスナー（通常モードのみ）
      this.container.querySelectorAll(".gallery-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          // 削除ボタンクリック時は拡大表示しない
          if ((e.target as HTMLElement).closest("[data-delete]")) {
            return;
          }

          const key = (e.currentTarget as HTMLElement).getAttribute(
            "data-item-key"
          );
          if (key) {
            const selectedItem = items.find((item) => item.key === key);
            if (selectedItem) {
              this.showExpandedImage(selectedItem);
            }
          }
        });
      });
    }

    // 画像選択のイベントリスナー（選択モードのみ）
    if (isSelectionMode && onSelect) {
      this.container.querySelectorAll(".gallery-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          const key = (e.currentTarget as HTMLElement).getAttribute(
            "data-item-key"
          );
          if (key) {
            const selectedItem = items.find((item) => item.key === key);
            if (selectedItem) {
              onSelect(selectedItem);
              this.closeModal();
            }
          }
        });
      });
    }
  }

  private showExpandedImage(item: GalleryItem): void {
    if (!this.container) return;

    this.isImageExpanded = true;

    // +ボタンを非表示
    this.toggleAddButton(false);

    this.container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="mb-4 flex items-center gap-2">
          <button id="wps-gallery-back-btn" class="btn btn-sm btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clip-rule="evenodd"/>
            </svg>
            戻る
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

  private toggleAddButton(show: boolean): void {
    const addBtn = document.getElementById("wps-gallery-add-btn");
    if (addBtn) {
      addBtn.style.display = show ? "flex" : "none";
    }
  }

  private createModal(): void {
    this.modal = document.createElement("dialog");
    this.modal.className = "modal";
    this.modal.innerHTML = `
      <div class="modal-box max-w-6xl relative">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="text-lg font-bold mb-4">ギャラリー</h3>
        
        <div id="wps-gallery-container" style="min-height: 400px;">
          <!-- ギャラリー一覧がここに表示されます -->
        </div>
        
        <!-- +ボタン（右下固定） -->
        <button id="wps-gallery-add-btn" class="btn btn-circle btn-primary absolute z-20 shadow-lg" style="bottom: 1rem; right: 1rem;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
      
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    `;

    document.body.appendChild(this.modal);
    this.container = document.getElementById("wps-gallery-container");

    // +ボタンのイベントリスナー
    const addBtn = document.getElementById("wps-gallery-add-btn");
    addBtn?.addEventListener("click", () => {
      this.openImageEditor();
    });
  }
}
