import type { EnhancedMode } from "@/types/image";
import type { WplaceCoords } from "./constants";

/** Enhanced設定 */
export interface EnhancedConfig {
  mode: EnhancedMode;
}

/** RGB色 */
export type RGB = readonly [r: number, g: number, b: number];

/** RGBA色 */
export type RGBA = readonly [r: number, g: number, b: number, a: number];

/** カラーフィルター */
export type ColorFilter = ReadonlyArray<RGB>;

/** TileDrawInstance - 画像単位管理構造 */
export interface TileDrawInstance {
  coords: WplaceCoords;
  tiles: Record<string, ImageBitmap> | null;
  imageKey: string;
  drawEnabled: boolean;
}

/** タイル処理結果 */
export interface TileProcessResult {
  bitmap: ImageBitmap;
  tileName: string;
}

/** 色統計 */
export interface ColorStats {
  matched: Map<string, number>;
  total: Map<string, number>;
}

/** グリッド位置情報 */
export interface GridPosition {
  isCenterPixel: boolean;
  isCrossArm: boolean;
}
