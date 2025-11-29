import { GalleryImageSelectorUI } from "./ui";
import type { GalleryItem } from "@/states/galleryStorage";

export class GalleryImageSelector {
  private ui: GalleryImageSelectorUI;

  constructor() {
    this.ui = new GalleryImageSelectorUI();
  }

  async render(
    container: HTMLElement,
    onSelect: (item: GalleryItem) => void,
    onAddClick?: () => void,
    onShowDetail?: (item: GalleryItem) => void
  ): Promise<void> {
    await this.ui.render(container, onSelect, onAddClick, onShowDetail);
  }

  destroy(): void {
    this.ui.destroy();
  }
}
