import { Template } from "./Template";
import { applyTileComparisonEnhanced } from "./template-functions";
import { TEMPLATE_CONSTANTS, TemplateCoords, TileCoords } from "./constants";
import { CanvasPool } from "./canvas-pool";
import { getEnhancedConfig } from "./utils";

interface TemplateInstance {
  template: Template;
  imageKey: string;
  drawEnabled: boolean;
}

export class TemplateManager {
  public tileSize: number;
  public renderScale: number;
  public templates: TemplateInstance[];

  constructor() {
    this.tileSize = TEMPLATE_CONSTANTS.TILE_SIZE;
    this.renderScale = TEMPLATE_CONSTANTS.RENDER_SCALE;
    this.templates = [];
  }

  async createTemplate(
    blob: File,
    coords: TemplateCoords,
    imageKey: string
  ): Promise<void> {
    this.removeTemplateByKey(imageKey);

    const template = new Template(blob, coords);

    const { templateTiles } = await template.createTemplateTiles(undefined);
    template.tiles = templateTiles;

    this.templates.push({
      template,
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

    const matchingTiles: Array<{ tileKey: string; template: Template }> = [];

    for (const instance of this.templates) {
      if (!instance.drawEnabled || !instance.template?.tiles) continue;

      const tiles = Object.keys(instance.template.tiles).filter((tile) =>
        tile.startsWith(coordStr)
      );

      for (const tileKey of tiles) {
        matchingTiles.push({ tileKey, template: instance.template });
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
    const enhancedConfig = getEnhancedConfig();

    for (const { tileKey, template } of matchingTiles) {
      const coords = tileKey.split(",");
      let templateBitmap = template.tiles?.[tileKey];
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
      if (!instance.drawEnabled || !instance.template?.coords) continue;

      const [templateTileX, templateTileY] = instance.template.coords;
      if (templateTileX === tileX && templateTileY === tileY) return true;
    }
    return false;
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
