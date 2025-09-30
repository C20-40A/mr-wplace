import { setupElementObserver } from "../../components/element-observer";
import { ImageSelectorModal } from "../gallery/routes/image-selector/ImageSelectorModal";
import { getCurrentPosition } from "../../utils/position";
import { findPositionModal } from "../../constants/selectors";
import { createDrawButton } from "./ui";
import { ImageItem } from "../gallery/routes/list/components";

/**
 * 画像描画機能の独立モジュール
 */
export class Drawing {
  private imageSelectorModal: ImageSelectorModal;

  constructor() {
    this.imageSelectorModal = new ImageSelectorModal();
    setupElementObserver([
      {
        id: "draw-btn",
        getTargetElement: findPositionModal,
        createElement: (container) => {
          const button = createDrawButton();
          button.id = "draw-btn"; // 重複チェック用ID設定
          button.addEventListener("click", () => this.openDrawMode());
          container.prepend(button);
          console.log("Draw button added to", container);
        },
      },
    ]);
  }

  private openDrawMode(): void {
    console.log("✏️ Opening image selector modal for drawing");
    this.imageSelectorModal.show(
      (selectedItem) => {
        this.startDraw(selectedItem);
      },
      () => {
        // 追加ボタンが押されたらGalleryのImage Editorへ遷移
        console.log("🎭 Navigating to Gallery Image Editor");
        const gallery = window.mrWplace?.gallery;
        if (!gallery) throw new Error("Gallery not found");
        gallery.navigateToImageEditor();
      }
    );
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
