import { GalleryItem, GalleryStorage } from "../../storage";
import { GalleryRouter } from "../../router";
import { GalleryListUI } from "./ui";

export class GalleryList {
  private storage: GalleryStorage;
  private ui: GalleryListUI;
  private onDrawToggleCallback?: (key: string) => Promise<boolean>;

  constructor() {
    this.storage = new GalleryStorage();
    this.ui = new GalleryListUI();
  }

  async render(
    container: HTMLElement,
    router: GalleryRouter,
    isSelectionMode: boolean = false,
    onSelect?: (item: GalleryItem) => void,
    onImageClick?: (item: GalleryItem) => void,
    onDrawToggle?: (key: string) => Promise<boolean>
  ): Promise<void> {
    this.onDrawToggleCallback = onDrawToggle;
    const items = await this.storage.getAll();

    this.ui.render(
      items,
      async (key: string) => {
        await this.storage.delete(key);
        // 再描画
        this.render(container, router, isSelectionMode, onSelect, onImageClick, onDrawToggle);
      },
      isSelectionMode,
      onSelect,
      container
    );
  }

  destroy(): void {
    this.ui.destroy();
  }
}
