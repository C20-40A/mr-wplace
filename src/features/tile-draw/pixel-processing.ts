import { TILE_DRAW_CONSTANTS } from "./constants";
import type { GridPosition } from "./types";

/**
 * x3グリッド内での位置判定（純粋関数）
 * @param x x座標（x3スケール）
 * @param y y座標（x3スケール）
 * @returns グリッド位置情報
 */
export const getGridPosition = (x: number, y: number): GridPosition => {
  const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
  const isCenterPixel = x % pixelScale === 1 && y % pixelScale === 1;
  const isCrossArm = x % pixelScale === 1 || y % pixelScale === 1;

  return { isCenterPixel, isCrossArm };
};

/**
 * 背景ピクセルのインデックス計算（純粋関数）
 * @param bgX 背景x座標
 * @param bgY 背景y座標
 * @param tileSize タイルサイズ
 * @returns ピクセルインデックス（RGBA = 4bytes）
 */
export const getBgPixelIndex = (
  bgX: number,
  bgY: number,
  tileSize: number
): number => {
  return (bgY * tileSize + bgX) * 4;
};
