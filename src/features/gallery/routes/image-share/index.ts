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
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"tile_coordinate"}`}</div>
          <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
            TLX: ${TLX}, TLY: ${TLY}
          </div>
        </div>

        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"pixel_coordinate"}`}</div>
          <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
            PxX: ${PxX}, PxY: ${PxY}
          </div>
        </div>

        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">${t`${"lat_lng"}`}</div>
          <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; user-select: all;">
            ${lat.toFixed(6)}, ${lng.toFixed(6)}
          </div>
        </div>

        <div style="background: #e8f4f8; padding: 12px; border-radius: 4px; border-left: 4px solid #0ea5e9;">
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
}
