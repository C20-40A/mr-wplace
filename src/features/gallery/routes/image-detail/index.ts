import { GalleryItem, DrawPosition } from "@/states/galleryStorage";
import { confirmDelete } from "../../delete-confirm-dialog";
import { GalleryRouter } from "../../router";
import { GalleryUI } from "../../ui";
import { ImageInspector } from "@/components/image-inspector";
import {
  gotoMapPosition,
  toggleDrawState,
  drawImageAtMapCenter,
  downloadImage,
  downloadWplaceFile,
} from "../../common-actions";
import { t } from "@/i18n/manager";
import { showFeatureHint } from "@/features/feature-hints";
import { Toast } from "@/components/toast";
import { showNameInputModal } from "@/components/modal";
import { showDownloadFormatDialog } from "./download-dialog";
import { getMapInstanceReady } from "@/states/map-instance-ready";
import { ImageAdjustToolMode } from "@/features/image-adjust-tool";
import { createRichGauge } from "@/components/progress-gauge";
import { getStatsPerImage } from "@/utils/inject-bridge";
import { setGalleryImageTemporarilyHidden } from "@/core/bridge";

export class GalleryImageDetail {
  private currentItem: GalleryItem | null = null;
  private imageInspector: ImageInspector | null = null;
  private ui: GalleryUI | null = null;
  private adjustTool: ImageAdjustToolMode | null = null;
  private onItemUpdated?: (item: GalleryItem) => void;

  /** 次の render 直後に調節ツールを開く（レイヤー一覧の move リンク用） */
  static openAdjustOnNextRender = false;

  /**
   * 「マップに描画」ボタンを描画する。
   * マップが使えるときは調節ツール、使えないときは直接描画へルーティングする。
   */
  private initDrawOnMapButton(): void {
    const container = document.getElementById("image-draw-on-map-container");
    if (!container) return;

    container.innerHTML = "";

    const btn = document.createElement("button");
    btn.id = "draw-on-map-btn";
    btn.type = "button";
    btn.className = "btn btn-primary";
    btn.textContent = `🗺️ ${t`${"draw_on_map"}`}`;
    btn.addEventListener("click", () => {
      void this.handleDrawOnMap();
    });
    container.appendChild(btn);
  }

  /**
   * 「マップに描画」のルーティング。
   * インスタンスがある: 調節ツール / インスタンスがない: 直接描画
   */
  private async handleDrawOnMap(): Promise<void> {
    if (!this.currentItem) return;

    if (getMapInstanceReady()) {
      await this.openAdjustTool();
      return;
    }

    await this.drawImageAtMapCenterDirect();
  }

  /** マップ中央に直接描画する（マップインスタンスが無いときの「マップに描画」） */
  private async drawImageAtMapCenterDirect(): Promise<void> {
    if (!this.currentItem) return;

    try {
      await drawImageAtMapCenter(this.currentItem);

      // 位置情報が付与されたので最新のアイテムを読み直す
      const storage = new (
        await import("../../../../states/galleryStorage")
      ).GalleryStorage();
      const updatedItem = await storage.get(this.currentItem.key);
      if (updatedItem?.drawPosition) {
        this.currentItem = updatedItem;
        // 座標UIごと再描画して新しい位置を反映する
        this.onItemUpdated?.(updatedItem);
      }

      this.showImageDetailHints();
      Toast.success(t`${"coordinates_updated"}`);
    } catch (err) {
      console.error("🧑‍🎨 : Failed to draw image at map center", err);
      Toast.error(String(err));
    }
  }

  private loadImageElement(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /**
   * 画像詳細から調節ツール（place & resize）を開く。
   * confirm 後は保存して同じ画像詳細を再描画する。
   */
  private async openAdjustTool(): Promise<void> {
    const item = this.currentItem;
    if (!item) return;

    if (!getMapInstanceReady()) {
      Toast.error(t`${"map_not_ready"}`);
      return;
    }

    const { getImageDataUrl } = await import("@/utils/indexed-db-bridge");
    const dataUrl = await getImageDataUrl(item, {
      showToastOnError: true,
      logContext: "image detail adjust",
    });
    if (!dataUrl) return;

    const image = await this.loadImageElement(dataUrl);
    if (!image) return;

    this.adjustTool?.destroy();
    this.adjustTool = new ImageAdjustToolMode({
      imageSrc: dataUrl,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      // 配置済み画像は実寸(scale=1)で開き、現在位置から調整を始める
      initialScale: 1,
      initialDrawPosition: item.drawPosition,
      onConfirm: ({ widthPx, heightPx, drawPosition }) =>
        // 保存が終わるまで confirm を待たせる（終了処理の順序を保つ）
        this.applyAdjustResult(image, widthPx, heightPx, drawPosition),
      onCancel: () => {
        this.adjustTool = null;
        void setGalleryImageTemporarilyHidden(item.key, false);
      },
    });

    const opened = this.adjustTool.open();
    if (!opened) {
      this.adjustTool = null;
      return;
    }
    // 移動中は元位置のタイル描画が枠と重なって紛らわしいので一時的に消す
    void setGalleryImageTemporarilyHidden(item.key, true);

    // マップが画像から離れていると調整しづらいので、画像の位置へ移動しておく
    if (item.drawPosition) {
      await gotoMapPosition(item);
    }
  }

  private resizeDataUrl(
    image: HTMLImageElement,
    width: number,
    height: number,
  ): string {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return image.src;
    // パレット量子化済みの画像なので最近傍で拡縮し、色を維持する
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  }

  private async applyAdjustResult(
    image: HTMLImageElement,
    widthPx: number,
    heightPx: number,
    drawPosition: DrawPosition | null,
  ): Promise<void> {
    const item = this.currentItem;
    if (!item) return;

    const targetWidth = Math.max(1, Math.round(widthPx));
    const targetHeight = Math.max(1, Math.round(heightPx));
    const sizeChanged =
      item.width !== targetWidth || item.height !== targetHeight;

    const updated: GalleryItem = {
      ...item,
      drawPosition: drawPosition ?? item.drawPosition,
      // 未配置で追加した画像は非表示で保存されているので、配置したら表示にする
      drawEnabled: true,
      width: targetWidth,
      height: targetHeight,
    };

    if (sizeChanged) {
      // サイズが変わったときだけ実画像を最近傍でリサイズして保存する
      // （パレット量子化済みの色は維持される）
      updated.dataUrl = this.resizeDataUrl(image, targetWidth, targetHeight);
    }

    const { GalleryStorage } =
      await import("../../../../states/galleryStorage");
    const storage = new GalleryStorage();
    await storage.save(updated);

    // 一時非表示を解除し、新しい位置で描画し直す
    await setGalleryImageTemporarilyHidden(item.key, false);

    this.currentItem = updated;
    Toast.success(t`${"coordinates_updated"}`);

    // 設置が完了したのでモーダルを閉じる
    this.ui?.closeModal();
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
      const downloadBtn = document.getElementById("download-btn");
      if (downloadBtn) showFeatureHint("image-detail-download", downloadBtn);
    }

    // if (this.ui) {
    //   const modalElements = this.ui.getModalElements();
    //   if (modalElements) {
    //     showFeatureHint("image-detail-edit-title", modalElements.titleElement);
    //   }
    // }
  }

  render(
    container: HTMLElement,
    router: GalleryRouter,
    item: GalleryItem,
    onDelete: (key: string) => void,
    onEdit?: () => void,
    ui?: GalleryUI,
    onDraftEdit?: (item: GalleryItem) => void,
    onItemUpdated?: (item: GalleryItem) => void,
  ): void {
    this.currentItem = item;
    this.ui = ui || null;
    this.onItemUpdated = onItemUpdated;

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
      <div style="height: 100%; display: flex; flex-direction: column; gap: 6px;">
        <!-- ボタンエリア（コンパクト） -->
        <div style="padding: 4px 6px 0; display: flex; align-items: center; justify-content: space-between; gap: 4px;">
          <div style="display: flex; align-items: center; gap: 2px; flex-wrap: wrap; min-width: 0;">
            <button id="draw-toggle-btn" class="btn btn-xs btn-ghost" style="${item.drawPosition ? "" : "display:none"}" title="${
              item.drawEnabled ? t`${"draw_enabled"}` : t`${"draw_disabled"}`
            }">
              ${this.getDrawToggleIcon(!!item.drawEnabled)}
            </button>

            <!-- 座標編集エリア（コピー・入力・更新を1つにまとめる） -->
            ${
              item.drawPosition
                ? `
              <button id="goto-map-btn" class="btn btn-xs btn-ghost" style="height: 24px; min-height: 24px; padding: 0 6px; flex-shrink: 0;" title="${t`${"goto_map"}`}">
                📍
              </button>`
                : ""
            }
            <div style="display: flex; align-items: center; height: 24px; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; flex-shrink: 0;">
              <button id="copy-coords-btn" class="btn btn-xs btn-ghost" style="height: 22px; min-height: 22px; padding: 0 6px; border-radius: 0; flex-shrink: 0;" title="Copy">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <input id="coord-tlx" type="number" placeholder="TLX" value="${
                item.drawPosition?.TLX ?? 0
              }" style="width: 2.6rem; height: 22px; padding: 0 2px; border: 0; border-left: 1px solid #d1d5db; background: transparent; text-align: center; font-size: .7rem;">
              <input id="coord-tly" type="number" placeholder="TLY" value="${
                item.drawPosition?.TLY ?? 0
              }" style="width: 2.6rem; height: 22px; padding: 0 2px; border: 0; border-left: 1px solid #d1d5db; background: transparent; text-align: center; font-size: .7rem;">
              <input id="coord-pxx" type="number" placeholder="PxX" value="${
                item.drawPosition?.PxX ?? 0
              }" min="0" max="999" style="width: 2.6rem; height: 22px; padding: 0 2px; border: 0; border-left: 1px solid #d1d5db; background: transparent; text-align: center; font-size: .7rem;">
              <input id="coord-pxy" type="number" placeholder="PxY" value="${
                item.drawPosition?.PxY ?? 0
              }" min="0" max="999" style="width: 2.6rem; height: 22px; padding: 0 2px; border: 0; border-left: 1px solid #d1d5db; background: transparent; text-align: center; font-size: .7rem;">
              <button id="update-coords-btn" class="btn btn-xs btn-ghost" style="height: 22px; min-height: 22px; padding: 0 6px; border-radius: 0; border-left: 1px solid #d1d5db; flex-shrink: 0;" title="${t`${"update"}`}">
                🔄
              </button>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <button id="delete-btn" class="btn btn-xs btn-error" title="${t`${"delete"}`}">
              🗑
            </button>
          </div>
        </div>

        <div id="image-detail-container" style="flex: none; position: relative; height: min(60vh, 90vw); overflow-y: auto; overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
          <canvas id="image-detail-canvas" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"></canvas>
        </div>

        <!-- マップに描画（インスタンスあり: 調節ツール / なし: 直接描画） -->
        <div style="display: flex; justify-content: center;">
          <div id="image-draw-on-map-container"></div>
        </div>

        <div style="padding: 0 6px 6px;">
          <div style="display: grid; grid-template-columns: ${item.drawPosition ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))"}; gap: 6px;">
            <button id="edit-btn" class="btn btn-sm" style="height: auto; min-height: 2rem; padding-block: 4px; line-height: 1.2; white-space: normal; overflow-wrap: anywhere;">
              ✏️ ${t`${"edit"}`}
            </button>
            ${
              item.drawPosition
                ? `
            <button id="draft-edit-btn" class="btn btn-sm" title="${
              getMapInstanceReady()
                ? t`${"draft_edit"}`
                : `${t`${"draft_edit"}`} (${t`${"map_not_ready"}`})`
            }" ${getMapInstanceReady() ? "" : "disabled"} style="height: auto; min-height: 2rem; padding-block: 4px; line-height: 1.2; white-space: normal; overflow-wrap: anywhere;">
              📌 ${t`${"draft_edit"}`}
            </button>`
                : ""
            }
            <button id="download-btn" class="btn btn-sm btn-accent" style="width: 100%; height: auto; min-height: 2rem; padding-block: 4px; line-height: 1.2; white-space: normal; overflow-wrap: anywhere;">
              📥 ${t`${"download"}`}
            </button>
          </div>
        </div>

        <!-- 塗り進捗ゲージ（配置済み画像のみ / 最下部に固定） -->
        <div id="image-detail-progress" style="position: sticky; bottom: 0; z-index: 5; margin-top: auto; padding: 0.35rem 6px calc(0.35rem + env(safe-area-inset-bottom, 0px)); background: var(--color-base-100, #fff);"></div>
      </div>
    `;

    // 画像をcanvasに描画してImageInspectorを初期化
    this.loadImageToCanvas(item);

    // 塗り進捗ゲージを描画
    void this.renderProgressGauge(item);

    // ボタンイベント設定
    this.setupButtonEvents(router, onDelete, onEdit, onDraftEdit);
  }

  /**
   * この画像の塗り進捗ゲージを描画する（配置済み画像のみ）。
   * 0 から伸びる演出つきで、100% 到達時はパーティクルが弾ける。
   * 統計が無いときは何も表示しない。
   */
  private async renderProgressGauge(item: GalleryItem): Promise<void> {
    const host = document.getElementById("image-detail-progress");
    if (!host) return;
    host.innerHTML = "";
    if (!item.drawPosition) return;

    const statsPerImage = await getStatsPerImage([item.key]);
    if (!host.isConnected) return; // 再描画で消えていたら破棄

    const stats = statsPerImage[item.key];
    if (!stats) return;

    const matched = Object.values(stats.matched).reduce(
      (sum, count) => sum + count,
      0,
    );
    const total = Object.values(stats.total).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (total <= 0) return;

    const remaining = total - matched;
    const rawPercentage = (matched / total) * 100;
    const percentage = remaining > 0 ? Math.min(rawPercentage, 99.9) : 100;

    const gauge = createRichGauge({
      percentage,
      animate: true,
      popOnComplete: true,
    });

    host.appendChild(gauge.element);
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
    onDraftEdit?: (item: GalleryItem) => void,
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

    // マップに描画ボタン（インスタンスあり: 調節ツール / なし: 直接描画）
    this.initDrawOnMapButton();
    if (GalleryImageDetail.openAdjustOnNextRender) {
      GalleryImageDetail.openAdjustOnNextRender = false;
      void this.handleDrawOnMap();
    }

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
    deleteBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      const { key } = this.currentItem;
      if (await confirmDelete(t`${"delete_confirm"}`, key)) {
        onDelete(key);
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

    // 下書き編集ボタン (ピクセル単位でマップ上から直接編集)
    const draftEditBtn = document.getElementById("draft-edit-btn");
    draftEditBtn?.addEventListener("click", () => {
      if (!this.currentItem) return;

      onDraftEdit?.(this.currentItem);
    });

    // シェアボタン
    const shareBtn = document.getElementById("share-btn");
    shareBtn?.addEventListener("click", () => {
      if (!this.currentItem) return;

      router.navigate("image-share");
    });

    // ダウンロードボタン
    const downloadBtn = document.getElementById("download-btn");
    downloadBtn?.addEventListener("click", async () => {
      if (!this.currentItem) return;

      try {
        const format = await showDownloadFormatDialog(
          !!this.currentItem.drawPosition,
        );
        if (!format) return;

        if (format === "wplace") {
          await downloadWplaceFile(this.currentItem);
        } else {
          downloadImage(this.currentItem, "image-detail-canvas");
        }

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

    // Feature hints
    this.showImageDetailHints();
  }

  destroy(): void {
    console.log("🧑‍🎨 : Destroying GalleryImageDetail...");

    if (this.adjustTool) {
      this.adjustTool.destroy();
      this.adjustTool = null;
      if (this.currentItem)
        void setGalleryImageTemporarilyHidden(this.currentItem.key, false);
    }

    if (this.imageInspector) {
      this.imageInspector.destroy();
      this.imageInspector = null;
    }

    this.currentItem = null;
    this.onItemUpdated = undefined;

    console.log("🧑‍🎨 : GalleryImageDetail destroyed");
  }
}
