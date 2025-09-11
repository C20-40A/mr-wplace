import { ButtonObserver, ButtonConfig } from "../../components/button-observer";
import { ImageSelectorModal } from "../gallery/routes/image-selector/ImageSelectorModal";
import { getCurrentPosition } from "../../utils/position";
import { CONFIG } from "../bookmark/config";
import { t } from "../../i18n/manager";
import { createDrawButton } from "./ui";
import { ImageItem } from "../gallery/routes/list/components";

/**
 * 画像描画機能の独立モジュール
 * favorite機能から分離
 */
export class Drawing {
  private selectedImage: any = null;
  private isDrawMode: boolean = false;
  private buttonObserver: ButtonObserver;
  private imageSelectorModal: ImageSelectorModal;

  constructor() {
    this.buttonObserver = new ButtonObserver();
    this.imageSelectorModal = new ImageSelectorModal();
    this.init();
  }

  private init(): void {
    const buttonConfigs: ButtonConfig[] = [
      {
        id: "draw-btn",
        selector: '[data-wplace-draw="true"]',
        containerSelector: CONFIG.selectors.positionModal,
        create: this.createDrawButton.bind(this),
      },
    ];

    this.buttonObserver.startObserver(buttonConfigs);
  }

  private createDrawButton(container: Element): void {
    const button = createDrawButton(container);
    button.addEventListener("click", () => this.openDrawMode());
    console.log("🖼️ WPlace Studio: Draw button added");
  }

  private openDrawMode(): void {
    console.log("✏️ Opening image selector modal for drawing");
    this.imageSelectorModal.show((selectedItem) => {
      this.startDraw(selectedItem);
    });
  }

  private startDraw(imageItem: ImageItem): void {
    console.log("🎨 Start drawing with:", imageItem);
    this.selectedImage = imageItem;
    this.isDrawMode = true;

    const position = getCurrentPosition();
    if (!position) {
      alert(t`${"location_unavailable"}`);
      this.resetDrawMode();
      return;
    }

    this.drawImageOnMap(position.lat, position.lng, imageItem);
  }

  private resetDrawMode(): void {
    this.selectedImage = null;
    this.isDrawMode = false;
  }

  public async drawImageOnMap(
    lat: number,
    lng: number,
    imageItem: ImageItem
  ): Promise<void> {
    console.log("📍 Drawing at:", lat, lng, "Image:", imageItem.key);

    const tileOverlay = (window as any).wplaceStudio?.tileOverlay;
    if (!tileOverlay) {
      console.error("TileOverlay instance not found");
      return;
    }

    try {
      await tileOverlay.drawImageAt(lat, lng, imageItem);
      console.log("✅ Image drawing completed");
    } catch (error) {
      console.error("❌ Image drawing failed:", error);
    }

    this.resetDrawMode();
  }
}
