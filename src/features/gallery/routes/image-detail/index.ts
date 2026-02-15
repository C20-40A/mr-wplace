import { GalleryItem } from "@/states/galleryStorage";
import { GalleryRouter } from "../../router";
import { GalleryUI } from "../../ui";
import { ImageInspector } from "@/components/image-inspector";
import {
  gotoMapPosition,
  toggleDrawState,
  drawImageAtMapCenter,
  downloadImage,
} from "../../common-actions";
import { t } from "@/i18n/manager";
import { showFeatureHint } from "@/features/feature-hints";
import { Toast } from "@/components/toast";
import { showNameInputModal } from "@/components/modal";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { createDPad } from "../../components/d-pad";

export class GalleryImageDetail {
  private currentItem: GalleryItem | null = null;
  private imageInspector: ImageInspector | null = null;
  private ui: GalleryUI | null = null;

  private initDPad(): void {
    const dpadContainer = document.getElementById("image-dpad-container");
    if (!dpadContainer || !this.currentItem?.drawPosition) return;

    // 既存のD-padをクリア
    dpadContainer.innerHTML = "";

    const dpad = createDPad({
      item: this.currentItem,
      onMove: async () => {
        // 座標入力フィールドを更新
        const storage = new (
          await import("../../../../states/galleryStorage")
        ).GalleryStorage();
        const updatedItem = await storage.get(this.currentItem!.key);
        if (updatedItem?.drawPosition) {
          this.currentItem = updatedItem;
          const coordTlx = document.getElementById(
            "coord-tlx",
          ) as HTMLInputElement;
          const coordTly = document.getElementById(
            "coord-tly",
          ) as HTMLInputElement;
          const coordPxx = document.getElementById(
            "coord-pxx",
          ) as HTMLInputElement;
          const coordPxy = document.getElementById(
            "coord-pxy",
          ) as HTMLInputElement;
          if (coordTlx) coordTlx.value = String(updatedItem.drawPosition.TLX);
          if (coordTly) coordTly.value = String(updatedItem.drawPosition.TLY);
          if (coordPxx) coordPxx.value = String(updatedItem.drawPosition.PxX);
          if (coordPxy) coordPxy.value = String(updatedItem.drawPosition.PxY);

          // 経度緯度表示更新
          const latLngDisplay = document.getElementById("lat-lng-display");
          if (latLngDisplay) {
            const { lat, lng } = tilePixelToLatLng(
              updatedItem.drawPosition.TLX,
              updatedItem.drawPosition.TLY,
              updatedItem.drawPosition.PxX,
              updatedItem.drawPosition.PxY,
            );
            latLngDisplay.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          }

          Toast.success(t`${"coordinates_updated"}`);
        }
      },
      size: "md",
      opacity: 0.7,
    });
    dpadContainer.appendChild(dpad);
  }

  private getDrawToggleIcon(enabled: boolean): string {
    const color = enabled ? "#16a34a" : "currentColor";
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; color: ${color};">
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"></path>
      </svg>
    `;
  }

  private showImageDetailHints(): void {
    const drawOnMapBtn = document.getElementById("draw-on-map-btn");
    if (drawOnMapBtn) showFeatureHint("image-detail-draw-on-map", drawOnMapBtn);

    if (this.currentItem?.drawPosition) {
      const dpadContainer = document.getElementById("image-dpad-container");
      if (dpadContainer) showFeatureHint("image-detail-dpad", dpadContainer);

      const downloadBtn = document.getElementById("download-btn");
      if (downloadBtn) showFeatureHint("image-detail-download", downloadBtn);
    }

    if (this.ui) {
      const modalElements = this.ui.getModalElements();
      if (modalElements) {
        showFeatureHint("image-detail-edit-title", modalElements.titleElement);
      }
    }
  }

  render(
    container: HTMLElement,
    router: GalleryRouter,
    item: GalleryItem,
    onDelete: (key: string) => void,
    onEdit?: () => void,
    ui?: GalleryUI,
  ): void {
    this.currentItem = item;
    this.ui = ui || null;

    // モーダルのタイトルを画像のタイトルに設定
    if (this.ui) {
      const displayTitle = (item.title || t("image_detail")) + " ✎";
      this.ui.setTitle(displayTitle);
    }

    // 既存のImageInspectorがあれば破棄
    if (this.imageInspector) {
      this.imageInspector.destroy();
      this.imageInspector = null;
    }

    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column; gap: 8px;">
        <!-- ボタンエリア -->
        <div style="padding: 8px 8px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="draw-toggle-btn" class="btn btn-sm btn-ghost" style="${item.drawPosition ? "" : "display:none"}" title="${
              item.drawEnabled ? t`${"draw_enabled"}` : t`${"draw_disabled"}`
            }">
              ${this.getDrawToggleIcon(!!item.drawEnabled)}
            </button>

            <button id="draw-on-map-btn" class="btn btn-sm btn-accent">
              🗺️ ${t`${"draw_on_map"}`}
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="delete-btn" class="btn btn-sm btn-error" title="${t`${"delete"}`}">
              🗑
            </button>
          </div>
        </div>

        <div id="image-detail-container" style="flex: 1; position: relative; min-height: 60vh; overflow-y: auto; overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
          <canvas id="image-detail-canvas" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"></canvas>
        </div>

        <!-- 座標編集エリア -->
        <div style="display: flex; align-items: center; align-self: center;">
          <!-- 左側: 上段と下段 -->
          <div style="display: flex; flex-direction: column; align-items: center;">
            <!-- 上段: マップ移動ボタン + 経度緯度表示 -->
            ${
              item.drawPosition
                ? `
              <div style="display: flex; align-items: center;">
                <button id="goto-map-btn" class="btn btn-sm btn-ghost"
                style="height: 28px; min-height: 28px; padding: 0 8px; flex-shrink: 0;" title="${t`${"goto_map"}`}">
                  📍
                </button>
                ${(() => {
                  const { lat, lng } = tilePixelToLatLng(
                    item.drawPosition.TLX,
                    item.drawPosition.TLY,
                    item.drawPosition.PxX,
                    item.drawPosition.PxY,
                  );
                  return `<div id="lat-lng-display" style="text-align: center; font-size: 11px; cursor: pointer; user-select: none; padding: 4px;" title="Click to copy">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>`;
                })()}
              </div>`
                : ""
            }

            <!-- 下段: コピー + 入力欄 + 更新 -->
            <div style="display: flex; align-items: center; gap: 2px;">
              <button id="copy-coords-btn" class="btn btn-sm btn-ghost" style="height: 28px; min-height: 28px; padding: 0 8px; flex-shrink: 0;" title="Copy">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <input id="coord-tlx" type="number" placeholder="TLX" value="${
                item.drawPosition?.TLX ?? 0
              }" style="width: 2.8rem; border: 1px solid #d1d5db; border-radius: 4px; text-align: center; font-size: .7rem;">
              <input id="coord-tly" type="number" placeholder="TLY" value="${
                item.drawPosition?.TLY ?? 0
              }" style="width: 2.8rem; border: 1px solid #d1d5db; border-radius: 4px; text-align: center; font-size: .7rem;">
              <input id="coord-pxx" type="number" placeholder="PxX" value="${
                item.drawPosition?.PxX ?? 0
              }" min="0" max="999" style="width: 2.8rem; border: 1px solid #d1d5db; border-radius: 4px; text-align: center; font-size: .7rem;">
              <input id="coord-pxy" type="number" placeholder="PxY" value="${
                item.drawPosition?.PxY ?? 0
              }" min="0" max="999" style="width: 2.8rem; border: 1px solid #d1d5db; border-radius: 4px; text-align: center; font-size: .7rem;">
              <button id="update-coords-btn" class="btn btn-sm btn-ghost" style="height: 28px; min-height: 28px; padding: 0 8px; flex-shrink: 0;" title="${t`${"update"}`}">
                🔄
              </button>
            </div>
          </div>

          <!-- 右側: D-Pad -->
          <div id="image-dpad-container" style=""></div>
        </div>

        <div style="padding: 0 8px 8px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button id="edit-btn" class="btn btn-primary">
              ✏️ ${t`${"edit"}`}
            </button>
            ${
              item.drawPosition
                ? `<div class="tooltip" data-tip="${t`${"share_description"}`}" style="width: 100%;">
                     <button id="download-btn" class="btn btn-accent" title="${t`${"share_description"}`}" style="width: 100%;">
                       📥 ${t`${"download"}`}
                     </button>
                   </div>`
                : `<button id="download-btn" class="btn btn-accent" style="width: 100%;">
                     📥 ${t`${"download"}`}
                   </button>`
            }
          </div>
        </div>
      </div>
    `;

    // 画像をcanvasに描画してImageInspectorを初期化
    this.loadImageToCanvas(item);

    // ボタンイベント設定
    this.setupButtonEvents(router, onDelete, onEdit);
  }

  private async loadImageToCanvas(item: GalleryItem): Promise<void> {
    const { getImageDataUrl } = await import("@/utils/indexed-db-bridge");
    const dataUrl = await getImageDataUrl(item, {
      showToastOnError: true,
      logContext: "image detail",
    });

    if (!dataUrl) return;

    this.loadImageToCanvasInternal(dataUrl);
  }

  private loadImageToCanvasInternal(dataUrl: string): void {
    const canvas = document.getElementById(
      "image-detail-canvas",
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
    onEdit?: () => void,
  ): void {
    if (!this.currentItem) return;

    // モーダルタイトルをクリックで編集
    if (this.ui) {
      const modalElements = this.ui.getModalElements();
      if (modalElements) {
        modalElements.titleElement.style.cursor = "pointer";
        modalElements.titleElement.onclick = async () => {
          if (!this.currentItem) return;

          const newTitle = await showNameInputModal(
            t`${"edit_image_title"}`,
            t`${"image_title_placeholder"}`,
          );

          if (newTitle === null) return;

          const { GalleryStorage } =
            await import("../../../../states/galleryStorage");
          const storage = new GalleryStorage();
          await storage.save({ ...this.currentItem, title: newTitle });

          this.currentItem.title = newTitle;

          // モーダルタイトルを更新
          if (this.ui) {
            this.ui.setTitle(newTitle || this.currentItem.key);
          }

          Toast.success(t`${"image_updated"}`);
        };
      }
    }

    // D-pad初期化
    this.initDPad();

    // マップに描画ボタン
    const drawOnMapBtn = document.getElementById("draw-on-map-btn");
    drawOnMapBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      try {
        await drawImageAtMapCenter(this.currentItem);

        // ボタン表示を更新
        const drawToggleBtn = document.getElementById("draw-toggle-btn");
        if (drawToggleBtn) drawToggleBtn.style.display = "";
        const shareBtn = document.getElementById("share-btn");
        if (shareBtn) shareBtn.style.display = "";
        const gotoMapBtn = document.getElementById("goto-map-btn");
        if (gotoMapBtn) gotoMapBtn.removeAttribute("disabled");

        // 座標入力フィールドを更新
        const storage = new (
          await import("../../../../states/galleryStorage")
        ).GalleryStorage();
        const updatedItem = await storage.get(this.currentItem.key);
        if (updatedItem?.drawPosition) {
          this.currentItem = updatedItem;
          const coordTlx = document.getElementById(
            "coord-tlx",
          ) as HTMLInputElement;
          const coordTly = document.getElementById(
            "coord-tly",
          ) as HTMLInputElement;
          const coordPxx = document.getElementById(
            "coord-pxx",
          ) as HTMLInputElement;
          const coordPxy = document.getElementById(
            "coord-pxy",
          ) as HTMLInputElement;
          if (coordTlx) coordTlx.value = String(updatedItem.drawPosition.TLX);
          if (coordTly) coordTly.value = String(updatedItem.drawPosition.TLY);
          if (coordPxx) coordPxx.value = String(updatedItem.drawPosition.PxX);
          if (coordPxy) coordPxy.value = String(updatedItem.drawPosition.PxY);

          // 経度緯度表示を追加
          const coordEditArea = document.querySelector(
            '[style*="padding: 0 8px; display: flex; flex-direction: column;"]',
          ) as HTMLElement;
          if (coordEditArea && !document.getElementById("lat-lng-display")) {
            const { lat, lng } = tilePixelToLatLng(
              updatedItem.drawPosition.TLX,
              updatedItem.drawPosition.TLY,
              updatedItem.drawPosition.PxX,
              updatedItem.drawPosition.PxY,
            );
            const latLngDiv = document.createElement("div");
            latLngDiv.id = "lat-lng-display";
            latLngDiv.style.cssText =
              "text-align: center; font-size: 10px; color: #666; cursor: pointer; user-select: none;";
            latLngDiv.title = "Click to copy";
            latLngDiv.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            latLngDiv.onclick = async () => {
              try {
                await navigator.clipboard.writeText(
                  latLngDiv.textContent || "",
                );
                Toast.success(t`${"copied"}`);
              } catch (err) {
                console.error("🧑‍🎨 : Failed to copy lat/lng", err);
                Toast.error("Failed to copy");
              }
            };
            coordEditArea.insertBefore(latLngDiv, coordEditArea.firstChild);
          }

          // D-pad表示
          this.initDPad();
        }

        this.showImageDetailHints();

        Toast.success(t`${"coordinates_updated"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to draw image at map center", err);
        Toast.error(String(err));
      }
    });

    // 描画ON/OFFボタン
    const drawToggleBtn = document.getElementById("draw-toggle-btn");
    drawToggleBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      const newDrawEnabled = await toggleDrawState(this.currentItem.key);

      // ボタン表示更新
      drawToggleBtn.className = "btn btn-sm btn-ghost";
      drawToggleBtn.innerHTML = this.getDrawToggleIcon(newDrawEnabled);
      drawToggleBtn.setAttribute(
        "title",
        newDrawEnabled ? t`${"draw_enabled"}` : t`${"draw_disabled"}`,
      );

      // 現在のアイテム状態更新
      this.currentItem.drawEnabled = newDrawEnabled;

      Toast.success(
        `${t`${"draw_state"}`}: ${
          newDrawEnabled ? t`${"enabled"}` : t`${"disabled"}`
        }`,
      );
    });

    // マップへ移動ボタン
    const gotoMapBtn = document.getElementById("goto-map-btn");
    gotoMapBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      await gotoMapPosition(this.currentItem);
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

    // ダウンロードボタン
    const downloadBtn = document.getElementById("download-btn");
    downloadBtn?.addEventListener("click", () => {
      if (!this.currentItem) return;

      try {
        downloadImage(this.currentItem, "image-detail-canvas");
        Toast.success(t`${"download_success"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to download image", err);
        Toast.error(String(err));
      }
    });

    // 座標更新ボタン
    const updateCoordsBtn = document.getElementById("update-coords-btn");
    updateCoordsBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      const tlx = parseInt(
        (document.getElementById("coord-tlx") as HTMLInputElement).value,
      );
      const tly = parseInt(
        (document.getElementById("coord-tly") as HTMLInputElement).value,
      );
      const pxx = parseInt(
        (document.getElementById("coord-pxx") as HTMLInputElement).value,
      );
      const pxy = parseInt(
        (document.getElementById("coord-pxy") as HTMLInputElement).value,
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
        this.currentItem,
      );

      // currentItem更新
      this.currentItem.drawPosition = {
        TLX: tlx,
        TLY: tly,
        PxX: pxx,
        PxY: pxy,
      };

      // 経度緯度表示更新
      const latLngDisplay = document.getElementById("lat-lng-display");
      if (latLngDisplay) {
        const { lat, lng } = tilePixelToLatLng(tlx, tly, pxx, pxy);
        latLngDisplay.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      Toast.success(t`${"coordinates_updated"}`);
    });

    // タイル座標コピーボタン
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

    // 経度緯度表示クリックでコピー
    const latLngDisplay = document.getElementById("lat-lng-display");
    latLngDisplay?.addEventListener("click", async () => {
      if (!this.currentItem?.drawPosition) return;

      const { TLX, TLY, PxX, PxY } = this.currentItem.drawPosition;
      const { lat, lng } = tilePixelToLatLng(TLX, TLY, PxX, PxY);
      const coordText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      try {
        await navigator.clipboard.writeText(coordText);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy lat/lng", err);
        Toast.error("Failed to copy");
      }
    });

    // Feature hints
    this.showImageDetailHints();
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
