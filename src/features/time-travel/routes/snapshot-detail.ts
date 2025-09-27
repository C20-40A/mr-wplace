import { TimeTravelRouter } from "../router";
import { TimeTravelStorage } from "../storage";
import { t } from "../../../i18n/manager";
import { ImageInspector } from "../../../components/image-inspector";
import { Toast } from "../../../components/toast";

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
        
        <div style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <button id="wps-draw-snapshot-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4z" />
            </svg>
            ${"draw_image"}
          </button>
          <button id="wps-return-current-btn" class="btn btn-outline hidden">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z" clip-rule="evenodd" />
            </svg>
            ${"return_to_current"}
          </button>
          <button id="wps-download-snapshot-btn" class="btn btn-neutral">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06L11.25 14.69V3a.75.75 0 01.75-.75z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M6.75 15.75a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
            </svg>
            ${"download"}
          </button>
          <button id="wps-delete-snapshot-btn" class="btn btn-sm btn-error">
            🗑 ${"delete"}
          </button>
        </div>
      </div>
    `;

    this.setupEvents(container);
    this.loadSnapshot(selectedSnapshot.fullKey);
    this.updateReturnCurrentButton(selectedSnapshot.fullKey); // async呼び出しは非同期
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
      .querySelector("#wps-download-snapshot-btn")
      ?.addEventListener("click", () => {
        this.downloadSnapshot();
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
    const result = await chrome.storage.local.get(fullKey);
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
    const result = await chrome.storage.local.get(fullKey);
    if (!result[fullKey]) throw new Error("Snapshot not found");

    const tileX = parseInt(fullKey.split("_")[3]);
    const tileY = parseInt(fullKey.split("_")[4]);

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

    const timeTravelUI = window.mrWplace?.timeTravel?.ui;
    if (timeTravelUI) timeTravelUI.closeModal();

    await this.updateReturnCurrentButton(fullKey);
    Toast.success(
      isDrawing ? "Snapshot drawn successfully" : "Snapshot removed"
    );
  }

  private downloadSnapshot(): void {
    const canvas = document.getElementById(
      "wps-snapshot-canvas"
    ) as HTMLCanvasElement;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const selectedSnapshot = (this.router as any)?.selectedSnapshot;
      const timestamp = parseInt(selectedSnapshot.fullKey.split("_")[2]);
      const tileX = parseInt(selectedSnapshot.fullKey.split("_")[3]);
      const tileY = parseInt(selectedSnapshot.fullKey.split("_")[4]);
      a.download = `${tileX}-${tileY}-${timestamp}.snapshot.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  private async updateReturnCurrentButton(fullKey: string): Promise<void> {
    const isDrawing = await TimeTravelStorage.isSnapshotDrawing(fullKey);

    const returnBtn = document.querySelector("#wps-return-current-btn");
    if (!returnBtn) throw new Error("Return button not found");
    if (isDrawing) {
      returnBtn.classList.remove("hidden");
    } else {
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

    // ボタン非表示
    await this.updateReturnCurrentButton(fullKey);
  }

  private async deleteSnapshot(fullKey: string): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;

    // TemplateManager からも削除（描画中の場合）
    const tileOverlay = window.mrWplace?.tileOverlay;
    const imageKey = `snapshot_${fullKey}`;
    if (tileOverlay?.templateManager) {
      tileOverlay.templateManager.removeTemplateByKey(imageKey);
    }

    await TimeTravelStorage.removeSnapshotFromIndex(fullKey);
    Toast.success(t`${"deleted_message"}`);
    
    // 削除後は前画面に戻る
    this.router?.navigateBack();
  }
}
