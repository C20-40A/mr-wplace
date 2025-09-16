import { GalleryItem } from "../../storage";
import { GalleryRouter } from "../../router";
import { ImageInspector } from "../../../../components/image-inspector";

export class GalleryImageDetail {
  private currentItem: GalleryItem | null = null;
  private imageInspector: ImageInspector | null = null;

  render(
    container: HTMLElement,
    router: GalleryRouter,
    item: GalleryItem
  ): void {
    this.currentItem = item;

    // 既存のImageInspectorがあれば破棄
    if (this.imageInspector) {
      this.imageInspector.destroy();
      this.imageInspector = null;
    }

    container.innerHTML = `
      <div class="flex flex-col items-center justify-center" style="height: 70vh;">
        <div id="image-detail-container" class="flex items-center justify-center relative" style="max-height: 70vh; max-width: 90vw;">
          <canvas id="image-detail-canvas" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></canvas>
        </div>
      </div>
    `;

    // 画像をcanvasに描画してImageInspectorを初期化
    this.loadImageToCanvas(item.dataUrl);
  }

  private loadImageToCanvas(dataUrl: string): void {
    const canvas = document.getElementById(
      "image-detail-canvas"
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // 70vh/90vw相当のコンテナサイズを計算
      const vh70 = window.innerHeight * 0.7;
      const vw90 = window.innerWidth * 0.9;
      const containerSize = Math.min(vh70, vw90);
      
      // ImageInspectorを初期化
      this.imageInspector = new ImageInspector(canvas, {
        minZoom: 1.0,
        maxZoom: 5.0,
        containerSize: containerSize,
      });
    };
    img.src = dataUrl;
  }
}
