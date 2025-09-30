import { ImageGridComponent, ImageItem } from "../list/components";
import { GalleryStorage } from "../../storage";
import { t } from "../../../../i18n/manager";

export class ImageSelectorModal {
  private modal: HTMLDialogElement | null = null;
  private imageGrid: ImageGridComponent | null = null;
  private onSelectCallback?: (item: ImageItem) => void;
  private onAddClickCallback?: () => void;

  constructor() {
    this.createModal();
  }

  /**
   * モーダルを表示して画像選択モードを開始
   */
  async show(
    onSelect: (item: ImageItem) => void,
    onAddClick?: () => void
  ): Promise<void> {
    this.onSelectCallback = onSelect;
    this.onAddClickCallback = onAddClick;

    // ギャラリーから画像データを取得
    const galleryStorage = new GalleryStorage();
    const galleryItems = await galleryStorage.getAll();

    // GalleryItemをImageItemに変換
    const items = this.convertGalleryItemsToImageItems(galleryItems);

    // 画像グリッドを設定（描画用画像のみフィルタ）
    const drawableItems = items.filter((item) => item.hasDrawPosition);
    await this.setupImageGrid(drawableItems);

    // 説明メッセージの表示制御（描画アイテムがない場合は非表示）
    const instructionMessage = this.modal?.querySelector(
      "#instruction-message"
    );
    if (instructionMessage) {
      if (drawableItems.length === 0) {
        instructionMessage.classList.add("hidden");
      } else {
        instructionMessage.classList.remove("hidden");
      }
    }

    // モーダルを表示
    this.modal?.showModal();
  }

  /**
   * モーダルを閉じる
   */
  close(): void {
    this.modal?.close();
  }

  /**
   * モーダルのHTMLを作成
   */
  private createModal(): void {
    this.modal = document.createElement("dialog");
    this.modal.id = "wplace-studio-image-selector-modal";
    this.modal.className = "modal";

    this.modal.innerHTML = t`
      <div class="modal-box max-w-4xl h-[80vh] flex flex-col">
        <!-- ヘッダー -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
              <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clip-rule="evenodd"/>
            </svg>
            <h3 class="text-lg font-bold">${"select_image"}</h3>
          </div>
          
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost">✕</button>
          </form>
        </div>

        <!-- 説明 -->
        <div id="instruction-message" class="mb-4 p-3 bg-info/10 rounded-lg">
          <p class="text-sm text-info">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 inline mr-1">
              <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd"/>
            </svg>
            ${"click_image_to_draw"}
          </p>
        </div>

        <!-- 画像グリッドコンテナ -->
        <div id="image-selector-grid" class="flex-1 overflow-y-auto relative">
          <!-- ImageGridComponent がここに描画される -->
        </div>

        <!-- フッター -->
        <div class="pt-4 border-t">
          <!-- キャンセルボタン削除：FABとの重複回避 -->
        </div>
      </div>

      <!-- モーダル背景 -->
      <form method="dialog" class="modal-backdrop">
        <button>${"close"}</button>
      </form>
    `;

    document.body.appendChild(this.modal);
  }

  /**
   * 画像グリッドを設定
   */
  private async setupImageGrid(items: ImageItem[]): Promise<void> {
    const gridContainer = this.modal?.querySelector(
      "#image-selector-grid"
    ) as HTMLElement;
    if (!gridContainer) return;

    // 既存のグリッドがあれば破棄
    this.imageGrid?.destroy();

    // 新しい画像グリッドを作成
    this.imageGrid = new ImageGridComponent(gridContainer, {
      items,
      isSelectionMode: true, // 選択モードを有効化
      showDeleteButton: false, // 削除ボタンを非表示
      showAddButton: !!this.onAddClickCallback, // onAddClickがある場合のみ表示
      showDrawToggleButton: false, // 描画切り替えボタンを非表示
      showGotoPositionButton: false, // マップピンボタンを非表示
      emptyStateMessage: t`${"no_draw_images"}`,
      emptyStateButtonStyle: "primary", // 空状態ボタンをprimaryスタイルに
      emptyStateButtonText: "upload", // i18nキー
      gridCols: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
      onImageSelect: (item) => {
        // 画像が選択された時
        this.onSelectCallback?.(item);
        this.close();
      },
      onAddClick: () => {
        // 追加ボタンが押された時
        this.close();
        this.onAddClickCallback?.();
      },
    });

    this.imageGrid.render();
  }

  /**
   * GalleryItemをImageItemに変換
   */
  private convertGalleryItemsToImageItems(galleryItems: any[]): ImageItem[] {
    return galleryItems.map((item) => ({
      key: item.key,
      dataUrl: item.dataUrl,
      // タイトルや日付は表示しない
      title: undefined,
      createdAt: new Date(item.timestamp).toISOString(),
      drawEnabled: item.drawEnabled,
      hasDrawPosition: !!item.drawPosition,
    }));
  }

  /**
   * モーダルを破棄
   */
  destroy(): void {
    this.imageGrid?.destroy();
    this.modal?.remove();
    this.modal = null;
  }
}
