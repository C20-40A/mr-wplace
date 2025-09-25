import { colorpalette } from "../constants/colors";

const STORAGE_KEY = "color-filter-selection";
const ENHANCED_STORAGE_KEY = "enhanced-filter-enabled";

export class ColorFilterManager {
  private selectedColorIds: Set<number>;
  private selectedRGBs: Array<[number, number, number]> = [];
  private enhancedEnabled: boolean = false;

  constructor() {
    this.selectedColorIds = this.getDefaultColorIds();
    this.updateSelectedRGBs();
  }

  async init(): Promise<void> {
    await this.loadFromStorage();
    await this.loadEnhancedFromStorage();
  }

  async setSelectedColors(colorIds: number[]): Promise<void> {
    this.selectedColorIds = new Set(colorIds);
    this.updateSelectedRGBs();
    await this.saveToStorage();
  }

  private getDefaultColorIds(): Set<number> {
    return new Set(colorpalette.map((c) => c.id));
  }

  private updateSelectedRGBs(): void {
    this.selectedRGBs = colorpalette
      .filter((color) => this.selectedColorIds.has(color.id))
      .map((color) => color.rgb as [number, number, number]);
  }

  private isColorMatch(r: number, g: number, b: number): boolean {
    if (this.selectedRGBs.length === 0) return false;
    return this.selectedRGBs.some(
      ([pr, pg, pb]) => r === pr && g === pg && b === pb
    );
  }

  applyColorFilter(imageBitmap: ImageBitmap): ImageBitmap | null {
    if (this.selectedRGBs.length === colorpalette.length) return imageBitmap;

    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return imageBitmap;

    if (this.selectedRGBs.length === 0) {
      ctx.clearRect(0, 0, imageBitmap.width, imageBitmap.height);
      return canvas.transferToImageBitmap();
    }

    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(
      0,
      0,
      imageBitmap.width,
      imageBitmap.height
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      
      // Enhanced赤ドット[255,0,0]を保護
      const isEnhancedRed = r === 255 && g === 0 && b === 0;
      
      if (!isEnhancedRed && !this.isColorMatch(r, g, b)) {
        data[i + 3] = 0;
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
      this.selectedColorIds = Array.isArray(savedColorIds)
        ? new Set(savedColorIds)
        : this.getDefaultColorIds();
    } catch {
      this.selectedColorIds = this.getDefaultColorIds();
    }
    this.updateSelectedRGBs();
  }

  private async saveToStorage(): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEY]: Array.from(this.selectedColorIds),
    });
  }

  getSelectedColors(): number[] {
    return Array.from(this.selectedColorIds);
  }

  setEnhanced(enabled: boolean): void {
    this.enhancedEnabled = enabled;
    this.saveEnhancedToStorage();
  }

  isEnhancedEnabled(): boolean {
    return this.enhancedEnabled;
  }

  private async loadEnhancedFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(ENHANCED_STORAGE_KEY);
      this.enhancedEnabled = result[ENHANCED_STORAGE_KEY] === true;
    } catch {
      this.enhancedEnabled = false;
    }
  }

  private async saveEnhancedToStorage(): Promise<void> {
    await chrome.storage.local.set({
      [ENHANCED_STORAGE_KEY]: this.enhancedEnabled,
    });
  }
}
