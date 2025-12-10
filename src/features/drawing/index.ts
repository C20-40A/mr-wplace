import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
import { getCurrentPosition } from "../../utils/position";
import { findPositionModal, findMapPin } from "../../constants/selectors";
import { createDrawButton } from "./ui";
import { addMapPinButton } from "@/utils/map-pin-helper";
import { di } from "../../core/di";
import { t } from "@/i18n/manager";
import type { GalleryItem } from "@/states/galleryStorage";

const createMapPinButtons = (
  container: Element,
  drawInstance: Drawing
): void => {
  addMapPinButton(container, {
    id: "drawing-btn",
    icon: "🖼️",
    text: t`${"draw_image"}`,
    onClick: () => drawInstance.openDrawMode(),
  });
};

/**
 * 画像描画機能の独立モジュール
 */
export class Drawing {
  constructor() {
    const buttonConfigs: ElementConfig[] = [
      // 優先: マップピン周辺にボタン配置
      {
        id: "drawing-map-pin-btn",
        getTargetElement: findMapPin,
        createElement: (container) => createMapPinButtons(container, this),
      },
      // フォールバック: position modalにボタン配置
      {
        id: "draw-btn-fallback",
        getTargetElement: findPositionModal,
        createElement: (container) => {
          // マップピングループが既に存在する場合はスキップ
          if (document.querySelector("#map-pin-button-group")) return;

          const button = createDrawButton();
          button.id = "draw-btn-fallback";
          button.addEventListener("click", () => this.openDrawMode());
          container.prepend(button);
          console.log("🧑‍🎨 : Fallback button created in position modal");
        },
      },
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
    galleryItem: GalleryItem
  ): Promise<void> {
    console.log("📍 Drawing at:", lat, lng, "Image:", galleryItem.key);

    const tileOverlay = window.mrWplace?.tileOverlay;
    if (!tileOverlay) throw new Error("TileOverlay not found");

    await tileOverlay.drawImageAt(lat, lng, galleryItem);
  }
}
