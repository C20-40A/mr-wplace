import { setupButtonObserver } from "../../components/button-observer";
import { ImageSelectorModal } from "../gallery/routes/image-selector/ImageSelectorModal";
import { getCurrentPosition } from "../../utils/position";
import { CONFIG } from "../bookmark/config";
import { createDrawButton } from "./ui";
import { ImageItem } from "../gallery/routes/list/components";

/**
 * 画像描画機能の独立モジュール
 */
export class Drawing {
  private imageSelectorModal: ImageSelectorModal;

  constructor() {
    this.imageSelectorModal = new ImageSelectorModal();
    setupButtonObserver([
      {
        id: "draw-btn",
        selector: '[data-wplace-draw="true"]',
        containerSelector: CONFIG.selectors.positionModal,
        create: this.createDrawButton.bind(this),
      },
    ]);
  }

  private createDrawButton(container: Element): void {
    const button = createDrawButton(container);
    button.addEventListener("click", () => this.openDrawMode());
    console.log("🖼️ Draw button added");
  }

  private openDrawMode(): void {
    console.log("✏️ Opening image selector modal for drawing");
    this.imageSelectorModal.show((selectedItem) => {
      this.startDraw(selectedItem);
    });
  }

  private startDraw(imageItem: ImageItem): void {
    console.log("🎨 Start drawing with:", imageItem);

    const position = getCurrentPosition();
    if (!position) throw new Error("Current position not available");

    this.drawImageOnMap(position.lat, position.lng, imageItem);
  }

  public async drawImageOnMap(
    lat: number,
    lng: number,
    imageItem: ImageItem
  ): Promise<void> {
    console.log("📍 Drawing at:", lat, lng, "Image:", imageItem.key);

    const tileOverlay = (window as any).wplaceStudio?.tileOverlay;
    if (!tileOverlay) throw new Error("TileOverlay not found");

    await tileOverlay.drawImageAt(lat, lng, imageItem);
  }
}
