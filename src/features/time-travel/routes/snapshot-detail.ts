import { TimeTravelRouter } from "../router";
import { t } from "../../../i18n/manager";
import { ImageInspector } from "../../../components/image-inspector";

export class SnapshotDetailRoute {
  private imageInspector?: ImageInspector;

  render(container: HTMLElement, router: TimeTravelRouter): void {
    const selectedSnapshot = (router as any).selectedSnapshot;

    if (!selectedSnapshot) {
      container.innerHTML = `<div class="text-sm text-red-500 text-center p-4">No snapshot selected</div>`;
      return;
    }

    container.style.height = "80vh";

    container.innerHTML = t`
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div style="flex: 1; position: relative; min-height: 0; overflow: hidden;">
          <canvas id="wps-snapshot-canvas" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"></canvas>
        </div>
        
        <div style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <button id="wps-download-snapshot-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06L11.25 14.69V3a.75.75 0 01.75-.75z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M6.75 15.75a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
            </svg>
            ${"download"}
          </button>
        </div>
      </div>
    `;

    this.setupEvents(container);
    this.loadSnapshot(selectedSnapshot.fullKey);
  }

  private setupEvents(container: HTMLElement): void {
    container
      .querySelector("#wps-download-snapshot-btn")
      ?.addEventListener("click", () => {
        this.downloadSnapshot();
      });
  }

  private async loadSnapshot(fullKey: string): Promise<void> {
    try {
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
          maxZoom: 5.0,
        });
      };
      img.src = dataUrl;
    } catch (error) {
      console.error("Failed to load snapshot:", error);
    }
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
      a.download = `snapshot-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  }
}
