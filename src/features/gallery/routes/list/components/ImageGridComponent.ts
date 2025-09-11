import { t } from "../../../../../i18n/manager";

export interface ImageItem {
  key: string;
  dataUrl: string;
  title?: string;
  createdAt?: string;
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  hasDrawPosition?: boolean;
}

export interface ImageGridOptions {
  items: ImageItem[];
  isSelectionMode?: boolean;
  onImageClick?: (item: ImageItem) => void;
  onImageSelect?: (item: ImageItem) => void;
  onImageDelete?: (key: string) => void;
  onDrawToggle?: (key: string) => void; // 描画状態切り替えコールバック
  showDeleteButton?: boolean;
  showAddButton?: boolean;
  showDrawToggleButton?: boolean; // 描画切り替えボタンを表示するか
  onAddClick?: () => void;
  emptyStateMessage?: string;
  gridCols?: string;
}

export class ImageGridComponent {
  private container: HTMLElement;
  private options: ImageGridOptions;

  constructor(container: HTMLElement, options: ImageGridOptions) {
    this.container = container;
    this.options = {
      isSelectionMode: false,
      showDeleteButton: true,
      showAddButton: true,
      showDrawToggleButton: true, // デフォルトで目アイコンを表示
      emptyStateMessage: t`${"no_saved_images"}`,
      gridCols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      ...options,
    };
  }

  /**
   * オプションを更新して再描画
   */
  updateOptions(newOptions: Partial<ImageGridOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.render();
  }

  /**
   * 画像グリッドをレンダリング
   */
  render(): void {
    if (this.options.items.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.renderImageGrid();
  }

  /**
   * 空の状態を表示
   */
  private renderEmptyState(): void {
    this.container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <p>${this.options.emptyStateMessage}</p>
      </div>
      
      ${this.options.showAddButton ? this.createAddButtonHtml() : ""}
    `;

    this.attachAddButtonListener();
  }

  /**
   * 画像グリッドを表示
   */
  private renderImageGrid(): void {
    const itemsHtml = this.options.items
      .map((item) => this.createImageItemHtml(item))
      .join("");

    this.container.innerHTML = `
      <div class="grid ${this.options.gridCols} gap-4">
        ${itemsHtml}
      </div>
      
      ${this.options.showAddButton ? this.createAddButtonHtml() : ""}
    `;

    this.attachEventListeners();
  }

  /**
   * 画像アイテムのHTMLを生成
   */
  private createImageItemHtml(item: ImageItem): string {
    const showDeleteBtn =
      this.options.showDeleteButton && !this.options.isSelectionMode;
    const showDrawToggleBtn =
      this.options.showDrawToggleButton && !this.options.isSelectionMode;

    return `
      <div class="border rounded-lg overflow-hidden shadow relative gallery-item" data-item-key="${
        item.key
      }">
        ${showDeleteBtn ? this.createDeleteButtonHtml(item.key) : ""}
        ${
          showDrawToggleBtn && item.hasDrawPosition
            ? this.createDrawToggleButtonHtml(item)
            : ""
        }
        <img 
          src="${item.dataUrl}" 
          alt="Gallery item" 
          class="w-full h-32 aspect-square object-contain cursor-pointer" 
          style="image-rendering: pixelated; object-fit: contain;"
        >
        ${
          item.title
            ? `<div class="p-2 text-sm text-gray-600 truncate">${item.title}</div>`
            : ""
        }
      </div>
    `;
  }

  /**
   * 削除ボタンのHTMLを生成
   */
  private createDeleteButtonHtml(itemKey: string): string {
    return `
      <button 
        class="btn btn-xs btn-circle btn-ghost absolute -top-1 -right-1 z-10 opacity-50 hover:opacity-80 bg-white border border-gray-200 shadow-sm" 
        data-delete="${itemKey}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3">
          <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>
        </svg>
      </button>
    `;
  }

  /**
   * 描画切り替えボタンのHTMLを生成
   */
  private createDrawToggleButtonHtml(item: ImageItem): string {
    const isEnabled = item.drawEnabled;
    // const eyeClass = isEnabled ? "text-green-600" : "text-gray-400";
    const eyeStyle = isEnabled ? "color: #16a34a;" : "color: #9ca3af;";
    // const bgClass = isEnabled ? "bg-green-50" : "bg-gray-100";
    const bgStyle = isEnabled
      ? "background-color: #dcfce7;"
      : "background-color: #f3f4f6;";

    // 描画有効時は開いた目、無効時は閉じた目
    const eyeIcon = isEnabled
      ? `<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"/>`
      : `<path fill-rule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM7.823 9.177A4.31 4.31 0 006.586 12 4.31 4.31 0 0012 17.411c1.02 0 1.958-.351 2.696-.937L13.177 15c-.465.465-1.102.75-1.177.75a3 3 0 01-3-3c0-.075.285-.712.75-1.177L7.823 9.177zM7.29 6.696l8.014 8.014a4.31 4.31 0 001.282-3.123A4.31 4.31 0 0012 6.075a4.31 4.31 0 00-4.71.621z" clip-rule="evenodd"/>`;

    return `
      <button 
        class="btn btn-xs btn-circle btn-ghost absolute top-1 left-1 z-10 opacity-70 hover:opacity-100 border border-gray-200 shadow-sm" 
        data-draw-toggle="${item.key}"
        title="${isEnabled ? "Hide drawing" : "Show drawing"}"
        style="${bgStyle}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3" style="${eyeStyle}">
          ${eyeIcon}
        </svg>
      </button>
    `;
  }

  /**
   * 追加ボタンのHTMLを生成
   */
  private createAddButtonHtml(): string {
    return `
      <button 
        id="wps-gallery-add-btn" 
        class="btn btn-circle btn-primary absolute z-20 shadow-lg" 
        style="bottom: 1rem; right: 1rem;"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
          <path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
        </svg>
      </button>
    `;
  }

  /**
   * イベントリスナーを設定
   */
  private attachEventListeners(): void {
    this.attachAddButtonListener();
    this.attachDeleteButtonListeners();
    this.attachDrawToggleButtonListeners();
    this.attachImageClickListeners();
  }

  /**
   * 追加ボタンのイベントリスナーを設定
   */
  private attachAddButtonListener(): void {
    if (!this.options.showAddButton) return;

    const addBtn = this.container.querySelector(
      "#wps-gallery-add-btn"
    ) as HTMLButtonElement;
    addBtn?.addEventListener("click", () => {
      this.options.onAddClick?.();
    });
  }

  /**
   * 削除ボタンのイベントリスナーを設定
   */
  private attachDeleteButtonListeners(): void {
    if (!this.options.showDeleteButton || this.options.isSelectionMode) return;

    this.container.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-delete"
        );
        if (key && confirm(t`${"delete_image_confirm"}`)) {
          this.options.onImageDelete?.(key);
        }
      });
    });
  }

  /**
   * 描画切り替えボタンのイベントリスナーを設定
   */
  private attachDrawToggleButtonListeners(): void {
    if (!this.options.showDrawToggleButton || this.options.isSelectionMode)
      return;

    this.container.querySelectorAll("[data-draw-toggle]").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-draw-toggle"
        );
        if (key) {
          this.options.onDrawToggle?.(key);
        }
      });
    });
  }

  /**
   * 画像クリックのイベントリスナーを設定
   */
  private attachImageClickListeners(): void {
    this.container.querySelectorAll(".gallery-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        // 削除ボタンまたは描画切り替えボタンクリック時は処理しない
        if (
          (e.target as HTMLElement).closest("[data-delete]") ||
          (e.target as HTMLElement).closest("[data-draw-toggle]")
        ) {
          return;
        }

        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-item-key"
        );
        if (key) {
          const selectedItem = this.options.items.find(
            (item) => item.key === key
          );
          if (selectedItem) {
            if (this.options.isSelectionMode) {
              // 選択モード: 選択コールバック実行
              this.options.onImageSelect?.(selectedItem);
            } else {
              // 通常モード: 画像クリックコールバック実行
              this.options.onImageClick?.(selectedItem);
            }
          }
        }
      });
    });
  }

  /**
   * コンポーネントをクリーンアップ
   */
  destroy(): void {
    this.container.innerHTML = "";
  }
}
