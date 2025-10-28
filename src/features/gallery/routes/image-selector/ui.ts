import { ImageSelector } from "../../components/ImageSelector";
import { ImageItem } from "../list/components";
import { GalleryStorage } from "../../storage";

export class GalleryImageSelectorUI {
  private imageSelector: ImageSelector | null = null;
  private layerPanel: HTMLElement | null = null;
  private galleryStorage: GalleryStorage;
  private currentOnSelect: ((item: ImageItem) => void) | null = null;

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
    this.currentOnSelect = onSelect; // 保存
    container.innerHTML = "";

    // ヒントテキスト
    const hint = document.createElement("div");
    hint.textContent = "地図に描画したい画像をクリックしてください";
    hint.style.cssText = "margin-bottom: 1rem; font-size: 0.875rem; color: #6b7280; text-align: center;";
    container.appendChild(hint);

    // レイヤーパネル（単一カラム）
    this.layerPanel = document.createElement("div");
    this.layerPanel.style.cssText = "max-height: 500px; overflow-y: auto;";
    container.appendChild(this.layerPanel);

    await this.renderLayerList();
  }

  /**
   * レイヤー一覧を描画（2セクション: 未配置 / レイヤー）
   */
  private async renderLayerList(): Promise<void> {
    if (!this.layerPanel || !this.currentOnSelect) return;

    this.layerPanel.innerHTML = "";

    const galleryItems = await this.galleryStorage.getAll();
    const unplacedImages = galleryItems.filter(i => !i.drawPosition);
    const layerImages = galleryItems
      .filter(i => i.drawPosition)
      .sort((a, b) => (b.layerOrder ?? 0) - (a.layerOrder ?? 0)); // 降順：大→小

    // 未配置画像セクション
    if (unplacedImages.length > 0) {
      const unplacedSection = document.createElement("div");
      unplacedSection.style.cssText = "margin-bottom: 1.5rem;";

      const sectionTitle = document.createElement("div");
      sectionTitle.textContent = "未配置画像";
      sectionTitle.style.cssText = "font-weight: 600; font-size: 0.875rem; margin-bottom: 0.75rem; color: #374151; padding-left: 0.5rem; border-left: 3px solid #6366f1;";
      unplacedSection.appendChild(sectionTitle);

      unplacedImages.forEach(item => {
        const itemEl = this.createUnplacedItem(item);
        unplacedSection.appendChild(itemEl);
      });

      this.layerPanel.appendChild(unplacedSection);
    }

    // レイヤー画像セクション
    const layerSection = document.createElement("div");
    const layerTitle = document.createElement("div");
    layerTitle.textContent = "レイヤー";
    layerTitle.style.cssText = "font-weight: 600; font-size: 0.875rem; margin-bottom: 0.75rem; color: #374151; padding-left: 0.5rem; border-left: 3px solid #10b981;";
    layerSection.appendChild(layerTitle);

    if (layerImages.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = "レイヤーなし";
      emptyMsg.style.cssText = "text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.875rem; background: #f9fafb; border-radius: 0.5rem;";
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
  private createUnplacedItem(item: any): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    `;

    container.onmouseenter = () => {
      container.style.background = "#f9fafb";
      container.style.transform = "translateY(-2px)";
      container.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
    };
    container.onmouseleave = () => {
      container.style.background = "#fff";
      container.style.transform = "translateY(0)";
      container.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
    };
    container.onclick = () => {
      this.currentOnSelect?.(this.convertGalleryItemToImageItem(item));
    };

    const thumbnail = document.createElement("img");
    thumbnail.src = item.dataUrl;
    thumbnail.style.cssText = "width: 48px; height: 48px; object-fit: cover; border-radius: 0.375rem; flex-shrink: 0; border: 1px solid #e5e7eb;";

    const info = document.createElement("div");
    info.style.cssText = "flex: 1; min-width: 0;";

    const title = document.createElement("div");
    title.textContent = item.title || `Image ${item.key.slice(0, 8)}`;
    title.style.cssText = "font-size: 0.875rem; font-weight: 500; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";

    const meta = document.createElement("div");
    meta.textContent = new Date(item.timestamp).toLocaleDateString('ja-JP');
    meta.style.cssText = "font-size: 0.75rem; color: #9ca3af; margin-top: 0.125rem;";

    info.appendChild(title);
    info.appendChild(meta);
    container.appendChild(thumbnail);
    container.appendChild(info);

    return container;
  }

  /**
   * レイヤーアイテム作成
   */
  private createLayerItem(item: any, index: number, totalCount: number): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    `;

    // メイン領域（クリック可能）
    const mainArea = document.createElement("div");
    mainArea.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      border-radius: 0.375rem;
      padding: 0.25rem;
      margin: -0.25rem;
      transition: background 0.15s;
    `;
    mainArea.onmouseenter = () => {
      mainArea.style.background = "#f3f4f6";
      container.style.transform = "translateY(-1px)";
      container.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
    };
    mainArea.onmouseleave = () => {
      mainArea.style.background = "transparent";
      container.style.transform = "translateY(0)";
      container.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
    };
    mainArea.onclick = () => {
      this.currentOnSelect?.(this.convertGalleryItemToImageItem(item));
    };

    // サムネイル
    const thumbnail = document.createElement("img");
    thumbnail.src = item.dataUrl;
    thumbnail.style.cssText = "width: 48px; height: 48px; object-fit: cover; border-radius: 0.375rem; flex-shrink: 0; border: 1px solid #e5e7eb;";

    // 情報
    const infoContainer = document.createElement("div");
    infoContainer.style.cssText = "flex: 1; min-width: 0;";

    const layerInfo = document.createElement("div");
    layerInfo.style.cssText = "display: flex; align-items: center; gap: 0.5rem;";

    const indexLabel = document.createElement("div");
    indexLabel.textContent = `#${index + 1}`;
    indexLabel.style.cssText = "font-weight: 600; font-size: 0.875rem; color: #374151;";

    const statusBadge = document.createElement("div");
    statusBadge.textContent = item.drawEnabled ? "✓ ON" : "✗ OFF";
    statusBadge.style.cssText = `
      font-size: 0.75rem;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-weight: 500;
      background: ${item.drawEnabled ? "#d1fae5" : "#fee2e2"};
      color: ${item.drawEnabled ? "#065f46" : "#991b1b"};
    `;

    layerInfo.appendChild(indexLabel);
    layerInfo.appendChild(statusBadge);

    const meta = document.createElement("div");
    meta.textContent = item.title || `Image ${item.key.slice(0, 8)}`;
    meta.style.cssText = "font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";

    infoContainer.appendChild(layerInfo);
    infoContainer.appendChild(meta);

    mainArea.appendChild(thumbnail);
    mainArea.appendChild(infoContainer);

    // ボタン領域（独立）
    const buttonArea = document.createElement("div");
    buttonArea.style.cssText = "display: flex; gap: 0.25rem; flex-shrink: 0;";
    buttonArea.onclick = (e) => e.stopPropagation(); // クリック伝播停止

    // 削除ボタン
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "×";
    deleteBtn.style.cssText = `
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 0.25rem;
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1rem;
      color: #991b1b;
      font-weight: 600;
      transition: all 0.15s;
    `;
    deleteBtn.onmouseenter = () => {
      deleteBtn.style.background = "#fecaca";
      deleteBtn.style.transform = "scale(1.1)";
    };
    deleteBtn.onmouseleave = () => {
      deleteBtn.style.background = "#fee2e2";
      deleteBtn.style.transform = "scale(1)";
    };
    deleteBtn.onclick = async () => {
      await this.galleryStorage.save({
        ...item,
        drawPosition: undefined,
        drawEnabled: false,
      });
      await this.renderLayerList();
    };

    // 移動ボタン
    const moveContainer = document.createElement("div");
    moveContainer.style.cssText = "display: flex; flex-direction: column; gap: 0.125rem;";

    const createMoveButton = (direction: "up" | "down", symbol: string, disabled: boolean) => {
      const btn = document.createElement("button");
      btn.textContent = symbol;
      btn.disabled = disabled;
      btn.style.cssText = `
        background: ${disabled ? "#f3f4f6" : "#dbeafe"};
        border: 1px solid ${disabled ? "#e5e7eb" : "#bfdbfe"};
        border-radius: 0.25rem;
        width: 1.75rem;
        height: 0.875rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: ${disabled ? "not-allowed" : "pointer"};
        font-size: 0.625rem;
        color: ${disabled ? "#9ca3af" : "#1e40af"};
        font-weight: 600;
        opacity: ${disabled ? "0.5" : "1"};
        transition: all 0.15s;
      `;
      if (!disabled) {
        btn.onmouseenter = () => {
          btn.style.background = "#bfdbfe";
          btn.style.transform = "scale(1.05)";
        };
        btn.onmouseout = () => {
          btn.style.background = "#dbeafe";
          btn.style.transform = "scale(1)";
        };
        btn.onclick = async () => {
          await this.galleryStorage.moveLayer(item.key, direction);
          await this.renderLayerList();
        };
      }
      return btn;
    };

    moveContainer.appendChild(createMoveButton("up", "↑", index === 0)); // 最上位で無効
    moveContainer.appendChild(createMoveButton("down", "↓", index === totalCount - 1)); // 最下位で無効

    buttonArea.appendChild(deleteBtn);
    buttonArea.appendChild(moveContainer);

    container.appendChild(mainArea);
    container.appendChild(buttonArea);

    return container;
  }

  /**
   * GalleryItemをImageItemに変換（単数）
   */
  private convertGalleryItemToImageItem(item: any): ImageItem {
    return {
      key: item.key,
      dataUrl: item.dataUrl,
      title: item.title,
      createdAt: new Date(item.timestamp).toISOString(),
      drawEnabled: item.drawEnabled,
      hasDrawPosition: !!item.drawPosition,
    };
  }

  /**
   * GalleryItemをImageItemに変換（複数）
   */
  private convertGalleryItemsToImageItems(galleryItems: any[]): ImageItem[] {
    return galleryItems.map((item) => this.convertGalleryItemToImageItem(item));
  }

  /**
   * コンポーネントをクリーンアップ
   */
  destroy(): void {
    this.imageSelector?.destroy();
    this.imageSelector = null;
  }
}
