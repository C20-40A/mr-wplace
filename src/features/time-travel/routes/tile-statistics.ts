import { TimeTravelRouter } from "../router";
import { t } from "@/i18n/manager";
import { storage } from "@/utils/browser-api";
import { colorpalette } from "@/constants/colors";

interface ColorStatItem {
  name: string;
  rgb: [number, number, number];
  count: number;
  percentage: number;
}

export class TileStatisticsRoute {
  private router?: TimeTravelRouter;

  render(container: HTMLElement, router: TimeTravelRouter): void {
    this.router = router;
    const selectedSnapshot = (router as any).selectedSnapshot;

    if (!selectedSnapshot) {
      container.innerHTML = `<div class="text-sm text-red-500 text-center p-4">No snapshot selected</div>`;
      return;
    }

    container.innerHTML = `
      <div style="padding: 1rem;">
        <div id="wps-statistics-loading" style="text-align: center; padding: 2rem;">
          <div style="font-size: 2rem;">⏳</div>
          <div style="margin-top: 0.5rem;">${t`${"calculating"}...`}</div>
        </div>
        <div id="wps-statistics-result" class="hidden"></div>
      </div>
    `;

    this.calculateAndDisplay(container, selectedSnapshot.fullKey);
  }

  private async calculateAndDisplay(
    container: HTMLElement,
    fullKey: string
  ): Promise<void> {
    const statistics = await this.calculateStatistics(fullKey);

    const loadingEl = container.querySelector("#wps-statistics-loading");
    const resultEl = container.querySelector("#wps-statistics-result");
    if (!loadingEl || !resultEl) return;

    loadingEl.classList.add("hidden");
    resultEl.classList.remove("hidden");

    // 結果HTML生成
    const totalPixels = statistics.reduce((sum, item) => sum + item.count, 0);
    
    let html = `
      <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(0,0,0,0.1); border-radius: 0.5rem;">
        <div style="font-weight: bold; margin-bottom: 0.5rem;">${t`${"total_pixels"}`}</div>
        <div style="font-size: 1.5rem;">${totalPixels.toLocaleString()}</div>
      </div>
      <div style="font-weight: bold; margin-bottom: 0.5rem;">${t`${"color_distribution"}`}</div>
      <div style="max-height: 60vh; overflow-y: auto;">
    `;

    for (const item of statistics) {
      const colorStyle = `background: rgb(${item.rgb[0]}, ${item.rgb[1]}, ${item.rgb[2]})`;
      const barWidth = Math.max(item.percentage, 0.5); // 最低0.5%表示
      
      html += `
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
            <div style="width: 30px; height: 30px; border-radius: 0.25rem; ${colorStyle}; margin-right: 0.75rem; border: 1px solid rgba(0,0,0,0.2); flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: bold; font-size: 0.875rem;">${item.name}</div>
              <div style="font-size: 0.75rem; opacity: 0.7;">RGB(${item.rgb[0]}, ${item.rgb[1]}, ${item.rgb[2]})</div>
            </div>
            <div style="text-align: right; margin-left: 0.5rem; flex-shrink: 0;">
              <div style="font-weight: bold; font-size: 0.875rem;">${item.count.toLocaleString()}</div>
              <div style="font-size: 0.75rem; opacity: 0.7;">${item.percentage.toFixed(2)}%</div>
            </div>
          </div>
          <div style="width: 100%; height: 20px; background: rgba(0,0,0,0.1); border-radius: 0.25rem; overflow: hidden; position: relative;">
            <div style="${colorStyle}; height: 100%; width: ${barWidth}%; transition: width 0.3s ease; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);"></div>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    resultEl.innerHTML = html;
  }

  private async calculateStatistics(fullKey: string): Promise<ColorStatItem[]> {
    // スナップショット画像取得
    const result = await storage.get(fullKey);
    if (!result[fullKey]) throw new Error("Snapshot not found");

    const uint8Array = new Uint8Array(result[fullKey]);
    const blob = new Blob([uint8Array], { type: "image/png" });
    const imageBitmap = await createImageBitmap(blob);

    // ImageData取得
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
    const data = imageData.data;

    // カウントマップ初期化
    const colorCountMap = new Map<string, number>();

    // 全ピクセル走査
    const totalPixels = imageBitmap.width * imageBitmap.height;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // 透明ピクセルスキップ
      if (a === 0) continue;

      const colorKey = this.rgbToKey(r, g, b);
      colorCountMap.set(colorKey, (colorCountMap.get(colorKey) || 0) + 1);
    }

    // 統計結果生成
    const statistics: ColorStatItem[] = [];
    const nonTransparentPixels = Array.from(colorCountMap.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    for (const [colorKey, count] of colorCountMap.entries()) {
      const [r, g, b] = colorKey.split(",").map(Number);
      const name = this.findColorName(r, g, b);
      const percentage = (count / nonTransparentPixels) * 100;

      statistics.push({
        name,
        rgb: [r, g, b],
        count,
        percentage,
      });
    }

    // ピクセル数降順ソート
    statistics.sort((a, b) => b.count - a.count);

    return statistics;
  }

  private rgbToKey(r: number, g: number, b: number): string {
    return `${r},${g},${b}`;
  }

  private findColorName(r: number, g: number, b: number): string {
    const color = colorpalette.find(
      (c) => c.rgb[0] === r && c.rgb[1] === g && c.rgb[2] === b
    );
    return color ? color.name : "Unknown";
  }
}
