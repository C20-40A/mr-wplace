import { GalleryItem } from "../../storage";
import { GalleryRouter } from "../../router";
import { ImageInspector } from "../../../../components/image-inspector";
import { gotoMapPosition, toggleDrawState } from "../../common-actions";
import { t } from "../../../../i18n/manager";
import { Toast } from "../../../../components/toast";
import { showNameInputModal } from "@/utils/modal";

export class GalleryImageDetail {
  private currentItem: GalleryItem | null = null;
  private imageInspector: ImageInspector | null = null;

  render(
    container: HTMLElement,
    router: GalleryRouter,
    item: GalleryItem,
    onDelete: (key: string) => void,
    onEdit?: () => void
  ): void {
    this.currentItem = item;

    // 既存のImageInspectorがあれば破棄
    if (this.imageInspector) {
      this.imageInspector.destroy();
      this.imageInspector = null;
    }

    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div id="image-detail-container" style="flex: 1; position: relative; min-height: 60vh; overflow: auto;">
          <canvas id="image-detail-canvas" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"></canvas>
        </div>
        
        <!-- ボタンエリア -->
        <div style=" display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 0.4rem;">
          <button id="draw-toggle-btn" class="btn btn-sm ${
            item.drawEnabled ? "btn-success" : "btn-outline"
          }" style="${item.drawPosition ? "" : "display:none"}">
            🎨 ${
              item.drawEnabled ? t`${"draw_enabled"}` : t`${"draw_disabled"}`
            }
          </button>

          <button id="goto-map-btn" class="btn btn-sm btn-primary" ${
            !item.drawPosition ? "disabled" : ""
          }>
            📍 ${t`${"goto_map"}`}
          </button>

          <button id="title-edit-btn" class="btn btn-sm btn-primary">
            📝 ${t`${"title"}`}
          </button>

          <button id="edit-btn" class="btn btn-sm btn-primary">
            ✏️ ${t`${"edit"}`}
          </button>

          <button id="share-btn" class="btn btn-sm btn-primary" ${
            !item.drawPosition ? 'style="display: none;"' : ""
          }>
            📤 ${t`${"share"}`}
          </button>

          <button id="delete-btn" class="btn btn-sm btn-error">
            🗑 ${t`${"delete"}`}
          </button>
        </div>
        
        <!-- 座標編集エリア -->
        <div style="padding: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; flex-wrap: wrap;">
          <label>TLX: <input id="coord-tlx" type="number" value="${
            item.drawPosition?.TLX ?? 0
          }" style="width: 60px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px;"></label>
          <label>TLY: <input id="coord-tly" type="number" value="${
            item.drawPosition?.TLY ?? 0
          }" style="width: 60px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px;"></label>
          <label>PxX: <input id="coord-pxx" type="number" value="${
            item.drawPosition?.PxX ?? 0
          }" style="width: 60px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px;"></label>
          <label>PxY: <input id="coord-pxy" type="number" value="${
            item.drawPosition?.PxY ?? 0
          }" style="width: 60px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 4px;"></label>
          <button id="update-coords-btn" class="btn btn-sm" style="height: 24px; min-height: 24px; padding: 0 12px;">🔄 ${t`${"update"}`}</button>
          <button id="copy-coords-btn" class="btn btn-sm btn-ghost" style="height: 24px; min-height: 24px; padding: 0 8px;" title="Copy">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // 画像をcanvasに描画してImageInspectorを初期化
    this.loadImageToCanvas(item.dataUrl);

    // ボタンイベント設定
    this.setupButtonEvents(router, onDelete, onEdit);
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
    onDelete: (key: string) => void,
    onEdit?: () => void
  ): void {
    if (!this.currentItem) return;

    // 描画ON/OFFボタン
    const drawToggleBtn = document.getElementById("draw-toggle-btn");
    drawToggleBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      const newDrawEnabled = await toggleDrawState(this.currentItem.key);

      // ボタン表示更新
      drawToggleBtn.className = `btn btn-sm ${
        newDrawEnabled ? "btn-success" : "btn-outline"
      }`;
      drawToggleBtn.textContent = newDrawEnabled
        ? `🎨 ${t`${"draw_enabled"}`}`
        : `🎨 ${t`${"draw_disabled"}`}`;

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

      await gotoMapPosition(this.currentItem);
    });

    // タイトル編集ボタン
    const titleEditBtn = document.getElementById("title-edit-btn");
    titleEditBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      const currentTitle = this.currentItem.title || "";
      const newTitle = await showNameInputModal(
        t`${"edit_image_title"}`,
        t`${"image_title_placeholder"}`
      );

      // キャンセルされた場合はnullが返る
      if (newTitle === null) return;

      // 新しいタイトルを保存
      const { GalleryStorage } = await import("../../storage");
      const storage = new GalleryStorage();
      await storage.save({ ...this.currentItem, title: newTitle });

      // currentItem更新
      this.currentItem.title = newTitle;
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

    // 編集ボタン
    const editBtn = document.getElementById("edit-btn");
    editBtn?.addEventListener("click", () => {
      if (!this.currentItem) return;

      onEdit?.();
      router.navigate("image-editor");
    });

    // シェアボタン
    const shareBtn = document.getElementById("share-btn");
    shareBtn?.addEventListener("click", () => {
      if (!this.currentItem) return;

      router.navigate("image-share");
    });

    // 座標更新ボタン
    const updateCoordsBtn = document.getElementById("update-coords-btn");
    updateCoordsBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      const tlx = parseInt(
        (document.getElementById("coord-tlx") as HTMLInputElement).value
      );
      const tly = parseInt(
        (document.getElementById("coord-tly") as HTMLInputElement).value
      );
      const pxx = parseInt(
        (document.getElementById("coord-pxx") as HTMLInputElement).value
      );
      const pxy = parseInt(
        (document.getElementById("coord-pxy") as HTMLInputElement).value
      );

      if (isNaN(tlx) || isNaN(tly) || isNaN(pxx) || isNaN(pxy)) {
        Toast.error(t`${"invalid_coordinates"}`);
        return;
      }

      console.log("🧑‍🎨 : Updating coordinates", {
        TLX: tlx,
        TLY: tly,
        PxX: pxx,
        PxY: pxy,
      });

      const tileOverlay = window.mrWplace?.tileOverlay;
      if (!tileOverlay) throw new Error("TileOverlay not found");

      await tileOverlay.drawImageWithCoords(
        { TLX: tlx, TLY: tly, PxX: pxx, PxY: pxy },
        this.currentItem
      );

      // currentItem更新
      this.currentItem.drawPosition = {
        TLX: tlx,
        TLY: tly,
        PxX: pxx,
        PxY: pxy,
      };

      Toast.success(t`${"coordinates_updated"}`);
    });

    // 座標コピーボタン
    const copyCoordsBtn = document.getElementById("copy-coords-btn");
    copyCoordsBtn?.addEventListener("click", async () => {
      if (!this.currentItem?.drawPosition) return;

      const { TLX, TLY, PxX, PxY } = this.currentItem.drawPosition;
      const coordText = `${TLX}-${TLY}-${PxX}-${PxY}`;

      try {
        await navigator.clipboard.writeText(coordText);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy coordinates", err);
        Toast.error("Failed to copy");
      }
    });
  }

  destroy(): void {
    console.log("🧑‍🎨 : Destroying GalleryImageDetail...");

    if (this.imageInspector) {
      this.imageInspector.destroy();
      this.imageInspector = null;
    }

    this.currentItem = null;

    console.log("🧑‍🎨 : GalleryImageDetail destroyed");
  }
}
