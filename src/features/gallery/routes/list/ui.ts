import { GalleryItem, GalleryStorage } from "@/states/galleryStorage";
import { ImageGridComponent } from "./components/ImageGridComponent";
import { gotoMapPosition, toggleDrawState } from "../../common-actions";
import { t } from "@/i18n";

export type GallerySortType = "layer" | "distance" | "created";

export class GalleryListUI {
  private container: HTMLElement | null = null;
  private imageGrid: ImageGridComponent | null = null;
  private storage = new GalleryStorage();

  // コールバックを保存して再描画時に再利用
  private onDelete?: (key: string) => void;
  private onImageClick?: (item: GalleryItem) => void;
  private onAddClick?: () => void;
  private onCloseModal?: () => void;
  private onSortChange?: (sortType: GallerySortType) => void;
  private sortType: GallerySortType = "layer";

  constructor() {}

  render(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    container?: HTMLElement,
    onAddClick?: () => void,
    onImageClick?: (item: GalleryItem) => void,
    onCloseModal?: () => void,
    sortType?: GallerySortType,
    onSortChange?: (sortType: GallerySortType) => void
  ): void {
    if (!container) return;

    // 状態を保存
    this.container = container;
    this.onDelete = onDelete;
    this.onImageClick = onImageClick;
    this.onAddClick = onAddClick;
    this.onCloseModal = onCloseModal;
    this.onSortChange = onSortChange;
    if (sortType) this.sortType = sortType;

    this.renderGalleryList(items);
  }

  private renderGalleryList(items: GalleryItem[]): void {
    if (!this.container) return;

    this.container.innerHTML = "";

    // Sort dropdown
    const sortContainer = document.createElement("div");
    sortContainer.className = "flex items-center gap-2 mb-4";
    sortContainer.innerHTML = `
      <select id="wps-gallery-sort" class="select select-sm select-bordered">
        <option value="layer">${t`${"sort_layer"}`}</option>
        <option value="distance">${t`${"sort_distance"}`}</option>
        <option value="created">${t`${"sort_created"}`}</option>
      </select>
    `;
    this.container.appendChild(sortContainer);

    const sortSelect = sortContainer.querySelector(
      "#wps-gallery-sort"
    ) as HTMLSelectElement;
    sortSelect.value = this.sortType;
    sortSelect.addEventListener("change", (e) => {
      this.sortType = (e.target as HTMLSelectElement).value as GallerySortType;
      this.onSortChange?.(this.sortType);
    });

    // Grid container
    const gridContainer = document.createElement("div");
    this.container.appendChild(gridContainer);

    if (this.imageGrid) this.imageGrid.destroy();

    this.imageGrid = new ImageGridComponent(gridContainer, {
      items,
      isSelectionMode: false,
      onImageClick: (item) => this.onImageClick?.(item),
      onDrawToggle: (key) => this.handleDrawToggle(key),
      onImageDelete: (key) => this.onDelete?.(key),
      onGotoPosition: (item) => this.handleGotoPosition(item),
      onAddClick: () => this.onAddClick?.(),
      showDeleteButton: true,
      showAddButton: true,
    });

    this.imageGrid.render();
  }

  private async handleDrawToggle(key: string): Promise<void> {
    const newDrawEnabled = await toggleDrawState(key);
    console.log(`🧑‍🎨 : Draw toggle: ${key} -> ${newDrawEnabled}`);

    // 再描画
    const updatedItems = await this.storage.getAll();
    this.renderGalleryList(updatedItems);
  }

  private async handleGotoPosition(item: GalleryItem): Promise<void> {
    await gotoMapPosition(item);
    this.onCloseModal?.();
  }

  destroy(): void {
    if (this.imageGrid) {
      this.imageGrid.destroy();
      this.imageGrid = null;
    }
  }
}
