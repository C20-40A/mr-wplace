import { t } from "@/i18n/manager";

export interface ImageItem {
  key: string;
  dataUrl: string;
  thumbnail?: string;
  title?: string;
  createdAt?: string;
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  hasDrawPosition?: boolean;
  currentColorStats?: Record<string, number>;
  totalColorStats?: Record<string, number>;
}

export interface ImageGridOptions {
  items: ImageItem[];
  isSelectionMode?: boolean;
  onImageClick?: (item: ImageItem) => void;
  onImageSelect?: (item: ImageItem) => void;
  onImageDelete?: (key: string) => void;
  onDrawToggle?: (key: string) => void; // 描画状態切り替えコールバック
  onGotoPosition?: (item: ImageItem) => void; // マップ移動コールバック
  showDeleteButton?: boolean;
  showAddButton?: boolean;
  showDrawToggleButton?: boolean; // 描画切り替えボタンを表示するか
  showGotoPositionButton?: boolean; // マップピンボタンを表示するか
  onAddClick?: () => void;
  emptyStateMessage?: string;
  emptyStateButtonText?: string; // 空状態のボタンテキスト（i18nキー）
  emptyStateButtonStyle?: "fab" | "primary"; // 空状態のボタンスタイル
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
      showGotoPositionButton: true, // デフォルトでピンアイコンを表示
      emptyStateMessage: t`${"no_saved_images"}`,
      emptyStateButtonStyle: "fab", // デフォルトはFABボタン
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
    const addButtonHtml = this.options.showAddButton
      ? this.options.emptyStateButtonStyle === "primary"
        ? this.createPrimaryAddButtonHtml()
        : this.createAddButtonHtml()
      : "";

    this.container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <p>${this.options.emptyStateMessage}</p>
      </div>
      
      ${addButtonHtml}
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
    const showGotoPositionBtn =
      this.options.showGotoPositionButton &&
      !this.options.isSelectionMode &&
      item.hasDrawPosition;

    const progressHtml = this.createProgressBarHtml(item);
    const titleHtml = this.createTitleHtml(item, !!progressHtml);

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
        ${showGotoPositionBtn ? this.createGotoPositionButtonHtml(item) : ""}
        <img
          src="${item.thumbnail || item.dataUrl}"
          alt="Gallery item"
          class="w-full h-32 aspect-square object-contain cursor-pointer"
          style="image-rendering: pixelated; object-fit: contain;"
        >
        ${titleHtml}
        ${progressHtml}
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
   * マップピンボタンのHTMLを生成
   */
  private createGotoPositionButtonHtml(item: ImageItem): string {
    return `
      <button 
        class="btn btn-xs btn-circle btn-ghost opacity-70 hover:opacity-100 border border-gray-200 shadow-sm" 
        data-goto-position="${item.key}"
        title="Go to map position"
        style="position: absolute; top: 0.25rem; left: 2rem; z-index: 10; background-color: #f3f4f6;"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3" style="color: #059669;">
          <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
        </svg>
      </button>
    `;
  }
  private createDrawToggleButtonHtml(item: ImageItem): string {
    const isEnabled = item.drawEnabled;
    const eyeStyle = isEnabled ? "color: #16a34a;" : "color: #9ca3af;";
    const bgStyle = isEnabled
      ? "background-color: #dcfce7;"
      : "background-color: #f3f4f6;";

    // 描画有効時は開いた目、無効時は閉じた目
    const eyeIcon = isEnabled
      ? `<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"/>`
      : `<path fill-rule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM7.823 9.177A4.31 4.31 0 006.586 12 4.31 4.31 0 0012 17.411c1.02 0 1.958-.351 2.696-.937L13.177 15c-.465.465-1.102.75-1.177.75a3 3 0 01-3-3c0-.075.285-.712.75-1.177L7.823 9.177zM7.29 6.696l8.014 8.014a4.31 4.31 0 001.282-3.123A4.31 4.31 0 0012 6.075a4.31 4.31 0 00-4.71.621z" clip-rule="evenodd"/>`;

    return `
      <button 
        class="btn btn-xs btn-circle btn-ghost opacity-70 hover:opacity-100 border border-gray-200 shadow-sm" 
        data-draw-toggle="${item.key}"
        title="${isEnabled ? "Hide drawing" : "Show drawing"}"
        style="position: absolute; top: 0.25rem; left: 0.25rem; z-index: 10; ${bgStyle}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3" style="${eyeStyle}">
          ${eyeIcon}
        </svg>
      </button>
    `;
  }

  /**
   * 追加ボタン（FAB）のHTMLを生成
   */
  private createAddButtonHtml(): string {
    return `
      <button 
        id="wps-gallery-add-btn" 
        class="btn btn-circle btn-primary z-20 shadow-lg" 
        style="position: fixed; bottom: 1rem; right: 1rem;"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
          <path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
        </svg>
      </button>
    `;
  }

  /**
   * 追加ボタン（Primary）のHTMLを生成
   */
  private createPrimaryAddButtonHtml(): string {
    const buttonText = this.options.emptyStateButtonText
      ? t`${this.options.emptyStateButtonText}`
      : "+";
    return `
      <div class="text-center mt-4">
        <button id="wps-gallery-add-btn" class="btn btn-primary">
          ${buttonText}
        </button>
      </div>
    `;
  }

  /**
   * イベントリスナーを設定
   */
  private attachEventListeners(): void {
    this.attachAddButtonListener();
    this.attachDeleteButtonListeners();
    this.attachDrawToggleButtonListeners();
    this.attachGotoPositionButtonListeners();
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
   * マップピンボタンのイベントリスナーを設定
   */
  private attachGotoPositionButtonListeners(): void {
    if (!this.options.showGotoPositionButton || this.options.isSelectionMode) {
      console.log("🔍 Goto position button disabled");
      return;
    }

    const buttons = this.container.querySelectorAll("[data-goto-position]");
    console.log("🔍 Found goto position buttons:", buttons.length);

    buttons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-goto-position"
        );
        if (!key) throw new Error("No key found on button");
        const selectedItem = this.options.items.find(
          (item) => item.key === key
        );
        console.log("🔍 Selected item:", selectedItem);
        if (!selectedItem) throw new Error("Selected item not found");
        this.options.onGotoPosition?.(selectedItem);
      });
    });
  }
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
   * タイトルのHTMLを生成
   */
  private createTitleHtml(item: ImageItem, hasProgress: boolean): string {
    if (!item.title) return "";

    const bottomPosition = hasProgress ? "3.5rem" : "0.5rem";

    return `
      <div style="position: absolute; left: 0.5rem; bottom: ${bottomPosition}; z-index: 5;
                  background-color: rgba(255, 255, 255, 0.95);
                  backdrop-filter: blur(4px);
                  padding: 0.25rem 0.5rem;
                  border-radius: 0.5rem;
                  font-size: 0.75rem;
                  color: #1f2937;
                  font-weight: 500;
                  max-width: calc(100% - 1rem);
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  border: 1px solid rgba(0, 0, 0, 0.1);
                  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
        ${item.title}
      </div>
    `;
  }

  /**
   * 進捗バーのHTMLを生成
   */
  private createProgressBarHtml(item: ImageItem): string {
    if (!item.currentColorStats || !item.totalColorStats) return "";

    const matched = Object.values(item.currentColorStats).reduce(
      (sum, count) => sum + count,
      0
    );
    const total = Object.values(item.totalColorStats).reduce(
      (sum, count) => sum + count,
      0
    );

    if (total === 0) return "";

    const percentage = (matched / total) * 100;
    const remaining = total - matched;
    const timeStr = this.formatEstimatedTime(remaining);

    return `
      <div style="padding: 0.375rem 0.625rem; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span style="font-size: 0.75rem; font-weight: 600; color: #3b82f6; font-family: ui-monospace, monospace; min-width: 3rem;">${percentage.toFixed(
            1
          )}%</span>
          <div style="flex: 1; position: relative; height: 0.375rem; background-color: #e5e7eb; border-radius: 0.25rem; overflow: hidden;">
            <div style="height: 100%; background: linear-gradient(to right, #3b82f6, #60a5fa); width: ${percentage.toFixed(
              1
            )}%; transition: width 0.3s ease;"></div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.6875rem; color: #6b7280; font-family: ui-monospace, monospace; letter-spacing: 0.025em; flex-wrap: wrap;">
          <span>${matched.toLocaleString()}/${total.toLocaleString()}</span>
          ${
            remaining > 0
              ? `<span style="color: #9ca3af;">${remaining}px(${timeStr})</span>`
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * 予想完成時間をフォーマット (30秒/ピクセル)
   */
  private formatEstimatedTime(remainingPixels: number): string {
    const totalSeconds = remainingPixels * 30;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join("") : "<1m";
  }

  /**
   * 画像クリックのイベントリスナーを設定
   */
  private attachImageClickListeners(): void {
    this.container.querySelectorAll(".gallery-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        // 削除ボタン、描画切り替えボタン、マップピンボタンクリック時は処理しない
        if (
          (e.target as HTMLElement).closest("[data-delete]") ||
          (e.target as HTMLElement).closest("[data-draw-toggle]") ||
          (e.target as HTMLElement).closest("[data-goto-position]")
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
