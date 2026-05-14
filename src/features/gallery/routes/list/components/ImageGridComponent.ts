import { t } from "@/i18n/manager";
import type { GalleryItem } from "@/states/galleryStorage";
import { runtime } from "@/utils/browser-api";
import { Tutorial } from "@/features/tutorial";

export interface ImageGridOptions {
  items: GalleryItem[];
  isSelectionMode?: boolean;
  onImageClick?: (item: GalleryItem) => void;
  onImageSelect?: (item: GalleryItem) => void;
  onImageDelete?: (key: string) => void;
  onDrawToggle?: (key: string) => void; // 描画状態切り替えコールバック
  onGotoPosition?: (item: GalleryItem) => void; // マップ移動コールバック
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
  private tutorial: Tutorial;
  private readonly overlayIconFilter =
    "drop-shadow(0 0 1px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.45))";

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
    this.tutorial = new Tutorial();
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
      this.tutorial.createButton(this.container);
      return;
    }

    this.renderImageGrid();
    this.tutorial.createButton(this.container);
  }

  /**
   * 空の状態を表示
   */
  private renderEmptyState(): void {
    // 空の状態では常に大きなprimaryボタンを表示
    const addButtonHtml = this.options.showAddButton
      ? this.createPrimaryAddButtonHtml()
      : "";

    const tutorialGifUrl = runtime.getURL(
      "assets/images/tutorial/how_to_draw.gif",
    );

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 2rem; min-height: 300px;">
        <img src="${tutorialGifUrl}" alt="How to draw" style="width: 18rem; height: auto; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">

        <div style="text-align: center; max-width: 400px;">
          <p style="font-size: 1rem; margin-bottom: 0.5rem;">${t`${"empty_gallery_message"}`}</p>
        </div>

        ${addButtonHtml}
      </div>
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
  private createImageItemHtml(item: GalleryItem): string {
    const showDeleteBtn =
      this.options.showDeleteButton && !this.options.isSelectionMode;
    const showDrawToggleBtn =
      this.options.showDrawToggleButton && !this.options.isSelectionMode;
    const showGotoPositionBtn =
      this.options.showGotoPositionButton &&
      !this.options.isSelectionMode &&
      item.drawPosition;

    const progressHtml = this.createProgressBarHtml(item);
    const titleHtml = this.createTitleHtml(item, !!progressHtml);

    return `
      <div class="border rounded-lg overflow-hidden shadow relative gallery-item" style="display: flex; flex-direction: column;" data-item-key="${
        item.key
      }">
        ${showDeleteBtn ? this.createDeleteButtonHtml(item.key) : ""}
        ${
          showDrawToggleBtn && item.drawPosition
            ? this.createDrawToggleButtonHtml(item)
            : ""
        }
        ${showGotoPositionBtn ? this.createGotoPositionButtonHtml(item) : ""}
        <img
          src="${item.thumbnail || item.dataUrl}"
          alt="Gallery item"
          class="w-full aspect-square object-contain cursor-pointer"
          style="image-rendering: pixelated; object-fit: contain;"
        >
        ${titleHtml}
        ${progressHtml}
      </div>
    `;
  }

  /**
   * オーバーレイアイコンボタン共通ファクトリ
   */
  private createOverlayIconButton(config: {
    dataAttr: string;
    value: string;
    position: { top?: string; left?: string; right?: string; bottom?: string };
    iconPath: string;
    title?: string;
    opacity?: number;
  }): string {
    const { dataAttr, value, position, iconPath, title, opacity = 0.72 } = config;
    const pos = Object.entries(position)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");
    const titleAttr = title ? `title="${title}"` : "";
    return `
      <button
        class="btn btn-xs btn-circle btn-ghost"
        ${dataAttr}="${value}"
        ${titleAttr}
        style="position: absolute; ${pos} z-index: 10; background: none; border: none; padding: 0; opacity: ${opacity};"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4" style="filter: ${this.overlayIconFilter};">
          ${iconPath}
        </svg>
      </button>
    `;
  }

  private createDeleteButtonHtml(itemKey: string): string {
    return this.createOverlayIconButton({
      dataAttr: "data-delete",
      value: itemKey,
      position: { top: "0.25rem", right: "0.25rem" },
      iconPath: `<path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>`,
    });
  }

  private createGotoPositionButtonHtml(item: GalleryItem): string {
    return this.createOverlayIconButton({
      dataAttr: "data-goto-position",
      value: item.key,
      position: { top: "0.25rem", left: "2rem" },
      title: "Go to map position",
      iconPath: `<path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>`,
    });
  }

  private createDrawToggleButtonHtml(item: GalleryItem): string {
    const isEnabled = item.drawEnabled;
    const eyeIcon = isEnabled
      ? `<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"/>`
      : `<path fill-rule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM7.823 9.177A4.31 4.31 0 006.586 12 4.31 4.31 0 0012 17.411c1.02 0 1.958-.351 2.696-.937L13.177 15c-.465.465-1.102.75-1.177.75a3 3 0 01-3-3c0-.075.285-.712.75-1.177L7.823 9.177zM7.29 6.696l8.014 8.014a4.31 4.31 0 001.282-3.123A4.31 4.31 0 0012 6.075a4.31 4.31 0 00-4.71.621z" clip-rule="evenodd"/>`;

    return this.createOverlayIconButton({
      dataAttr: "data-draw-toggle",
      value: item.key,
      position: { top: "0.25rem", left: "0.25rem" },
      title: isEnabled ? "Hide drawing" : "Show drawing",
      iconPath: eyeIcon,
      opacity: isEnabled ? 0.72 : 0.58,
    });
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
      : t`${"add_first_image"}`;
    return `
      <button id="wps-gallery-add-btn" class="btn btn-primary btn-lg" style="padding: 1rem 2rem; font-size: 1.125rem; gap: 0.75rem;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.5rem; height: 1.5rem;">
          <path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
        </svg>
        ${buttonText}
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
    this.attachGotoPositionButtonListeners();
    this.attachImageClickListeners();
    this.attachWheelPassthrough();
  }

  /**
   * スクロールイベントを親コンテナにパススルー
   */
  private attachWheelPassthrough(): void {
    const scrollContainer = this.container.closest(
      '[style*="overflow"]',
    ) as HTMLElement;
    if (!scrollContainer) return;

    this.container.querySelectorAll(".gallery-item").forEach((item) => {
      // デスクトップ: wheelイベント
      item.addEventListener(
        "wheel",
        (e) => {
          scrollContainer.scrollTop += (e as WheelEvent).deltaY;
        },
        { passive: true },
      );

      // モバイル: touchイベント
      let touchStartY = 0;
      item.addEventListener(
        "touchstart",
        (e) => {
          touchStartY = (e as TouchEvent).touches[0].clientY;
        },
        { passive: true },
      );

      item.addEventListener(
        "touchmove",
        (e) => {
          const touchY = (e as TouchEvent).touches[0].clientY;
          const deltaY = touchStartY - touchY;
          scrollContainer.scrollTop += deltaY;
          touchStartY = touchY;
        },
        { passive: true },
      );
    });
  }

  /**
   * 追加ボタンのイベントリスナーを設定
   */
  private attachAddButtonListener(): void {
    if (!this.options.showAddButton) return;

    const addBtn = this.container.querySelector(
      "#wps-gallery-add-btn",
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
          "data-delete",
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
          "data-goto-position",
        );
        if (!key) throw new Error("No key found on button");
        const selectedItem = this.options.items.find(
          (item) => item.key === key,
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
          "data-draw-toggle",
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
  private createTitleHtml(item: GalleryItem, hasProgress: boolean): string {
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
  private createProgressBarHtml(item: GalleryItem): string {
    if (!item.matchedColorStats || !item.totalColorStats) return "";

    const matched = Object.values(item.matchedColorStats).reduce(
      (sum, count) => sum + count,
      0,
    );
    const total = Object.values(item.totalColorStats).reduce(
      (sum, count) => sum + count,
      0,
    );

    if (total === 0) return "";

    const remaining = total - matched;
    // 100%未満なのに100.0%と表示されるのを防ぐ（99.95%以上で丸められる）
    const rawPercentage = (matched / total) * 100;
    const percentage = remaining > 0 ? Math.min(rawPercentage, 99.9) : 100;

    // 100% Complete: リッチな達成表示
    if (remaining === 0) {
      return `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0.375rem 0.625rem; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-top: 1px solid #fbbf24;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
            <span style="font-size: 0.875rem; font-weight: bold; color: #facc15; text-shadow: -1px -1px 0 #b45309, 1px -1px 0 #b45309, -1px 1px 0 #b45309, 1px 1px 0 #b45309; letter-spacing: 0.05em;">COMPLETE</span>
            <span style="font-size: 0.625rem; color: #92400e; font-family: ui-monospace, monospace; opacity: 0.8;">${total.toLocaleString()} pixels</span>
          </div>
        </div>
      `;
    }

    // 進行中: 通常のプログレスバー
    const timeStr = this.formatEstimatedTime(remaining);
    const isDarkTheme =
      document.documentElement.getAttribute("data-theme") === "dark";
    const percentageTextColor = isDarkTheme ? "#60a5fa" : "#3b82f6";

    return `
      <div class="border-t" style="background-color: oklch(var(--color-base-100)); flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0.375rem 0.625rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span style="font-size: 0.75rem; font-weight: 600; color: ${percentageTextColor}; font-family: ui-monospace, monospace;">${percentage.toFixed(
            1,
          )}%</span>
          <div style="flex: 1; position: relative; height: 0.375rem; background-color: #e5e7eb; border-radius: 0.25rem; overflow: hidden;">
            <div style="height: 100%; background: linear-gradient(to right, #3b82f6, #60a5fa); width: ${percentage.toFixed(
              1,
            )}%; transition: width 0.3s ease;"></div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.6875rem; font-family: ui-monospace, monospace; letter-spacing: 0.025em; flex-wrap: wrap;">
          <span style="margin-right: 0.5rem;">${matched.toLocaleString()}/${total.toLocaleString()}</span>
          ${
            remaining > 0
              ? `<span style="opacity: 0.8;">${remaining}px(${timeStr})</span>`
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
          "data-item-key",
        );
        if (key) {
          const selectedItem = this.options.items.find(
            (item) => item.key === key,
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
    this.tutorial.destroy();
  }
}
