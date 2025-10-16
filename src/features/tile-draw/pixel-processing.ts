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

/**
 * ImageBitmap を OffscreenCanvas 経由で Uint8ClampedArray に変換する非同期関数
 * @param {ImageBitmap} imageBitmap - 変換対象の ImageBitmap
 * @returns {Uint8ClampedArray} - 変換されたピクセルデータ
 */
export const convertImageBitmapToUint8ClampedArray = (
  imageBitmap: ImageBitmap
) => {
  // OffscreenCanvasを作成
  const offscreen = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const context = offscreen.getContext("2d");

  if (!context)
    throw new Error("OffscreenCanvasのコンテキスト取得に失敗しました");

  // ImageBitmapを描画
  context.drawImage(imageBitmap, 0, 0);

  // ピクセルデータを取得
  const imageData = context.getImageData(
    0,
    0,
    imageBitmap.width,
    imageBitmap.height
  );

  // Uint8ClampedArray (dataプロパティ) を返す
  return imageData.data;
};
