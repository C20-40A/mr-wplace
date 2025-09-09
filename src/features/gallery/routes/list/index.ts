import { GalleryItem, GalleryStorage } from "../../storage";
import { GalleryRouter } from "../../router";

export class GalleryList {
  private storage: GalleryStorage;

  constructor() {
    this.storage = new GalleryStorage();
  }

  async render(
    container: HTMLElement,
    router: GalleryRouter,
    isSelectionMode: boolean = false,
    onSelect?: (item: GalleryItem) => void
  ): Promise<void> {
    const items = await this.storage.getAll();

    if (items.length === 0) {
      container.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <p>保存された画像がありません</p>
        </div>
        
        <!-- +ボタン（右下固定） -->
        <button id="wps-gallery-add-btn" class="btn btn-circle btn-primary absolute z-20 shadow-lg" style="bottom: 1rem; right: 1rem;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
          </svg>
        </button>
      `;
      
      // +ボタンのイベントリスナー
      const addBtn = document.getElementById("wps-gallery-add-btn");
      addBtn?.addEventListener("click", () => {
        console.log("Navigate to image editor (empty state)");
        router.navigate("image-editor");
      });
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

    container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        ${itemsHtml}
      </div>
      
      <!-- +ボタン（右下固定） -->
      <button id="wps-gallery-add-btn" class="btn btn-circle btn-primary absolute z-20 shadow-lg" style="bottom: 1rem; right: 1rem;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
          <path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
        </svg>
      </button>
    `;

    // +ボタンのイベントリスナー
    const addBtn = document.getElementById("wps-gallery-add-btn");
    addBtn?.addEventListener("click", () => {
      console.log("Navigate to image editor");
      router.navigate("image-editor");
    });

    // 削除ボタンのイベントリスナー（通常モードのみ）
    if (!isSelectionMode) {
      container.querySelectorAll("[data-delete]").forEach((button) => {
        button.addEventListener("click", async (e) => {
          e.stopPropagation();
          const key = (e.currentTarget as HTMLElement).getAttribute(
            "data-delete"
          );
          if (key && confirm("この画像を削除しますか？")) {
            await this.storage.delete(key);
            // 再描画
            this.render(container, router, isSelectionMode, onSelect);
          }
        });
      });
    }

    // 画像選択のイベントリスナー（選択モードのみ）
    if (isSelectionMode && onSelect) {
      container.querySelectorAll(".gallery-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          const key = (e.currentTarget as HTMLElement).getAttribute(
            "data-item-key"
          );
          if (key) {
            const selectedItem = items.find((item) => item.key === key);
            if (selectedItem) {
              onSelect(selectedItem);
            }
          }
        });
      });
    }
  }
}
