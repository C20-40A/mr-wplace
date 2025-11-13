import { GalleryItem } from "../../storage";
import { tilePixelToLatLng } from "../../../../utils/coordinate";
import { downloadImage } from "../../common-actions";
import { t } from "../../../../i18n/manager";
import { Toast } from "../../../../components/toast";

export class GalleryImageShare {
  render(container: HTMLElement, item: GalleryItem): void {
    if (!item.drawPosition) {
      container.innerHTML = `<div>${t`${"no_position_data"}`}</div>`;
      return;
    }

    const { TLX, TLY, PxX, PxY } = item.drawPosition;
    const { lat, lng } = tilePixelToLatLng(TLX, TLY, PxX, PxY);

    container.innerHTML = `
      <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"tile_coordinate"}`} / ${t`${"pixel_coordinate"}`}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div id="tile-pixel-text" style="flex: 1; border: 1px solid #ccc; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
              TLX: ${TLX}, TLY: ${TLY} / PxX: ${PxX}, PxY: ${PxY}
            </div>
            <button id="copy-tile-pixel-btn" class="btn btn-sm btn-ghost" style="height: 32px; min-height: 32px; padding: 0 8px;" title="Copy">
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

        <div style="padding: 12px; border-radius: 4px; border-left: 4px solid #0ea5e9;">
          ${t`${"share_description"}`}
        </div>

        <!-- Canvas（非表示、ダウンロード用） -->
        <canvas id="image-share-canvas" style="display: none;"></canvas>

        <button id="download-share-btn" class="btn btn-primary">
          📥 ${t`${"download"}`}
        </button>
      </div>
    `;

    // canvasに画像描画
    this.loadImageToCanvas(item.dataUrl);

    // タイル座標/ピクセル座標コピーボタン
    const copyTilePixelBtn = document.getElementById("copy-tile-pixel-btn");
    copyTilePixelBtn?.addEventListener("click", async () => {
      const coordText = `${TLX}-${TLY}-${PxX}-${PxY}`;
      try {
        await navigator.clipboard.writeText(coordText);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy coordinates", err);
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

    const downloadBtn = document.getElementById("download-share-btn");
    downloadBtn?.addEventListener("click", () => {
      downloadImage(item, "image-share-canvas");
      Toast.success(t`${"download_success"}`);
    });
  }

  private loadImageToCanvas(dataUrl: string): void {
    const canvas = document.getElementById(
      "image-share-canvas"
    ) as HTMLCanvasElement;
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

  destroy(): void {
    // GalleryImageShare は静的HTMLのみなので特に破棄処理なし
    console.log("🧑‍🎨 : GalleryImageShare destroyed (no-op)");
  }
}
