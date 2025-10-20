import { TimeTravelRouter } from "../router";
import { t } from "../../../i18n/manager";
import { Toast } from "../../../components/toast";
import { storage } from "@/utils/browser-api";

export class SnapshotShareRoute {
  render(container: HTMLElement, router: TimeTravelRouter): void {
    const selectedSnapshot = (router as any).selectedSnapshot;

    if (!selectedSnapshot) {
      container.innerHTML = `<div>${t`${"no_position_data"}`}</div>`;
      return;
    }

    const { fullKey } = selectedSnapshot;
    
    // fullKey: wplace_snapshot_${timestamp}_${tileX}_${tileY}
    const parts = fullKey.split("_");
    const timestamp = parseInt(parts[2]);
    const tileX = parseInt(parts[3]);
    const tileY = parseInt(parts[4]);

    // timestamp → Date変換
    const date = new Date(timestamp);
    const dateStr = date.toLocaleString();

    container.innerHTML = `
      <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"tile_coordinate"}`}</div>
          <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
            TileX: ${tileX}, TileY: ${tileY}
          </div>
        </div>

        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"snapshot_timestamp"}`}</div>
          <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
            ${timestamp}
          </div>
          <div style="margin-top: 4px; color: #666; font-size: 14px;">
            ${dateStr}
          </div>
        </div>

        <div style="background: #e8f4f8; padding: 12px; border-radius: 4px; border-left: 4px solid #0ea5e9;">
          ${t`${"snapshot_share_description"}`}
        </div>

        <!-- Canvas（非表示、ダウンロード用） -->
        <canvas id="snapshot-share-canvas" style="display: none;"></canvas>

        <button id="download-snapshot-share-btn" class="btn btn-primary">
          📥 ${t`${"download"}`}
        </button>
      </div>
    `;

    // canvasに画像読み込み
    this.loadSnapshotToCanvas(fullKey);

    const downloadBtn = document.getElementById("download-snapshot-share-btn");
    downloadBtn?.addEventListener("click", () => {
      this.downloadSnapshot(fullKey, tileX, tileY, timestamp);
      Toast.success(t`${"download_success"}`);
    });
  }

  private async loadSnapshotToCanvas(fullKey: string): Promise<void> {
    const result = await storage.get(fullKey);
    if (!result[fullKey]) return;

    const uint8Array = new Uint8Array(result[fullKey]);
    const blob = new Blob([uint8Array], { type: "image/png" });

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const canvas = document.getElementById("snapshot-share-canvas") as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }

  private downloadSnapshot(fullKey: string, tileX: number, tileY: number, timestamp: number): void {
    const canvas = document.getElementById("snapshot-share-canvas") as HTMLCanvasElement;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tileX}-${tileY}-${timestamp}.snapshot.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  }
}
