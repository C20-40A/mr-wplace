/** Template system constants */
export const TEMPLATE_CONSTANTS = {
  /** Pixel scale for rendering (3x3 grid, center pixel extraction) */
  PIXEL_SCALE: 3,
  /** Render scale for canvas drawing */
  RENDER_SCALE: 3,
  /** Tile size in pixels */
  TILE_SIZE: 1000,
} as const;

/** Template coordinate types */
export type TemplateCoords = [tileX: number, tileY: number, pixelX: number, pixelY: number];
export type TileCoords = [tileX: number, tileY: number];
export type PixelCoords = [pixelX: number, pixelY: number];
