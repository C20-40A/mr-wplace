import { GalleryItem } from "../../storage";
import { GalleryRouter } from "../../router";
import { ImageInspector } from "../../../../components/image-inspector";
import { GalleryImageActions } from "../../common-actions";
import { t } from "../../../../i18n/manager";
import { Toast } from "../../../../components/toast";

export class GalleryImageDetail {
  private currentItem: GalleryItem | null = null;
  private imageInspector: ImageInspector | null = null;

  render(
    container: HTMLElement,
    router: GalleryRouter,
    item: GalleryItem,
    onDelete: (key: string) => void
  ): void {
    this.currentItem = item;

    // 既存のImageInspectorがあれば破棄
    if (this.imageInspector) {
      this.imageInspector.destroy();
      this.imageInspector = null;
    }

    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div id="image-detail-container" style="flex: 1; position: relative; min-height: 70vh; overflow: hidden;">
          <canvas id="image-detail-canvas" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"></canvas>
        </div>
        
        <!-- ボタンエリア -->
        <div style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <button id="draw-toggle-btn" class="btn btn-sm ${
            item.drawEnabled ? "btn-success" : "btn-outline"
          }">
            ${item.drawEnabled ? t`${"draw_enabled"}` : t`${"draw_disabled"}`}
          </button>
          
          <button id="goto-map-btn" class="btn btn-sm btn-primary" ${
            !item.drawPosition ? "disabled" : ""
          }>
            ${t`${"goto_map"}`}
          </button>
          
          <button id="delete-btn" class="btn btn-sm btn-error">
            ${t`${"delete"}`}
          </button>
        </div>
      </div>
    `;

    // 画像をcanvasに描画してImageInspectorを初期化
    this.loadImageToCanvas(item.dataUrl);

    // ボタンイベント設定
    this.setupButtonEvents(router, onDelete);
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

      // 60vh/90vw相当のコンテナサイズを計算
      const vh60 = window.innerHeight * 0.6;
      const vw90 = window.innerWidth * 0.9;
      const containerSize = Math.min(vh60, vw90);

      // ImageInspectorを初期化
      this.imageInspector = new ImageInspector(canvas, {
        minZoom: 1.0,
        maxZoom: 5.0,
        containerSize: containerSize,
      });
    };
    img.src = dataUrl;
  }

  private setupButtonEvents(
    router: GalleryRouter,
    onDelete: (key: string) => void
  ): void {
    if (!this.currentItem) return;

    // 描画ON/OFFボタン
    const drawToggleBtn = document.getElementById("draw-toggle-btn");
    drawToggleBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      const newDrawEnabled = await GalleryImageActions.toggleDrawState(
        this.currentItem.key
      );

      // ボタン表示更新
      drawToggleBtn.className = `btn btn-sm ${
        newDrawEnabled ? "btn-success" : "btn-outline"
      }`;
      drawToggleBtn.textContent = newDrawEnabled
        ? t`${"draw_enabled"}`
        : t`${"draw_disabled"}`;

      // 現在のアイテム状態更新
      this.currentItem.drawEnabled = newDrawEnabled;

      Toast.success(
        `${t`${"draw_state"}`}: ${
          newDrawEnabled ? t`${"enabled"}` : t`${"disabled"}`
        }`
      );
    });

    // マップへ移動ボタン
    const gotoMapBtn = document.getElementById("goto-map-btn");
    gotoMapBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      await GalleryImageActions.gotoMapPosition(this.currentItem);
    });

    // 削除ボタン
    const deleteBtn = document.getElementById("delete-btn");
    deleteBtn?.addEventListener("click", () => {
      if (!this.currentItem) return;

      if (confirm(t`${"delete_confirm"}`)) {
        onDelete(this.currentItem.key);
        router.navigateBack(); // 削除後は一覧に戻る
        Toast.success(t`${"deleted"}`);
      }
    });
  }
}
