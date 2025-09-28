import { createTemplateTiles as createTemplateTilesFn } from "./template-functions";
import { createAllowedColorsSet } from "./utils";
import { TEMPLATE_CONSTANTS } from "./constants";

export class Template {
  public file: File;
  public coords: number[];
  public tiles: Record<string, ImageBitmap> | null;
  public colorPalette: Record<string, { count: number; enabled: boolean }>;
  public affectedTiles: Set<string>;
  public allowedColorsSet: Set<string>;

  constructor(file: File, coords: number[]) {
    this.file = file;
    this.coords = coords;
    this.tiles = null;
    this.colorPalette = {};
    this.affectedTiles = new Set();
    this.allowedColorsSet = createAllowedColorsSet();
  }

  /** Create template tiles with optional enhanced config */
  async createTemplateTiles(enhancedConfig?: {
    enabled: boolean;
    selectedColors?: Set<string>;
  }): Promise<{
    templateTiles: Record<string, ImageBitmap>;
    templateTilesBuffers: Record<string, string>;
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
    this.affectedTiles = result.affectedTiles;

    return {
      templateTiles: result.templateTiles,
      templateTilesBuffers: result.templateTilesBuffers,
    };
  }
}
