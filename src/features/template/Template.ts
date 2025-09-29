import { createTemplateTiles as createTemplateTilesFn } from "./template-functions";
import { TEMPLATE_CONSTANTS, TemplateCoords } from "./constants";

export class Template {
  public file: File; // タイル画像
  public coords: TemplateCoords; // タイル位置
  public tiles: Record<string, ImageBitmap> | null;

  constructor(file: File, coords: TemplateCoords) {
    this.file = file;
    this.coords = coords;
    this.tiles = null;
  }

  /** Create template tiles with optional enhanced config */
  async createTemplateTiles(enhancedConfig?: {
    enabled: boolean;
    selectedColors?: Set<string>;
  }): Promise<{
    templateTiles: Record<string, ImageBitmap>;
  }> {
    const result = await createTemplateTilesFn({
      file: this.file,
      coords: this.coords,
      tileSize: TEMPLATE_CONSTANTS.TILE_SIZE,
      enhanced: enhancedConfig
        ? {
            enabled: enhancedConfig.enabled,
            color: [255, 0, 0] as [number, number, number],
            selectedColors: enhancedConfig.selectedColors,
          }
        : undefined,
    });

    return { templateTiles: result.templateTiles };
  }
}
