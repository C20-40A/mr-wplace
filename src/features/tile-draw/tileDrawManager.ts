import { applyTileComparisonEnhanced, drawImageOnTiles } from "./tile-draw";
import { TILE_DRAW_CONSTANTS, WplaceCoords, TileCoords } from "./constants";
import { CanvasPool } from "./canvas-pool";
import { colorpalette } from "../../constants/colors";

interface TileDrawInstance {
  coords: WplaceCoords;
  tiles: Record<string, ImageBitmap> | null;
  imageKey: string;
  drawEnabled: boolean;
}

export class TileDrawManager {
  public tileSize: number;
  public renderScale: number;
  public templates: TileDrawInstance[];

  constructor() {
    this.tileSize = TILE_DRAW_CONSTANTS.TILE_SIZE;
    this.renderScale = TILE_DRAW_CONSTANTS.RENDER_SCALE;
    this.templates = [];
  }

  async createTemplate(
    blob: File,
    coords: WplaceCoords,
    imageKey: string
  ): Promise<void> {
    this.removeTemplateByKey(imageKey);

    const { templateTiles } = await drawImageOnTiles({
      file: blob,
      coords,
      tileSize: this.tileSize,
      enhanced: undefined,
    });

    this.templates.push({
      coords,
      tiles: templateTiles,
      imageKey,
      drawEnabled: true,
    });
  }

  async drawTemplateOnTile(
    tileBlob: Blob,
    tileCoords: TileCoords
  ): Promise<Blob> {
    if (this.templates.length === 0) return tileBlob;

    const drawSize = this.tileSize * this.renderScale;
    const coordStr =
      tileCoords[0].toString().padStart(4, "0") +
      "," +
      tileCoords[1].toString().padStart(4, "0");

    const matchingTiles: Array<{
      tileKey: string;
      instance: TileDrawInstance;
    }> = [];

    for (const instance of this.templates) {
      if (!instance.drawEnabled || !instance.tiles) continue;

      const tiles = Object.keys(instance.tiles).filter((tile) =>
        tile.startsWith(coordStr)
      );

      for (const tileKey of tiles) {
        matchingTiles.push({ tileKey, instance });
      }
    }

    if (matchingTiles.length === 0) return tileBlob;

    const tileBitmap = await createImageBitmap(tileBlob);
    const canvas = CanvasPool.acquire(drawSize, drawSize);
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      CanvasPool.release(canvas);
      throw new Error("Failed to get 2D context");
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, drawSize, drawSize);
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

    // 元タイル状態保存用canvas
    const originalTileCanvas = CanvasPool.acquire(drawSize, drawSize);
    const originalTileCtx = originalTileCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!originalTileCtx) {
      CanvasPool.release(canvas);
      CanvasPool.release(originalTileCanvas);
      throw new Error("Failed to get original tile context");
    }
    originalTileCtx.imageSmoothingEnabled = false;
    originalTileCtx.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

    const colorFilter = window.mrWplace?.colorFilterManager;
    const enhancedConfig = this.getEnhancedConfig();

    for (const { tileKey, instance } of matchingTiles) {
      const coords = tileKey.split(",");
      let templateBitmap = instance.tiles?.[tileKey];
      if (!templateBitmap) continue;

      if (enhancedConfig?.enabled) {
        templateBitmap = await this.applyTileComparison(
          templateBitmap,
          originalTileCtx,
          coords,
          enhancedConfig.selectedColors
        );
      }

      // ColorFilter適用
      let filteredBitmap = templateBitmap;
      if (colorFilter?.isFilterActive()) {
        const filtered = colorFilter.applyColorFilter(templateBitmap);
        if (filtered) filteredBitmap = filtered;
      }

      context.drawImage(
        filteredBitmap,
        Number(coords[2]) * this.renderScale,
        Number(coords[3]) * this.renderScale
      );
    }

    const result = await canvas.convertToBlob({ type: "image/png" });

    // Canvas cleanup
    CanvasPool.release(canvas);
    CanvasPool.release(originalTileCanvas);

    return result;
  }

  removeTemplateByKey(imageKey: string): void {
    this.templates = this.templates.filter((i) => i.imageKey !== imageKey);
  }

  toggleDrawEnabled(imageKey: string): boolean {
    const instance = this.templates.find((i) => i.imageKey === imageKey);
    if (!instance) return false;

    instance.drawEnabled = !instance.drawEnabled;
    return instance.drawEnabled;
  }

  clearAllTemplates(): void {
    this.templates = [];
  }

  isDrawingOnTile(tileX: number, tileY: number): boolean {
    for (const instance of this.templates) {
      if (!instance.drawEnabled || !instance.coords) continue;

      const [templateTileX, templateTileY] = instance.coords;
      if (templateTileX === tileX && templateTileY === tileY) return true;
    }
    return false;
  }

  private getEnhancedConfig():
    | { enabled: boolean; selectedColors: Set<string> }
    | undefined {
    const colorFilterManager = window.mrWplace?.colorFilterManager;
    if (!colorFilterManager?.isEnhancedEnabled()) return undefined;

    const selectedColorIds = colorFilterManager.getSelectedColors();
    const selectedColors = new Set<string>();

    for (const id of selectedColorIds) {
      // id: 0 (Transparent)を除外 - 透明色はenhance不要、黒[0,0,0]はid: 1のみ
      if (id === 0) continue;

      const color = colorpalette.find((c) => c.id === id);
      if (color) {
        selectedColors.add(`${color.rgb[0]},${color.rgb[1]},${color.rgb[2]}`);
      }
    }

    return { enabled: true, selectedColors };
  }

  private async applyTileComparison(
    templateBitmap: ImageBitmap,
    tileContext: OffscreenCanvasRenderingContext2D,
    coords: string[],
    selectedColors?: Set<string>
  ): Promise<ImageBitmap> {
    const tempCanvas = CanvasPool.acquire(
      templateBitmap.width,
      templateBitmap.height
    );
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
    if (!tempCtx) {
      CanvasPool.release(tempCanvas);
      return templateBitmap;
    }

    tempCtx.drawImage(templateBitmap, 0, 0);

    const templateData = tempCtx.getImageData(
      0,
      0,
      templateBitmap.width,
      templateBitmap.height
    );
    const tileData = tileContext.getImageData(
      Number(coords[2]) * this.renderScale,
      Number(coords[3]) * this.renderScale,
      templateBitmap.width,
      templateBitmap.height
    );

    applyTileComparisonEnhanced(templateData, tileData, selectedColors);

    tempCtx.putImageData(templateData, 0, 0);
    const result = await createImageBitmap(tempCanvas);

    // Canvas cleanup
    CanvasPool.release(tempCanvas);

    return result;
  }
}
