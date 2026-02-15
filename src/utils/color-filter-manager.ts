import { colorpalette } from "@/constants/colors";
import type { EnhancedMode } from "@/types/image";
import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "color-filter-selection";
const ENHANCED_MODE_STORAGE_KEY = "enhanced-mode";
const ENHANCED_COLOR_STORAGE_KEY = "enhanced-marker-color";
const SHOW_UNPLACED_COLOR_STORAGE_KEY = "show-unplaced-color";
const SHOW_UNPLACED_COLOR_SAVE_DEBOUNCE_MS = 120;

export class ColorFilterManager {
  private selectedColorIds: Set<number>;
  public selectedRGBs: Array<[number, number, number]> = [];
  private enhancedMode: EnhancedMode = "cross";
  private enhancedColor: [number, number, number] = [255, 0, 0];
  private showUnplacedColor: [number, number, number] = [160, 160, 160];
  private extraColorsBitmap: number | undefined = undefined;
  private showUnplacedColorSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.selectedColorIds = this.getDefaultColorIds();
    this.updateSelectedRGBs();
  }

  async init(): Promise<void> {
    await this.loadFromStorage();
    await this.loadEnhancedModeFromStorage();
    await this.loadEnhancedColorFromStorage();
    await this.loadShowUnplacedColorFromStorage();
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

    // console.log("🧑‍🎨 : ColorFilter selectedRGBs:", this.selectedRGBs);
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

      // Enhancedマーカー色を保護
      const [er, eg, eb] = this.enhancedColor;
      const isEnhancedMarker = r === er && g === eg && b === eb;

      if (!isEnhancedMarker && !this.isColorMatch(r, g, b)) {
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
      const result = await storage.get(STORAGE_KEY);
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
    await storage.set({
      [STORAGE_KEY]: Array.from(this.selectedColorIds),
    });
  }

  getSelectedColors(): number[] {
    return Array.from(this.selectedColorIds);
  }

  setEnhancedMode(mode: EnhancedMode): void {
    this.enhancedMode = mode;
    this.saveEnhancedModeToStorage();
  }

  getEnhancedMode(): EnhancedMode {
    return this.enhancedMode;
  }

  setEnhancedColor(color: [number, number, number]): void {
    this.enhancedColor = color;
    this.saveEnhancedColorToStorage();
  }

  getEnhancedColor(): [number, number, number] {
    return this.enhancedColor;
  }

  setShowUnplacedColor(color: [number, number, number]): void {
    this.showUnplacedColor = color;
    if (this.showUnplacedColorSaveTimer) clearTimeout(this.showUnplacedColorSaveTimer);
    this.showUnplacedColorSaveTimer = setTimeout(() => {
      this.showUnplacedColorSaveTimer = null;
      void this.saveShowUnplacedColorToStorage();
    }, SHOW_UNPLACED_COLOR_SAVE_DEBOUNCE_MS);
  }

  getShowUnplacedColor(): [number, number, number] {
    return this.showUnplacedColor;
  }

  setExtraColorsBitmap(bitmap: number | undefined): void {
    this.extraColorsBitmap = bitmap;
  }

  getOwnedColorIds(): number[] | null {
    if (this.extraColorsBitmap === undefined) return null;

    const ownedIds: number[] = [];

    // ID 1-31: 無料色（常に含む）
    for (let id = 1; id <= 31; id++) {
      ownedIds.push(id);
    }

    // extraColorsBitmap=-1: 全色所持
    if (this.extraColorsBitmap === -1) {
      for (let id = 32; id <= 63; id++) {
        ownedIds.push(id);
      }
      return ownedIds;
    }

    // ID 32-63: ビットマップ判定
    // bit 0 = ID 32, bit 31 = ID 63
    for (let id = 32; id <= 63; id++) {
      const bitIndex = id - 32;
      if (this.extraColorsBitmap & (1 << bitIndex)) {
        ownedIds.push(id);
      }
    }

    return ownedIds;
  }

  private async loadEnhancedModeFromStorage(): Promise<void> {
    try {
      const result = await storage.get(ENHANCED_MODE_STORAGE_KEY);
      const savedMode = result[ENHANCED_MODE_STORAGE_KEY];
      // Validate mode
      const validModes: EnhancedMode[] = [
        "dot",
        "cross",
        "red-cross",
        "border-only",
        "dark-cross",
        "complement-cross",
        "fill",
        "red-border",
      ];
      this.enhancedMode = validModes.includes(savedMode) ? savedMode : "cross";
    } catch {
      this.enhancedMode = "cross";
    }
  }

  private async saveEnhancedModeToStorage(): Promise<void> {
    await storage.set({
      [ENHANCED_MODE_STORAGE_KEY]: this.enhancedMode,
    });
  }

  private async loadEnhancedColorFromStorage(): Promise<void> {
    try {
      const result = await storage.get(ENHANCED_COLOR_STORAGE_KEY);
      const saved = result[ENHANCED_COLOR_STORAGE_KEY];
      if (Array.isArray(saved) && saved.length === 3)
        this.enhancedColor = saved as [number, number, number];
    } catch {
      // keep default
    }
  }

  private async saveEnhancedColorToStorage(): Promise<void> {
    await storage.set({
      [ENHANCED_COLOR_STORAGE_KEY]: this.enhancedColor,
    });
  }

  private async loadShowUnplacedColorFromStorage(): Promise<void> {
    try {
      const result = await storage.get(SHOW_UNPLACED_COLOR_STORAGE_KEY);
      const saved = result[SHOW_UNPLACED_COLOR_STORAGE_KEY];
      if (Array.isArray(saved) && saved.length === 3)
        this.showUnplacedColor = saved as [number, number, number];
    } catch {
      // keep default
    }
  }

  private async saveShowUnplacedColorToStorage(): Promise<void> {
    await storage.set({
      [SHOW_UNPLACED_COLOR_STORAGE_KEY]: this.showUnplacedColor,
    });
  }
}
