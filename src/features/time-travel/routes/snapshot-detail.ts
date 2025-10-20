import { TimeTravelRouter } from "../router";
import { TimeTravelStorage } from "../storage";
import { t } from "../../../i18n/manager";
import { ImageInspector } from "../../../components/image-inspector";
import { Toast } from "../../../components/toast";
import { di } from "../../../core/di";
import { gotoPosition } from "../../../utils/position";
import { tilePixelToLatLng } from "../../../utils/coordinate";
import { storage } from "@/utils/browser-api";

export class SnapshotDetailRoute {
  private imageInspector?: ImageInspector;
  private router?: TimeTravelRouter;

  render(container: HTMLElement, router: TimeTravelRouter): void {
    this.router = router;
    const selectedSnapshot = (router as any).selectedSnapshot;

    if (!selectedSnapshot) {
      container.innerHTML = `<div class="text-sm text-red-500 text-center p-4">No snapshot selected</div>`;
      return;
    }

    container.innerHTML = t`
      <div style="height: 75vh; display: flex; flex-direction: column;">
        <div style="flex: 1; position: relative; min-height: 0; overflow: hidden;">
          <canvas id="wps-snapshot-canvas" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"></canvas>
        </div>
        
        <div style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
          <button id="wps-draw-snapshot-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4z" />
            </svg>
            ${"draw_this_tile"}
          </button>
          <button id="wps-return-current-btn" class="btn btn-outline hidden">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z" clip-rule="evenodd" />
            </svg>
            ${"return_to_current"}
          </button>
          <button id="wps-goto-tile-btn" class="btn btn-outline">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
            ${"goto_map"}
          </button>
          <button id="wps-share-snapshot-btn" class="btn btn-neutral">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M15.75 4.5a3 3 0 11.825 2.066l-8.421 4.679a3.002 3.002 0 010 1.51l8.421 4.679a3 3 0 11-.729 1.31l-8.421-4.678a3 3 0 110-4.132l8.421-4.679a3 3 0 01-.096-.755z" clip-rule="evenodd" />
            </svg>
            ${"share"}
          </button>
          <button id="wps-delete-snapshot-btn" class="btn btn-sm btn-error">
            🗑 ${"delete"}
          </button>
        </div>
      </div>
    `;

    this.setupEvents(container);
    this.loadSnapshot(selectedSnapshot.fullKey);
    this.updateButtonStates(selectedSnapshot.fullKey);
  }

  private setupEvents(container: HTMLElement): void {
    const selectedSnapshot = (this.router as any)?.selectedSnapshot;

    container
      .querySelector("#wps-draw-snapshot-btn")
      ?.addEventListener("click", () => {
        if (selectedSnapshot?.fullKey) {
          this.drawSnapshot(selectedSnapshot.fullKey);
        }
      });

    container
      .querySelector("#wps-return-current-btn")
      ?.addEventListener("click", () => {
        if (selectedSnapshot?.fullKey) {
          this.returnToCurrent(selectedSnapshot.fullKey);
        }
      });

    container
      .querySelector("#wps-goto-tile-btn")
      ?.addEventListener("click", () => {
        if (selectedSnapshot?.fullKey) {
          this.gotoTilePosition(selectedSnapshot.fullKey);
        }
      });

    container
      .querySelector("#wps-share-snapshot-btn")
      ?.addEventListener("click", () => {
        this.router?.navigate("snapshot-share");
      });

    container
      .querySelector("#wps-delete-snapshot-btn")
      ?.addEventListener("click", () => {
        if (selectedSnapshot?.fullKey) {
          this.deleteSnapshot(selectedSnapshot.fullKey);
        }
      });
  }

  private async loadSnapshot(fullKey: string): Promise<void> {
    const result = await storage.get(fullKey);
    if (!result[fullKey]) throw new Error("Snapshot not found");

    const uint8Array = new Uint8Array(result[fullKey]);
    const blob = new Blob([uint8Array], { type: "image/png" });

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const canvas = document.getElementById(
      "wps-snapshot-canvas"
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      // ImageInspector初期化（キャンバスエリアサイズに合わせて動的計算）
      const canvasArea = canvas.parentElement!;
      const containerSize =
        Math.min(canvasArea.offsetWidth, canvasArea.offsetHeight) * 0.9;

      this.imageInspector = new ImageInspector(canvas, {
        containerSize: containerSize,
        minZoom: 1.0,
        maxZoom: 10.0,
      });
    };
    img.src = dataUrl;
  }

  private async drawSnapshot(fullKey: string): Promise<void> {
    const result = await storage.get(fullKey);
    if (!result[fullKey]) throw new Error("Snapshot not found");

    const tileX = parseInt(fullKey.split("_")[3]);
    const tileY = parseInt(fullKey.split("_")[4]);

    // 現在の状態確認
    const currentState = await TimeTravelStorage.getActiveSnapshotForTile(
      tileX,
      tileY
    );
    const willDraw = !currentState || currentState.fullKey !== fullKey;

    // 描画する場合のみローダー開始
    if (willDraw) {
      window.postMessage({ source: "wplace-studio-drawing-start" }, "*");
    }

    const uint8Array = new Uint8Array(result[fullKey]);
    const blob = new Blob([uint8Array], { type: "image/png" });
    const file = new File([blob], "snapshot.png", { type: "image/png" });

    // TimeTravelStorage.drawSnapshotOnTile使用
    const isDrawing = await TimeTravelStorage.drawSnapshotOnTile(
      tileX,
      tileY,
      file,
      fullKey
    );

    const timeTravel = di.get("timeTravel");
    timeTravel.closeModal();

    await this.updateButtonStates(fullKey);
    Toast.success(
      isDrawing ? "Snapshot drawn successfully" : "Snapshot removed"
    );
  }

  private async updateButtonStates(fullKey: string): Promise<void> {
    const isDrawing = await TimeTravelStorage.isSnapshotDrawing(fullKey);

    const drawBtn = document.querySelector("#wps-draw-snapshot-btn");
    const returnBtn = document.querySelector("#wps-return-current-btn");
    if (!drawBtn || !returnBtn) throw new Error("Button not found");

    if (isDrawing) {
      drawBtn.classList.add("hidden");
      returnBtn.classList.remove("hidden");
    } else {
      drawBtn.classList.remove("hidden");
      returnBtn.classList.add("hidden");
    }
  }

  private async returnToCurrent(fullKey: string): Promise<void> {
    const tileX = parseInt(fullKey.split("_")[3]);
    const tileY = parseInt(fullKey.split("_")[4]);
    const file = new File([], "placeholder");

    // TimeTravelStorage経由でOFFに切り替え（結果的に削除される）
    await TimeTravelStorage.drawSnapshotOnTile(tileX, tileY, file, fullKey);
    Toast.success("Returned to current state");

    // ボタン状態更新
    await this.updateButtonStates(fullKey);
  }

  private async gotoTilePosition(fullKey: string): Promise<void> {
    const tileX = parseInt(fullKey.split("_")[3]);
    const tileY = parseInt(fullKey.split("_")[4]);
    const { lat, lng } = tilePixelToLatLng(tileX, tileY);
    await gotoPosition({ lat, lng, zoom: 11 });
  }

  private async deleteSnapshot(fullKey: string): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;

    // TileDrawManager からも削除（描画中の場合）
    const tileOverlay = window.mrWplace?.tileOverlay;
    const imageKey = `snapshot_${fullKey}`;
    if (tileOverlay?.tileDrawManager) {
      tileOverlay.tileDrawManager.removePreparedOverlayImageByKey(imageKey);
    }

    await TimeTravelStorage.removeSnapshotFromIndex(fullKey);
    Toast.success(t`${"deleted_message"}`);

    // 削除後は前画面に戻る
    this.router?.navigateBack();
  }
}
