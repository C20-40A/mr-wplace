import { ImageSelector } from "../../components/ImageSelector";
import { ImageItem } from "../list/components";
import { GalleryStorage } from "../../storage";
import {
  toggleDrawState,
  gotoMapPosition,
  moveImage,
} from "../../common-actions";

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

    // レイヤーパネル（単一カラム）
    this.layerPanel = document.createElement("div");
    this.layerPanel.style.cssText = "max-height: 500px; overflow-y: auto;";
    container.appendChild(this.layerPanel);

    await this.renderLayerList();

    // ヒントテキスト（下部）
    const hint = document.createElement("div");
    hint.textContent = "地図に描画したい画像をクリックしてください";
    hint.style.cssText =
      "margin-top: 1rem; font-size: 0.875rem; color: #6b7280; text-align: center;";
    container.appendChild(hint);
  }

  /**
   * レイヤー一覧を描画（2セクション: 未配置 / レイヤー）
   */
  private async renderLayerList(): Promise<void> {
    if (!this.layerPanel || !this.currentOnSelect) return;

    this.layerPanel.innerHTML = "";

    const galleryItems = await this.galleryStorage.getAll();
    const unplacedImages = galleryItems.filter((i) => !i.drawPosition);
    const layerImages = galleryItems
      .filter((i) => i.drawPosition)
      .sort((a, b) => (b.layerOrder ?? 0) - (a.layerOrder ?? 0)); // 降順：大→小

    // 未配置画像セクション
    if (unplacedImages.length > 0) {
      const unplacedSection = document.createElement("div");
      unplacedSection.style.cssText = "margin-bottom: 1.5rem;";

      const sectionTitle = document.createElement("div");
      sectionTitle.textContent = "未配置画像";
      sectionTitle.style.cssText =
        "font-weight: 600; font-size: 0.875rem; margin-bottom: 0.75rem; color: #374151; padding-left: 0.5rem; border-left: 3px solid #6366f1;";
      unplacedSection.appendChild(sectionTitle);

      const unplacedGrid = document.createElement("div");
      unplacedGrid.style.cssText =
        "display: flex; flex-wrap: wrap; gap: 0.5rem;";

      unplacedImages.forEach((item) => {
        const itemEl = this.createUnplacedItem(item);
        unplacedGrid.appendChild(itemEl);
      });

      unplacedSection.appendChild(unplacedGrid);

      this.layerPanel.appendChild(unplacedSection);
    }

    // レイヤー画像セクション
    const layerSection = document.createElement("div");
    const layerTitle = document.createElement("div");
    layerTitle.textContent = "レイヤー";
    layerTitle.style.cssText =
      "font-weight: 600; font-size: 0.875rem; margin-bottom: 0.75rem; color: #374151; padding-left: 0.5rem; border-left: 3px solid #10b981;";
    layerSection.appendChild(layerTitle);

    if (layerImages.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = "レイヤーなし";
      emptyMsg.style.cssText =
        "text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.875rem; background: #f9fafb; border-radius: 0.5rem;";
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
   * 未配置画像アイテム作成（画像のみ）
   */
  private createUnplacedItem(item: any): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      cursor: pointer;
      transition: all 0.2s;
      border-radius: 0.5rem;
      overflow: hidden;
    `;

    const thumbnail = document.createElement("img");
    thumbnail.src = item.dataUrl;
    thumbnail.style.cssText =
      "width: 80px; height: 80px; object-fit: cover; border: 2px solid #e5e7eb; border-radius: 0.5rem; display: block;";

    container.onmouseenter = () => {
      thumbnail.style.transform = "scale(1.05)";
      thumbnail.style.borderColor = "#6366f1";
    };
    container.onmouseleave = () => {
      thumbnail.style.transform = "scale(1)";
      thumbnail.style.borderColor = "#e5e7eb";
    };
    container.onclick = () => {
      this.currentOnSelect?.(this.convertGalleryItemToImageItem(item));
    };

    container.appendChild(thumbnail);
    return container;
  }

  /**
   * レイヤーアイテム作成
   */
  private createLayerItem(
    item: any,
    index: number,
    totalCount: number
  ): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: stretch;
      gap: 0;
      transition: all 0.2s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    `;

    // コンテンツエリア（flex: 1）
    const contentArea = document.createElement("div");
    contentArea.style.cssText =
      "flex: 1; display: flex; align-items: center; gap: 0.5rem; min-width: 0; padding: 0.5rem;";

    // メイン領域（クリック可能）
    const mainArea = document.createElement("div");
    mainArea.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      border-radius: 0.375rem;
      padding: 0.5rem;
      margin: -0.5rem;
      transition: background 0.15s;
      min-width: 0;
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
    thumbnail.style.cssText =
      "width: 48px; height: 48px; object-fit: cover; border-radius: 0.375rem; flex-shrink: 0; border: 1px solid #e5e7eb;";

    // 情報
    const infoContainer = document.createElement("div");
    infoContainer.style.cssText = "flex: 1; min-width: 0;";

    const layerInfo = document.createElement("div");
    layerInfo.style.cssText =
      "display: flex; align-items: center; gap: 0.5rem;";

    const indexLabel = document.createElement("div");
    indexLabel.textContent = `#${index + 1}`;
    indexLabel.style.cssText =
      "font-weight: 600; font-size: 0.875rem; color: #374151;";

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

    // 座標表示
    const coordsText = document.createElement("div");
    coordsText.textContent = `${item.drawPosition.TLX},${item.drawPosition.TLY} (${item.drawPosition.PxX},${item.drawPosition.PxY})`;
    coordsText.style.cssText =
      "font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; font-family: monospace;";

    infoContainer.appendChild(layerInfo);
    infoContainer.appendChild(coordsText);

    mainArea.appendChild(thumbnail);
    mainArea.appendChild(infoContainer);

    // Divider
    const divider = document.createElement("div");
    divider.style.cssText =
      "width: 1px; background: #e5e7eb; align-self: stretch;";

    // ボタン領域
    const buttonArea = document.createElement("div");
    buttonArea.style.cssText =
      "display: flex; gap: 0.5rem; flex-shrink: 0; align-items: center;";
    buttonArea.onclick = (e) => e.stopPropagation();

    // D-pad（画像移動）- コンパクト化
    const dPadContainer = document.createElement("div");
    dPadContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 20px);
      grid-template-rows: repeat(3, 20px);
      gap: 1px;
    `;

    const createMoveImageButton = (
      direction: "up" | "down" | "left" | "right",
      symbol: string,
      gridColumn: string,
      gridRow: string
    ) => {
      const btn = document.createElement("button");
      btn.textContent = symbol;
      btn.style.cssText = `
        background: #e0f2fe;
        border: 1px solid #bae6fd;
        border-radius: 0.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 0.75rem;
        color: #0369a1;
        font-weight: 600;
        transition: all 0.15s;
        grid-column: ${gridColumn};
        grid-row: ${gridRow};
      `;
      btn.onmouseenter = () => {
        btn.style.background = "#bae6fd";
        btn.style.transform = "scale(1.05)";
      };
      btn.onmouseleave = () => {
        btn.style.background = "#e0f2fe";
        btn.style.transform = "scale(1)";
      };
      btn.onclick = async () => {
        await moveImage(item, direction);
        await this.renderLayerList();
      };
      return btn;
    };

    dPadContainer.appendChild(createMoveImageButton("up", "↑", "2", "1"));
    dPadContainer.appendChild(createMoveImageButton("left", "←", "1", "2"));
    dPadContainer.appendChild(createMoveImageButton("right", "→", "3", "2"));
    dPadContainer.appendChild(createMoveImageButton("down", "↓", "2", "3"));

    // トグルボタン
    const toggleBtn = document.createElement("button");
    toggleBtn.innerHTML = item.drawEnabled ? "👁" : "🚫";
    toggleBtn.style.cssText = `
      background: ${item.drawEnabled ? "#dbeafe" : "#f3f4f6"};
      border: 1px solid ${item.drawEnabled ? "#bfdbfe" : "#e5e7eb"};
      border-radius: 0.25rem;
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.15s;
    `;
    toggleBtn.onmouseenter = () => {
      toggleBtn.style.background = item.drawEnabled ? "#bfdbfe" : "#e5e7eb";
      toggleBtn.style.transform = "scale(1.1)";
    };
    toggleBtn.onmouseleave = () => {
      toggleBtn.style.background = item.drawEnabled ? "#dbeafe" : "#f3f4f6";
      toggleBtn.style.transform = "scale(1)";
    };
    toggleBtn.onclick = async () => {
      await toggleDrawState(item.key);
      await this.renderLayerList();
    };

    // Gotoボタン
    const gotoBtn = document.createElement("button");
    gotoBtn.innerHTML = "📍";
    gotoBtn.style.cssText = `
      background: #d1fae5;
      border: 1px solid #a7f3d0;
      border-radius: 0.25rem;
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.15s;
    `;
    gotoBtn.onmouseenter = () => {
      gotoBtn.style.background = "#a7f3d0";
      gotoBtn.style.transform = "scale(1.1)";
    };
    gotoBtn.onmouseleave = () => {
      gotoBtn.style.background = "#d1fae5";
      gotoBtn.style.transform = "scale(1)";
    };
    gotoBtn.onclick = async () => {
      const galleryItem = {
        ...item,
        timestamp: item.timestamp,
      };
      await gotoMapPosition(galleryItem);
    };

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

    buttonArea.appendChild(dPadContainer);
    buttonArea.appendChild(gotoBtn);
    buttonArea.appendChild(toggleBtn);
    buttonArea.appendChild(deleteBtn);

    contentArea.appendChild(mainArea);
    contentArea.appendChild(divider);
    contentArea.appendChild(buttonArea);

    // レイヤー移動ボタン（外側右端）
    const moveContainer = document.createElement("div");
    moveContainer.style.cssText =
      "display: flex; flex-direction: column; gap: 0.125rem; flex-shrink: 0; padding: 0.5rem 0.375rem; background: #f9fafb; border-left: 1px solid #e5e7eb;";
    moveContainer.onclick = (e) => e.stopPropagation();

    const createLayerMoveButton = (
      direction: "up" | "down",
      symbol: string,
      disabled: boolean
    ) => {
      const btn = document.createElement("button");
      btn.textContent = symbol;
      btn.disabled = disabled;
      btn.style.cssText = `
        background: ${disabled ? "#f3f4f6" : "#dbeafe"};
        border: 1px solid ${disabled ? "#e5e7eb" : "#bfdbfe"};
        border-radius: 0.25rem;
        width: 1.5rem;
        display: flex;
        flex: 1;
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

    moveContainer.appendChild(createLayerMoveButton("up", "⌃", index === 0));
    moveContainer.appendChild(
      createLayerMoveButton("down", "⌄", index === totalCount - 1)
    );

    container.appendChild(contentArea);
    container.appendChild(moveContainer);

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
