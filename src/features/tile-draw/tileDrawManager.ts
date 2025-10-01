import { drawImageOnTiles } from "./tile-draw";
import type { EnhancedConfig } from "./tile-draw";
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
  public overlayLayers: TileDrawInstance[];

  constructor() {
    this.tileSize = TILE_DRAW_CONSTANTS.TILE_SIZE;
    this.renderScale = TILE_DRAW_CONSTANTS.RENDER_SCALE;
    this.overlayLayers = [];
  }

  async addImageToOverlayLayers(
    blob: File,
    coords: WplaceCoords,
    imageKey: string
  ): Promise<void> {
    this.removeTemplateByKey(imageKey);
    const enhancedConfig = this.getEnhancedConfig();

    const { templateTiles } = await drawImageOnTiles({
      file: blob,
      coords,
      tileSize: this.tileSize,
      enhanced: enhancedConfig,
    });

    this.overlayLayers.push({
      coords,
      tiles: templateTiles,
      imageKey,
      drawEnabled: true,
    });
  }

  async drawOverlayLayersOnTile(
    tileBlob: Blob,
    tileCoords: TileCoords
  ): Promise<Blob> {
    if (this.overlayLayers.length === 0) return tileBlob; // 描画するものがなければスキップ

    const drawSize = this.tileSize * this.renderScale;
    const coordStr =
      tileCoords[0].toString().padStart(4, "0") +
      "," +
      tileCoords[1].toString().padStart(4, "0");

    // 現在タイルに重なる全オーバーレイ画像のリストを取得
    const matchingTiles: Array<{
      tileKey: string;
      instance: TileDrawInstance;
    }> = [];
    for (const instance of this.overlayLayers) {
      if (!instance.drawEnabled || !instance.tiles) continue;
      const tiles = Object.keys(instance.tiles).filter((tile) =>
        tile.startsWith(coordStr)
      );
      for (const tileKey of tiles) matchingTiles.push({ tileKey, instance });
    }
    if (matchingTiles.length === 0) return tileBlob;

    // キャンバス作成
    const canvas = new OffscreenCanvas(drawSize, drawSize);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("tile canvas context not found");
    context.imageSmoothingEnabled = false;

    // 元タイル画像を読み込んで下地化
    const tileBitmap = await createImageBitmap(tileBlob);
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

    // 透明背景に複数オーバーレイが重なった合成画像を出力
    for (const { tileKey, instance } of matchingTiles) {
      const coords = tileKey.split(",");
      let paintedTilebitmap = instance.tiles?.[tileKey];
      if (!paintedTilebitmap) continue;

      context.drawImage(
        paintedTilebitmap,
        Number(coords[2]) * this.renderScale,
        Number(coords[3]) * this.renderScale
      );
    }

    const result = await canvas.convertToBlob({ type: "image/png" });
    return result;

    //     // ⚠️TODO: タイルの違いチェッカーは後で実装
    //     if (enhancedConfig?.enabled) {
    //       templateBitmap = await this.applyTileComparison(
    //         templateBitmap,
    //         originalTileCtx,
    //         coords,
    //         enhancedConfig.selectedColors
    //       );
    //     }
  }

  removeTemplateByKey(imageKey: string): void {
    this.overlayLayers = this.overlayLayers.filter(
      (i) => i.imageKey !== imageKey
    );
  }

  toggleDrawEnabled(imageKey: string): boolean {
    const instance = this.overlayLayers.find((i) => i.imageKey === imageKey);
    if (!instance) return false;

    instance.drawEnabled = !instance.drawEnabled;
    return instance.drawEnabled;
  }

  clearAllTemplates(): void {
    this.overlayLayers = [];
  }

  isDrawingOnTile(tileX: number, tileY: number): boolean {
    for (const instance of this.overlayLayers) {
      if (!instance.drawEnabled || !instance.coords) continue;

      const [templateTileX, templateTileY] = instance.coords;
      if (templateTileX === tileX && templateTileY === tileY) return true;
    }
    return false;
  }

  private getEnhancedConfig(): EnhancedConfig {
    const colorFilterManager = window.mrWplace?.colorFilterManager;
    const mode = colorFilterManager?.getEnhancedMode() ?? "dot";
    return { mode };
  }

  // private async applyTileComparison(
  //   templateBitmap: ImageBitmap,
  //   tileContext: OffscreenCanvasRenderingContext2D,
  //   coords: string[],
  //   selectedColors?: Set<string>
  // ): Promise<ImageBitmap> {
  //   const tempCanvas = CanvasPool.acquire(
  //     templateBitmap.width,
  //     templateBitmap.height
  //   );
  //   const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
  //   if (!tempCtx) {
  //     CanvasPool.release(tempCanvas);
  //     return templateBitmap;
  //   }

  //   tempCtx.drawImage(templateBitmap, 0, 0);

  //   const templateData = tempCtx.getImageData(
  //     0,
  //     0,
  //     templateBitmap.width,
  //     templateBitmap.height
  //   );
  //   const tileData = tileContext.getImageData(
  //     Number(coords[2]) * this.renderScale,
  //     Number(coords[3]) * this.renderScale,
  //     templateBitmap.width,
  //     templateBitmap.height
  //   );

  //   applyTileComparisonEnhanced(templateData, tileData, selectedColors);

  //   tempCtx.putImageData(templateData, 0, 0);
  //   const result = await createImageBitmap(tempCanvas);

  //   // Canvas cleanup
  //   CanvasPool.release(tempCanvas);

  //   return result;
  // }
}
