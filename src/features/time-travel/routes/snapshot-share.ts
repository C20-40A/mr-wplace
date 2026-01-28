import { TimeTravelRouter } from "../router";
import { t } from "@/i18n/manager";
import { Toast } from "@/components/toast";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { getSnapshotDataUrl } from "@/utils/inject-bridge";

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

    // タイル座標の中心点（500, 500）を経度緯度に変換
    const { lat, lng } = tilePixelToLatLng(tileX, tileY, 500, 500);

    container.innerHTML = `
      <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"tile_coordinate"}`}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div id="tile-coord-text" style="flex: 1; border: 1px solid #ccc; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
              TileX: ${tileX}, TileY: ${tileY}
            </div>
            <button id="copy-tile-coord-btn" class="btn btn-sm btn-ghost" style="height: 32px; min-height: 32px; padding: 0 8px;" title="Copy">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>

        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"lat_lng"}`}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div id="lat-lng-text" style="flex: 1; border: 1px solid #ccc; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
              ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>
            <button id="copy-lat-lng-btn" class="btn btn-sm btn-ghost" style="height: 32px; min-height: 32px; padding: 0 8px;" title="Copy">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>

        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"snapshot_timestamp"}`}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div id="timestamp-text" style="flex: 1; border: 1px solid #ccc; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
              ${timestamp}
            </div>
            <button id="copy-timestamp-btn" class="btn btn-sm btn-ghost" style="height: 32px; min-height: 32px; padding: 0 8px;" title="Copy">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
          <div style="margin-top: 4px; opacity: 0.6; font-size: 14px;">
            ${dateStr}
          </div>
        </div>

        <div style="padding: 12px; border-radius: 4px; border-left: 4px solid #0ea5e9;">
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

    // タイル座標コピーボタン
    const copyTileCoordBtn = document.getElementById("copy-tile-coord-btn");
    copyTileCoordBtn?.addEventListener("click", async () => {
      const coordText = `${tileX}-${tileY}`;
      try {
        await navigator.clipboard.writeText(coordText);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy tile coordinates", err);
        Toast.error("Failed to copy");
      }
    });

    // 経度緯度コピーボタン
    const copyLatLngBtn = document.getElementById("copy-lat-lng-btn");
    copyLatLngBtn?.addEventListener("click", async () => {
      const coordText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      try {
        await navigator.clipboard.writeText(coordText);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy lat/lng", err);
        Toast.error("Failed to copy");
      }
    });

    // タイムスタンプコピーボタン
    const copyTimestampBtn = document.getElementById("copy-timestamp-btn");
    copyTimestampBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(timestamp.toString());
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy timestamp", err);
        Toast.error("Failed to copy");
      }
    });

    const downloadBtn = document.getElementById("download-snapshot-share-btn");
    downloadBtn?.addEventListener("click", () => {
      this.downloadSnapshot(fullKey, tileX, tileY, timestamp);
      Toast.success(t`${"download_success"}`);
    });
  }

  private async loadSnapshotToCanvas(fullKey: string): Promise<void> {
    // fullKey: tile_snapshot_${timestamp}_${tileX}_${tileY}
    const snapshotId = fullKey.replace("tile_snapshot_", "");
    const dataUrl = await getSnapshotDataUrl(snapshotId);

    if (!dataUrl) return;

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
