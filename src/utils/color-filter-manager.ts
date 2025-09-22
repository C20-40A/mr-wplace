import { colorpalette } from "../constants/colors";

const STORAGE_KEY = 'color-filter-selection';

/**
 * 色フィルタ管理 - 選択色以外完全非表示
 */
export class ColorFilterManager {
  private selectedColorIds: Set<number> = new Set();
  private selectedRGBs: Array<[number, number, number]> = [];
  private colorThreshold = 0; // RGB完全一致

  constructor() {
    // 初期状態はデフォルト（全色選択）
    this.selectedColorIds = new Set(colorpalette.map(c => c.id));
    this.updateSelectedRGBs();
  }

  async init(): Promise<void> {
    await this.loadFromStorage();
  }

  setSelectedColors(colorIds: number[]): void {
    this.selectedColorIds = new Set(colorIds);
    this.updateSelectedRGBs();
    this.saveToStorage();
  }

  private updateSelectedRGBs(): void {
    this.selectedRGBs = colorpalette
      .filter(color => this.selectedColorIds.has(color.id))
      .map(color => color.rgb as [number, number, number]);
  }

  /**
   * 指定RGBが選択色に近いか判定
   */
  private isColorVisible(r: number, g: number, b: number): boolean {
    if (this.selectedRGBs.length === 0) return false;
    
    return this.selectedRGBs.some(([pr, pg, pb]) => {
      const dr = Math.abs(r - pr);
      const dg = Math.abs(g - pg);
      const db = Math.abs(b - pb);
      return dr <= this.colorThreshold && dg <= this.colorThreshold && db <= this.colorThreshold;
    });
  }

  /**
   * ImageBitmapに色フィルタ適用
   */
  applyColorFilter(imageBitmap: ImageBitmap): ImageBitmap | null {
    if (this.selectedRGBs.length === colorpalette.length) return imageBitmap;

    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageBitmap;

    // 全disable時は透明作成（何も描画しない）
    if (this.selectedRGBs.length === 0) {
      ctx.clearRect(0, 0, imageBitmap.width, imageBitmap.height);
      return canvas.transferToImageBitmap();
    }

    ctx.drawImage(imageBitmap, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
    const data = imageData.data;

    // RGBA操作：非選択色を透明化
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a > 0 && !this.isColorVisible(r, g, b)) {
        data[i + 3] = 0; // 透明化
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.transferToImageBitmap();
  }

  isFilterActive(): boolean {
    return this.selectedRGBs.length < colorpalette.length;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const savedColorIds = result[STORAGE_KEY];
      if (Array.isArray(savedColorIds)) {
        this.selectedColorIds = new Set(savedColorIds);
      } else {
        // デフォルト：全色選択
        this.selectedColorIds = new Set(colorpalette.map(c => c.id));
      }
      this.updateSelectedRGBs();
    } catch {
      // エラー時はデフォルト
      this.selectedColorIds = new Set(colorpalette.map(c => c.id));
      this.updateSelectedRGBs();
    }
  }

  private async saveToStorage(): Promise<void> {
    const colorIds = Array.from(this.selectedColorIds);
    await chrome.storage.local.set({ [STORAGE_KEY]: colorIds });
  }
  
  getSelectedColors(): number[] {
    return Array.from(this.selectedColorIds);
  }
}
