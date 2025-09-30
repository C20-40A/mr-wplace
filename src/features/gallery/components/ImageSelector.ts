import { ImageGridComponent, ImageItem } from "../routes/list/components";
import { t } from "../../../i18n/manager";

export interface ImageSelectorOptions {
  items: ImageItem[];
  onSelect: (item: ImageItem) => void;
  onAddClick?: () => void;
  showInstruction?: boolean;
  instructionMessage?: string;
  emptyStateMessage?: string;
  emptyStateButtonText?: string;
}

/**
 * 画像選択UI共通コンポーネント
 * モーダル機能なし、純粋なUI表示のみ
 */
export class ImageSelector {
  private imageGrid: ImageGridComponent | null = null;
  private options: ImageSelectorOptions;

  constructor(options: ImageSelectorOptions) {
    this.options = {
      showInstruction: true,
      instructionMessage: t`${"click_image_to_draw"}`,
      emptyStateMessage: t`${"no_draw_images"}`,
      emptyStateButtonText: "upload",
      ...options,
    };
  }

  /**
   * 指定コンテナに画像選択UIをレンダリング
   */
  render(container: HTMLElement): void {
    // 全画像を表示（未描画画像も描画対象として選択可能）
    const items = this.options.items;
    
    // コンテナHTMLを設定
    container.innerHTML = `
      <!-- 説明 -->
      ${this.options.showInstruction ? this.createInstructionHtml(items.length > 0) : ''}

      <!-- 画像グリッドコンテナ -->
      <div id="image-selector-grid" class="flex-1 overflow-y-auto relative">
        <!-- ImageGridComponent がここに描画される -->
      </div>
    `;

    this.setupImageGrid(container, items);
  }

  /**
   * 説明文のHTMLを生成
   */
  private createInstructionHtml(hasItems: boolean): string {
    if (!hasItems) return '';
    
    return `
      <div class="mb-4 p-3 bg-info/10 rounded-lg">
        <p class="text-sm text-info">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 inline mr-1">
            <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd"/>
          </svg>
          ${this.options.instructionMessage}
        </p>
      </div>
    `;
  }

  /**
   * 画像グリッドを設定
   */
  private setupImageGrid(container: HTMLElement, items: ImageItem[]): void {
    const gridContainer = container.querySelector("#image-selector-grid") as HTMLElement;
    if (!gridContainer) return;

    // 既存のグリッドがあれば破棄
    this.imageGrid?.destroy();

    // 新しい画像グリッドを作成
    this.imageGrid = new ImageGridComponent(gridContainer, {
      items,
      isSelectionMode: true, // 選択モードを有効化
      showDeleteButton: false, // 削除ボタンを非表示
      showAddButton: !!this.options.onAddClick, // onAddClickがある場合のみ表示
      showDrawToggleButton: false, // 描画切り替えボタンを非表示
      showGotoPositionButton: false, // マップピンボタンを非表示
      emptyStateMessage: this.options.emptyStateMessage!,
      emptyStateButtonStyle: "primary", // 空状態ボタンをprimaryスタイルに
      emptyStateButtonText: this.options.emptyStateButtonText!, // i18nキー
      gridCols: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
      onImageSelect: this.options.onSelect,
      onAddClick: this.options.onAddClick || (() => {}),
    });

    this.imageGrid.render();
  }

  /**
   * オプションを更新して再描画
   */
  updateOptions(newOptions: Partial<ImageSelectorOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * コンポーネントをクリーンアップ
   */
  destroy(): void {
    this.imageGrid?.destroy();
    this.imageGrid = null;
  }
}
