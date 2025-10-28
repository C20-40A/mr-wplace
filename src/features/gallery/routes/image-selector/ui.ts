import { ImageSelector } from "../../components/ImageSelector";
import { ImageItem } from "../list/components";
import { GalleryStorage } from "../../storage";

export class GalleryImageSelectorUI {
  private imageSelector: ImageSelector | null = null;
  private layerPanel: HTMLElement | null = null;
  private galleryStorage: GalleryStorage;

  constructor() {
    this.galleryStorage = new GalleryStorage();
  }

  /**
   * 画像選択UIをレンダリング
   */
  async render(
    container: HTMLElement,
    onSelect: (item: ImageItem) => void,
    onAddClick?: () => void
  ): Promise<void> {
    // Clear container
    container.innerHTML = "";

    // Create flex layout (left: layers, right: selector)
    const layout = document.createElement("div");
    layout.style.cssText = "display: flex; gap: 1rem;";

    // Left panel: Layer list (fixed width)
    this.layerPanel = document.createElement("div");
    this.layerPanel.style.cssText =
      "flex: 0 0 200px; max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.5rem;";

    // Right panel: Image selector
    const rightPanel = document.createElement("div");
    rightPanel.style.cssText = "flex: 1;";

    // Render layer list
    await this.renderLayerList();

    // Render image selector
    const galleryItems = await this.galleryStorage.getAll();
    const items = this.convertGalleryItemsToImageItems(galleryItems);

    this.imageSelector?.destroy();
    this.imageSelector = new ImageSelector({
      items,
      onSelect,
      onAddClick,
    });

    this.imageSelector.render(rightPanel);

    layout.appendChild(this.layerPanel);
    layout.appendChild(rightPanel);
    container.appendChild(layout);
  }

  /**
   * レイヤー一覧を描画（2セクション: 未配置 / レイヤー）
   */
  private async renderLayerList(): Promise<void> {
    if (!this.layerPanel) return;

    this.layerPanel.innerHTML = "";

    const galleryItems = await this.galleryStorage.getAll();
    const unplacedImages = galleryItems.filter(i => !i.drawPosition);
    const layerImages = galleryItems
      .filter(i => i.drawPosition)
      .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0));

    // 未配置画像セクション
    if (unplacedImages.length > 0) {
      const unplacedSection = document.createElement("div");
      unplacedSection.style.cssText = "margin-bottom: 1rem;";

      const sectionTitle = document.createElement("div");
      sectionTitle.textContent = "未配置画像";
      sectionTitle.style.cssText = "font-weight: 600; font-size: 0.875rem; margin-bottom: 0.5rem; color: #6b7280;";
      unplacedSection.appendChild(sectionTitle);

      unplacedImages.forEach(item => {
        const itemEl = this.createImageItem(item, false);
        unplacedSection.appendChild(itemEl);
      });

      this.layerPanel.appendChild(unplacedSection);
    }

    // レイヤー画像セクション
    const layerSection = document.createElement("div");
    const layerTitle = document.createElement("div");
    layerTitle.textContent = "レイヤー";
    layerTitle.style.cssText = "font-weight: 600; font-size: 0.875rem; margin-bottom: 0.5rem; color: #6b7280;";
    layerSection.appendChild(layerTitle);

    if (layerImages.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = "レイヤーなし";
      emptyMsg.style.cssText = "text-align: center; color: #9ca3af; padding: 1rem; font-size: 0.875rem;";
      layerSection.appendChild(emptyMsg);
    } else {
      layerImages.forEach((item, index) => {
        const itemEl = this.createLayerItem(item, index, layerImages.length);
        layerSection.appendChild(itemEl);
      });
    }

    this.layerPanel.appendChild(layerSection);
  }

  /**
   * 未配置画像アイテム作成
   */
  private createImageItem(item: any, _isLayer: boolean): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "border-bottom: 1px solid #e5e7eb; padding: 0.5rem; display: flex; align-items: center; gap: 0.5rem;";

    const thumbnail = document.createElement("img");
    thumbnail.src = item.dataUrl;
    thumbnail.style.cssText = "width: 32px; height: 32px; object-fit: cover; border-radius: 0.25rem; flex-shrink: 0;";

    const info = document.createElement("div");
    info.style.cssText = "flex: 1; font-size: 0.75rem; color: #6b7280;";
    info.textContent = item.title || `Image ${item.key.slice(0, 8)}`;

    container.appendChild(thumbnail);
    container.appendChild(info);

    return container;
  }

  /**
   * レイヤーアイテム作成
   */
  private createLayerItem(item: any, index: number, totalCount: number): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = "border-bottom: 1px solid #e5e7eb; padding: 0.5rem; position: relative; display: flex; align-items: center; gap: 0.25rem;";

    // 削除ボタン
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "×";
    deleteBtn.style.cssText = "position: absolute; top: 0; right: 0; background: none; border: none; font-size: 1.125rem; line-height: 1; opacity: 0.4; cursor: pointer; padding: 0.125rem 0.25rem;";
    deleteBtn.onmouseover = () => { deleteBtn.style.opacity = "1"; };
    deleteBtn.onmouseout = () => { deleteBtn.style.opacity = "0.4"; };
    deleteBtn.onclick = async () => {
      await this.galleryStorage.save({
        ...item,
        drawPosition: undefined,
        drawEnabled: false,
      });
      await this.renderLayerList();
    };

    // サムネイル
    const thumbnail = document.createElement("img");
    thumbnail.src = item.dataUrl;
    thumbnail.style.cssText = "width: 32px; height: 32px; object-fit: cover; border-radius: 0.25rem; flex-shrink: 0;";

    // 情報
    const infoContainer = document.createElement("div");
    infoContainer.style.cssText = "flex: 1; min-width: 0; padding-right: 1rem;";

    const indexLabel = document.createElement("div");
    indexLabel.textContent = `#${index + 1}`;
    indexLabel.style.cssText = "font-weight: 500; font-size: 0.75rem;";

    const statusLabel = document.createElement("div");
    statusLabel.textContent = item.drawEnabled ? "✓" : "✗";
    statusLabel.style.cssText = `font-size: 0.625rem; color: ${item.drawEnabled ? "#10b981" : "#ef4444"};`;

    infoContainer.appendChild(indexLabel);
    infoContainer.appendChild(statusLabel);

    // 移動ボタン
    const moveContainer = document.createElement("div");
    moveContainer.style.cssText = "display: flex; flex-direction: column; gap: 1px; flex-shrink: 0;";

    const createMoveButton = (direction: "up" | "down", symbol: string, disabled: boolean) => {
      const btn = document.createElement("button");
      btn.textContent = symbol;
      btn.disabled = disabled;
      btn.style.cssText = `
        background: ${disabled ? "#f9fafb" : "#f3f4f6"};
        border: 1px solid #e5e7eb;
        border-radius: 0.125rem;
        font-size: 0.625rem;
        cursor: ${disabled ? "not-allowed" : "pointer"};
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1rem;
        opacity: ${disabled ? "0.3" : "1"};
      `;
      if (!disabled) {
        btn.onmouseover = () => { btn.style.background = "#e5e7eb"; };
        btn.onmouseout = () => { btn.style.background = "#f3f4f6"; };
        btn.onclick = async () => {
          await this.galleryStorage.moveLayer(item.key, direction);
          await this.renderLayerList();
        };
      }
      return btn;
    };

    moveContainer.appendChild(createMoveButton("up", "↑", index === totalCount - 1));
    moveContainer.appendChild(createMoveButton("down", "↓", index === 0));

    container.appendChild(deleteBtn);
    container.appendChild(thumbnail);
    container.appendChild(infoContainer);
    container.appendChild(moveContainer);

    return container;
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
   * コンポーネントをクリーンアップ
   */
  destroy(): void {
    this.imageSelector?.destroy();
    this.imageSelector = null;
  }
}
