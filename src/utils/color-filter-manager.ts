import { colorpalette } from "../constants/colors";
import type { EnhancedConfig } from "../features/tile-draw/tile-draw";

const STORAGE_KEY = "color-filter-selection";
const ENHANCED_MODE_STORAGE_KEY = "enhanced-mode";

export class ColorFilterManager {
  private selectedColorIds: Set<number>;
  public selectedRGBs: Array<[number, number, number]> = [];
  private enhancedMode: EnhancedConfig["mode"] = "dot";

  constructor() {
    this.selectedColorIds = this.getDefaultColorIds();
    this.updateSelectedRGBs();
  }

  async init(): Promise<void> {
    await this.loadFromStorage();
    await this.loadEnhancedModeFromStorage();
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
      .filter((color) => {
        // id: 0 (Transparent)を除外 - 透明色はColorFilter対象外
        if (color.id === 0) return false;
        return this.selectedColorIds.has(color.id);
      })
      .map((color) => color.rgb as [number, number, number]);

    console.log("🧑‍🎨 : ColorFilter selectedRGBs:", this.selectedRGBs);
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
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

  setEnhancedMode(mode: EnhancedConfig["mode"]): void {
    this.enhancedMode = mode;
    this.saveEnhancedModeToStorage();
  }

  getEnhancedMode(): EnhancedConfig["mode"] {
    return this.enhancedMode;
  }

  private async loadEnhancedModeFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(ENHANCED_MODE_STORAGE_KEY);
      const savedMode = result[ENHANCED_MODE_STORAGE_KEY];
      // Validate mode
      const validModes: EnhancedConfig["mode"][] = [
        "dot", "cross", "red-cross", "cyan-cross", 
        "dark-cross", "complement-cross", "fill", "red-border"
      ];
      this.enhancedMode = validModes.includes(savedMode) ? savedMode : "dot";
    } catch {
      this.enhancedMode = "dot";
    }
  }

  private async saveEnhancedModeToStorage(): Promise<void> {
    await chrome.storage.local.set({
      [ENHANCED_MODE_STORAGE_KEY]: this.enhancedMode,
    });
  }
}
