import { ImageSelector } from "../../components/ImageSelector";
import { ImageItem } from "../list/components";
import { GalleryStorage } from "../../storage";
import {
  overlayLayers,
  moveLayer,
  removePreparedOverlayImageByKey,
} from "@/features/tile-draw/states";

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
   * レイヤー一覧を描画
   */
  private async renderLayerList(): Promise<void> {
    if (!this.layerPanel) return;

    this.layerPanel.innerHTML = "";

    if (overlayLayers.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = "No layers";
      emptyMsg.style.cssText =
        "text-align: center; color: #9ca3af; padding: 2rem;";
      this.layerPanel.appendChild(emptyMsg);
      return;
    }

    // Get all gallery items for thumbnail lookup
    const galleryItems = await this.galleryStorage.getAll();
    const galleryMap = new Map(galleryItems.map((item) => [item.key, item]));

    // Render each layer
    overlayLayers.forEach((layer, index) => {
      const galleryItem = galleryMap.get(layer.imageKey);

      const itemContainer = document.createElement("div");
      itemContainer.style.cssText =
        "border-bottom: 1px solid #e5e7eb; padding: 0.5rem; position: relative; display: flex; align-items: center; gap: 0.25rem;";

      // Delete button (×) - absolute position at top right
      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "×";
      deleteBtn.style.cssText =
        "position: absolute; top: 0; right: 0; background: none; border: none; font-size: 1.125rem; line-height: 1; opacity: 0.4; cursor: pointer; padding: 0.125rem 0.25rem;";
      deleteBtn.onmouseover = () => {
        deleteBtn.style.opacity = "1";
      };
      deleteBtn.onmouseout = () => {
        deleteBtn.style.opacity = "0.4";
      };
      deleteBtn.onclick = () => {
        removePreparedOverlayImageByKey(layer.imageKey);
        this.renderLayerList();
      };

      // Thumbnail (smaller)
      const thumbnail = document.createElement("img");
      thumbnail.src = galleryItem?.dataUrl || "";
      thumbnail.style.cssText =
        "width: 32px; height: 32px; object-fit: cover; border-radius: 0.25rem; flex-shrink: 0;";

      // Info container
      const infoContainer = document.createElement("div");
      infoContainer.style.cssText = "flex: 1; min-width: 0; padding-right: 1rem;";

      const indexLabel = document.createElement("div");
      indexLabel.textContent = `#${index + 1}`;
      indexLabel.style.cssText = "font-weight: 500; font-size: 0.75rem;";

      const statusLabel = document.createElement("div");
      statusLabel.textContent = layer.drawEnabled ? "✓" : "✗";
      statusLabel.style.cssText = `font-size: 0.625rem; color: ${
        layer.drawEnabled ? "#10b981" : "#ef4444"
      };`;

      infoContainer.appendChild(indexLabel);
      infoContainer.appendChild(statusLabel);

      // Move buttons (vertical only)
      const moveContainer = document.createElement("div");
      moveContainer.style.cssText =
        "display: flex; flex-direction: column; gap: 1px; flex-shrink: 0;";

      const createMoveButton = (direction: "up" | "down", symbol: string) => {
        const btn = document.createElement("button");
        btn.textContent = symbol;
        btn.style.cssText = `
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 0.125rem;
          font-size: 0.625rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.25rem;
          height: 1rem;
        `;
        btn.onmouseover = () => {
          btn.style.background = "#e5e7eb";
        };
        btn.onmouseout = () => {
          btn.style.background = "#f3f4f6";
        };
        btn.onclick = () => {
          moveLayer(layer.imageKey, direction);
          this.renderLayerList();
        };
        return btn;
      };

      moveContainer.appendChild(createMoveButton("up", "↑"));
      moveContainer.appendChild(createMoveButton("down", "↓"));

      itemContainer.appendChild(deleteBtn);
      itemContainer.appendChild(thumbnail);
      itemContainer.appendChild(infoContainer);
      itemContainer.appendChild(moveContainer);

      this.layerPanel.appendChild(itemContainer);
    });
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
