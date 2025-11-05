import { ImageSelector } from "../../components/ImageSelector";
import { ImageItem } from "../list/components";
import { GalleryStorage } from "../../storage";
import { t } from "@/i18n";
import {
  createAddImageButton,
  createUnplacedItem,
  createLayerItem,
} from "./components";

export class GalleryImageSelectorUI {
  private imageSelector: ImageSelector | null = null;
  private layerPanel: HTMLElement | null = null;
  private galleryStorage: GalleryStorage;
  private currentOnSelect: ((item: ImageItem) => void) | null = null;
  private currentOnShowDetail: ((item: ImageItem) => void) | null = null;
  private currentOnAddClick: (() => void) | null = null;

  constructor() {
    this.galleryStorage = new GalleryStorage();
  }

  /**
   * 画像選択UIをレンダリング
   */
  async render(
    container: HTMLElement,
    onSelect: (item: ImageItem) => void,
    onAddClick?: () => void,
    onShowDetail?: (item: ImageItem) => void
  ): Promise<void> {
    this.currentOnSelect = onSelect;
    this.currentOnShowDetail = onShowDetail ?? null;
    this.currentOnAddClick = onAddClick ?? null;
    container.innerHTML = "";

    // レイヤーパネル（単一カラム）
    this.layerPanel = document.createElement("div");
    this.layerPanel.style.cssText = "overflow-y: auto;";
    container.appendChild(this.layerPanel);

    await this.renderLayerList();

    // ヒントテキスト（下部）- 画像がある場合のみ表示
    const galleryItems = await this.galleryStorage.getAll();
    if (galleryItems.length > 0) {
      const hint = document.createElement("div");
      hint.textContent = t`${"click_image_to_draw"}`;
      hint.style.cssText =
        "margin-top: 1rem; font-size: 0.875rem; color: #6b7280; text-align: center;";
      container.appendChild(hint);
    }
  }

  /**
   * 座標テキストだけを更新（D-pad移動時）
   */
  async updateItemCoordinates(key: string): Promise<void> {
    const item = await this.galleryStorage.get(key);
    if (!item?.drawPosition) return;

    const itemEl = this.layerPanel?.querySelector(`[data-key="${key}"]`);
    if (!itemEl) return;

    const coordsText = itemEl.querySelector('[data-role="coords"]');
    if (coordsText) {
      coordsText.textContent = `${item.drawPosition.TLX},${item.drawPosition.TLY} (${item.drawPosition.PxX},${item.drawPosition.PxY})`;
    }
  }

  /**
   * ステータスバッジだけを更新（トグル時）
   */
  async updateItemStatus(key: string): Promise<void> {
    const item = await this.galleryStorage.get(key);
    if (!item) {
      console.warn("🧑‍🎨 : Item not found:", key);
      return;
    }

    const itemEl = this.layerPanel?.querySelector(`[data-key="${key}"]`);
    if (!itemEl) {
      console.warn("🧑‍🎨 : Item element not found:", key);
      return;
    }

    const statusBadge = itemEl.querySelector('[data-role="status"]') as HTMLElement;
    if (statusBadge) {
      statusBadge.textContent = item.drawEnabled ? "✓ ON" : "✗ OFF";
      statusBadge.style.background = item.drawEnabled ? "#d1fae5" : "#fee2e2";
      statusBadge.style.color = item.drawEnabled ? "#065f46" : "#991b1b";
    }

    const toggleBtn = itemEl.querySelector('[data-role="toggle"]') as HTMLElement;
    if (toggleBtn) {
      toggleBtn.innerHTML = item.drawEnabled ? "👁" : "🚫";
      toggleBtn.style.background = item.drawEnabled ? "#dbeafe" : "#f3f4f6";
      toggleBtn.style.border = `1px solid ${item.drawEnabled ? "#bfdbfe" : "#e5e7eb"}`;
    }

    console.log("🧑‍🎨 : Updated status for", key, "drawEnabled:", item.drawEnabled);
  }

  /**
   * レイヤーから未配置に移動（配置解除時）
   */
  async moveItemToUnplaced(key: string): Promise<void> {
    // レイヤーセクションから削除
    const layerItem = this.layerPanel?.querySelector(
      `.layer-section [data-key="${key}"]`
    );
    layerItem?.remove();

    // 未配置セクションに追加
    const item = await this.galleryStorage.get(key);
    if (!item) return;

    const unplacedGrid = this.layerPanel?.querySelector(
      ".unplaced-grid"
    ) as HTMLElement;
    if (!unplacedGrid || !this.currentOnSelect) return;

    const itemEl = createUnplacedItem(item, this.currentOnSelect);
    // 「＋」ボタンの前に挿入
    const addButton = unplacedGrid.querySelector(".add-button");
    if (addButton) {
      unplacedGrid.insertBefore(itemEl, addButton);
    } else {
      unplacedGrid.appendChild(itemEl);
    }
  }

  /**
   * レイヤーセクションのみを再描画（順序変更時）
   */
  async refreshLayerOrder(): Promise<void> {
    const layerSection = this.layerPanel?.querySelector(
      ".layer-section"
    ) as HTMLElement;
    if (!layerSection) return;

    const galleryItems = await this.galleryStorage.getAll();
    const layerImages = galleryItems
      .filter((i) => i.drawPosition)
      .sort((a, b) => (b.layerOrder ?? 0) - (a.layerOrder ?? 0));

    // レイヤーアイテムだけをクリア（タイトルは残す）
    const existingItems = layerSection.querySelectorAll("[data-key]");
    existingItems.forEach((item) => item.remove());

    if (layerImages.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = t`${"no_layers"}`;
      emptyMsg.style.cssText =
        "text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.875rem; background: #f9fafb; border-radius: 0.5rem;";
      layerSection.appendChild(emptyMsg);
    } else {
      layerImages.forEach((item, index) => {
        const itemEl = createLayerItem({
          item,
          index,
          totalCount: layerImages.length,
          onSelect: this.currentOnSelect!,
          onShowDetail: this.currentOnShowDetail,
          onUpdateCoords: (key) => this.updateItemCoordinates(key),
          onUpdateStatus: (key) => this.updateItemStatus(key),
          onMoveToUnplaced: (key) => this.moveItemToUnplaced(key),
          onRefreshOrder: () => this.refreshLayerOrder(),
        });
        layerSection.appendChild(itemEl);
      });
    }
  }

  /**
   * レイヤー一覧を描画（2セクション: 未配置 / レイヤー）
   */
  private async renderLayerList(): Promise<void> {
    if (!this.layerPanel || !this.currentOnSelect) return;

    this.layerPanel.innerHTML = "";

    const galleryItems = await this.galleryStorage.getAll();

    // 画像が1枚もない場合の専用UI
    if (galleryItems.length === 0) {
      const emptyContainer = document.createElement("div");
      emptyContainer.style.cssText =
        "display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; gap: 1rem;";

      const emptyMessage = document.createElement("div");
      emptyMessage.textContent = t`${"no_saved_images"}`;
      emptyMessage.style.cssText =
        "font-size: 0.875rem; color: #9ca3af; text-align: center;";

      emptyContainer.appendChild(emptyMessage);

      // 追加ボタン（currentOnAddClickがある場合のみ）
      if (this.currentOnAddClick) {
        const addButton = document.createElement("button");
        addButton.textContent = t`${"image_editor"}`;
        addButton.style.cssText = `
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s;
        `;
        addButton.onmouseenter = () => {
          addButton.style.background = "#2563eb";
          addButton.style.transform = "scale(1.05)";
        };
        addButton.onmouseleave = () => {
          addButton.style.background = "#3b82f6";
          addButton.style.transform = "scale(1)";
        };
        addButton.onclick = this.currentOnAddClick;

        emptyContainer.appendChild(addButton);
      }

      this.layerPanel.appendChild(emptyContainer);
      return;
    }
    const unplacedImages = galleryItems.filter((i) => !i.drawPosition);
    const layerImages = galleryItems
      .filter((i) => i.drawPosition)
      .sort((a, b) => (b.layerOrder ?? 0) - (a.layerOrder ?? 0)); // 降順：大→小

    // 未配置画像セクション（常に表示）
    const unplacedSection = document.createElement("div");
    unplacedSection.style.cssText = "margin-bottom: 1.5rem;";

    const sectionTitle = document.createElement("div");
    sectionTitle.textContent = t`${"unplaced_images"}`;
    sectionTitle.style.cssText =
      "font-weight: 600; font-size: 0.875rem; margin-bottom: 0.75rem; color: #374151; padding-left: 0.5rem; border-left: 3px solid #6366f1;";
    unplacedSection.appendChild(sectionTitle);

    const unplacedGrid = document.createElement("div");
    unplacedGrid.className = "unplaced-grid";
    unplacedGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 0.5rem;";

    unplacedImages.forEach((item) => {
      const itemEl = createUnplacedItem(item, this.currentOnSelect!);
      unplacedGrid.appendChild(itemEl);
    });

    // 「＋」ボタンを追加
    if (this.currentOnAddClick) {
      const addButton = createAddImageButton(this.currentOnAddClick);
      addButton.className = "add-button";
      unplacedGrid.appendChild(addButton);
    }

    unplacedSection.appendChild(unplacedGrid);

    this.layerPanel.appendChild(unplacedSection);

    // レイヤー画像セクション
    const layerSection = document.createElement("div");
    layerSection.className = "layer-section";
    const layerTitle = document.createElement("div");
    layerTitle.textContent = t`${"layers"}`;
    layerTitle.style.cssText =
      "font-weight: 600; font-size: 0.875rem; margin-bottom: 0.75rem; color: #374151; padding-left: 0.5rem; border-left: 3px solid #10b981;";
    layerSection.appendChild(layerTitle);

    if (layerImages.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = t`${"no_layers"}`;
      emptyMsg.style.cssText =
        "text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.875rem; background: #f9fafb; border-radius: 0.5rem;";
      layerSection.appendChild(emptyMsg);
    } else {
      layerImages.forEach((item, index) => {
        const itemEl = createLayerItem({
          item,
          index,
          totalCount: layerImages.length,
          onSelect: this.currentOnSelect!,
          onShowDetail: this.currentOnShowDetail,
          onUpdateCoords: (key) => this.updateItemCoordinates(key),
          onUpdateStatus: (key) => this.updateItemStatus(key),
          onMoveToUnplaced: (key) => this.moveItemToUnplaced(key),
          onRefreshOrder: () => this.refreshLayerOrder(),
        });
        layerSection.appendChild(itemEl);
      });
    }

    this.layerPanel.appendChild(layerSection);
  }

  /**
   * コンポーネントをクリーンアップ
   */
  destroy(): void {
    this.imageSelector?.destroy();
    this.imageSelector = null;
  }
}
