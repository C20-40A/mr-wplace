import {
  setupElementObserver,
  type ElementConfig,
} from "../../components/element-observer";
import { getCurrentPosition } from "../../utils/position";
import { createMapPinButtonObserverConfig } from "@/utils/map-pin-helper";
import { di } from "../../core/di";
import { t } from "@/i18n/manager";
import type { GalleryItem } from "@/states/galleryStorage";

/**
 * 画像描画機能の独立モジュール
 */
export class Drawing {
  constructor() {
    const buttonConfigs: ElementConfig[] = [
      createMapPinButtonObserverConfig({
        observerId: "drawing-map-pin-btn",
        id: "drawing-btn",
        icon: "🖼️",
        text: t`${"draw_image"}`,
        onClick: () => this.openDrawMode(),
        hintId: "drawing-btn",
      }),
    ];

    setupElementObserver(buttonConfigs);
  }

  public openDrawMode(): void {
    console.log("✏️ Opening image selector for drawing");

    // DI ContainerからGallery取得
    const { showSelectionMode } = di.get("gallery");
    showSelectionMode((selectedItem) => {
      this.startDraw(selectedItem);
    });
  }

  private startDraw(galleryItem: GalleryItem): void {
    console.log("🎨 Start drawing with:", galleryItem);

    const position = getCurrentPosition();
    if (!position) throw new Error("Current position not available");

    this.drawImageOnMap(position.lat, position.lng, galleryItem);
  }

  public async drawImageOnMap(
    lat: number,
    lng: number,
    galleryItem: GalleryItem,
  ): Promise<void> {
    console.log("📍 Drawing at:", lat, lng, "Image:", galleryItem.key);

    const tileOverlay = window.mrWplace?.tileOverlay;
    if (!tileOverlay) throw new Error("TileOverlay not found");

    await tileOverlay.drawImageAt(lat, lng, galleryItem);
  }
}
