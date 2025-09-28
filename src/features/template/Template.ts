import { createTemplateTiles as createTemplateTilesFn } from "./template-functions";
import { createAllowedColorsSet } from "./utils";
import { TEMPLATE_CONSTANTS, TemplateCoords } from "./constants";

export class Template {
  public file: File;
  public coords: TemplateCoords;
  public tiles: Record<string, ImageBitmap> | null;
  public colorPalette: Record<string, { count: number; enabled: boolean }>;
  public allowedColorsSet: Set<string>;

  constructor(file: File, coords: TemplateCoords) {
    this.file = file;
    this.coords = coords;
    this.tiles = null;
    this.colorPalette = {};
    this.allowedColorsSet = createAllowedColorsSet();
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
      allowedColorsSet: this.allowedColorsSet,
      enhanced: enhancedConfig
        ? {
            enabled: enhancedConfig.enabled,
            color: [255, 0, 0] as [number, number, number],
            selectedColors: enhancedConfig.selectedColors,
          }
        : undefined,
    });

    this.colorPalette = result.colorPalette;

    return {
      templateTiles: result.templateTiles,
    };
  }
}
