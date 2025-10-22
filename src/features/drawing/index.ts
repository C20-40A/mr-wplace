import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
import { getCurrentPosition } from "../../utils/position";
import { findPositionModal, findMapPin } from "../../constants/selectors";
import { createDrawButton } from "./ui";
import {
  getOrCreateMapPinButtonGroup,
  createMapPinGroupButton,
} from "@/components/map-pin-button";
import { ImageItem } from "../gallery/routes/list/components";
import { di } from "../../core/di";
import { t } from "@/i18n/manager";
// import { IMG_ICON_GALLERY } from "@/assets/iconImages";

/**
 * マップピン周辺にボタンを作成
 */
const createMapPinButtons = (
  container: Element,
  drawInstance: Drawing
): void => {
  const group = getOrCreateMapPinButtonGroup(container);

  // 既存ボタンチェック
  if (group.querySelector("#drawing-btn")) {
    console.log("🧑‍🎨 : Drawing button already exists");
    return;
  }

  const button = createMapPinGroupButton({
    // iconSrc: IMG_ICON_GALLERY,
    icon: "🖼️",
    text: t`${"draw"}`,
    onClick: () => drawInstance.openDrawMode(),
  });
  button.id = "drawing-btn";

  group.appendChild(button);
  console.log("🧑‍🎨 : Drawing button added to group");
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
          if (document.querySelector("#map-pin-button-group")) {
            console.log(
              "🧑‍🎨 : Map pin button group already exists, skipping fallback"
            );
            return;
          }

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

    const tileOverlay = window.mrWplace?.tileOverlay;
    if (!tileOverlay) throw new Error("TileOverlay not found");

    await tileOverlay.drawImageAt(lat, lng, imageItem);
  }
}
