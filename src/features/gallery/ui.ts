import { GalleryItem } from "./storage";

export class GalleryUI {
  private modal: HTMLDialogElement | null = null;
  private container: HTMLElement | null = null;

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

  render(items: GalleryItem[], onDelete: (key: string) => void, isSelectionMode: boolean = false, onSelect?: (item: GalleryItem) => void): void {
    if (!this.container) return;

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
      <div class="border rounded-lg overflow-hidden shadow relative">
        <button class="btn btn-xs btn-circle btn-ghost absolute -top-1 -right-1 z-10 opacity-50 hover:opacity-80 bg-white border border-gray-200 shadow-sm" data-delete="${
          item.key
        }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>
          </svg>
        </button>
        <img src="${
          item.dataUrl
        }" alt="Gallery item" class="w-full h-32 object-cover">
        <div class="p-2">
          <span class="text-xs text-gray-500">${new Date(
            item.timestamp
          ).toLocaleString()}</span>
        </div>
      </div>
    `
      )
      .join("");

    this.container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        ${itemsHtml}
      </div>
    `;

    // 削除ボタンのイベントリスナー
    this.container.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", (e) => {
        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-delete"
        );
        if (key && confirm("この画像を削除しますか？")) {
          onDelete(key);
        }
      });
    });
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
        
        <div id="wps-gallery-container">
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
