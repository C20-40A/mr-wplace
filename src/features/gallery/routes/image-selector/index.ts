import { GalleryRouter } from "../../router";
import { GalleryImageSelectorUI } from "./ui";
import { ImageItem } from "../list/components";

export class GalleryImageSelector {
  private ui: GalleryImageSelectorUI;

  constructor() {
    this.ui = new GalleryImageSelectorUI();
  }

  async render(
    container: HTMLElement,
    router: GalleryRouter,
    onSelect: (item: ImageItem) => void,
    onAddClick?: () => void,
    onShowDetail?: (item: ImageItem) => void
  ): Promise<void> {
    await this.ui.render(
      container,
      onSelect,
      onAddClick,
      onShowDetail
    );
  }

  destroy(): void {
    this.ui.destroy();
  }
}
