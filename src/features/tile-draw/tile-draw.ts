import { TILE_DRAW_CONSTANTS, WplaceCoords } from "./constants";
import { CanvasPool } from "./canvas-pool";

/** Enhanced設定の型定義 */
export interface EnhancedConfig {
  enabled: boolean; // enhanceするか否か
  color: [number, number, number]; // enhanceで表示する色(赤デフォ)
  selectedColors?: Set<string>; // この色をenhanceする
}

/**
 * タイル境界をまたぐ画像を複数タイルに分割する標準アルゴリズム。各タイルの処理済みImageBitmapを辞書形式で返却。
 */
export const drawImageOnTiles = async ({
  file,
  coords,
  tileSize,
  enhanced,
}: {
  file: File;
  coords: WplaceCoords;
  tileSize: number;
  enhanced?: EnhancedConfig;
}): Promise<{ templateTiles: Record<string, ImageBitmap> }> => {
  const bitmap = await createImageBitmap(file);
  const [w, h] = [bitmap.width, bitmap.height];

  // カラーフィルターの値を取得
  const colorFilterRGBs = window.mrWplace?.colorFilterManager?.isFilterActive()
    ? window.mrWplace.colorFilterManager.selectedRGBs // publicに変更必要
    : undefined;

  // タイル処理
  const templateTiles: Record<string, ImageBitmap> = {};

  for (let py = coords[3]; py < h + coords[3]; ) {
    const drawH = Math.min(tileSize - (py % tileSize), h - (py - coords[3]));

    for (let px = coords[2]; px < w + coords[2]; ) {
      const drawW = Math.min(tileSize - (px % tileSize), w - (px - coords[2]));

      const result = await processTile(
        bitmap,
        coords,
        px,
        py,
        drawW,
        drawH,
        enhanced,
        colorFilterRGBs
      );

      templateTiles[result.tileName] = result.bitmap;

      px += drawW;
    }

    py += drawH;
  }

  return { templateTiles };
};

/** 単一タイル処理 */
const processTile = async (
  bitmap: ImageBitmap,
  coords: WplaceCoords,
  px: number,
  py: number,
  drawW: number,
  drawH: number,
  enhanced?: EnhancedConfig,
  colorFilter?: Array<[number, number, number]>
) => {
  const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
  const canvas = CanvasPool.acquire(drawW * pixelScale, drawH * pixelScale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    CanvasPool.release(canvas);
    throw new Error("Failed to get 2D context");
  }

  // キャンバスにpixelScaleだけ拡大した画像を作成
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    bitmap,
    px - coords[2],
    py - coords[3],
    drawW,
    drawH,
    0,
    0,
    drawW * pixelScale,
    drawH * pixelScale
  );

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.putImageData(
    processPixels(imageData, pixelScale, enhanced, colorFilter),
    0,
    0
  );

  // タイル名生成
  const tx = coords[0] + Math.floor(px / 1000);
  const ty = coords[1] + Math.floor(py / 1000);
  const tileName = `${tx.toString().padStart(4, "0")},${ty
    .toString()
    .padStart(4, "0")},${(px % 1000).toString().padStart(3, "0")},${(py % 1000)
    .toString()
    .padStart(3, "0")}`;

  const resultBitmap = await createImageBitmap(canvas);

  // Canvas cleanup
  CanvasPool.release(canvas);

  return {
    bitmap: resultBitmap,
    tileName,
  };
};

/**
 * ImageDataピクセル処理統合
 * 処理内容:
 *   1. #deface色 → チェッカーボード透過
 *   2. 中央ピクセル抽出(3x3グリッド)
 *   3. Enhanced有効時: 選択色周りに赤ドット(作成時処理 - 無条件強調)
 * 呼び出し: processTile() → Template作成時のみ
 */
const processPixels = (
  imageData: ImageData,
  pixelScale: number,
  enhanced?: EnhancedConfig,
  colorFilter?: Array<[number, number, number]> // フィルターなしなら、undefined
): ImageData => {
  const { data, width, height } = imageData;

  // もしフィルターですべて非表示なら、何もないImageDataを返す(パフォーマンスのため)
  if (colorFilter?.length === 0) return new ImageData(width, height);

  // NOTE: iは基準位置。iの位置から４つがRGBAの値が入る
  // data[i]   = R値
  // data[i+1] = G値
  // data[i+2] = B値
  // data[i+3] = A値（透明度）

  // ピクセル単位で編集
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4; // (ピクセル位置) * RGBA倍

      // フィルターONで現在透明ピクセルでないなら、フィルター以外を透明化
      if (colorFilter && data[i + 3] > 0) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        const match = colorFilter.some(
          ([pr, pg, pb]) => r === pr && g === pg && b === pb
        );
        if (!match) data[i + 3] = 0; // フィルター以外なので透明化
      }

      if (!enhanced?.enabled) {
        // 中央ピクセル以外透明化 (現在位置のXとYのどちらも1余る=中央)
        if (x % pixelScale !== 1 || y % pixelScale !== 1) {
          data[i + 3] = 0; // 0 = 透明
        }
      } else if (enhanced?.enabled) {
        // ４隅なら透明(X列が中央ではない　かつ　Y列が中央ではない)
        if (!(x % pixelScale === 1 || y % pixelScale === 1)) {
          data[i + 3] = 0; // 0 = 透明
          continue;
        }
      }
    }
  }

  return imageData;
};

/**
 * タイル比較Enhanced適用
 * 用途: 描画時処理 - 選択色がタイルと「違う場合」に赤ドット(差分強調)
 * 呼び出し: TemplateManager.applyTileComparison() → 描画時比較
 */
export const applyTileComparisonEnhanced = (
  templateData: ImageData,
  tileData: ImageData,
  selectedColors?: Set<string>
): void => {
  const tData = templateData.data;
  const tileDat = tileData.data;
  const width = templateData.width;

  for (let y = 1; y < templateData.height; y += 3) {
    for (let x = 1; x < width; x += 3) {
      const i = (y * width + x) * 4;
      if (tData[i + 3] === 0) continue;

      const tColor = `${tData[i]},${tData[i + 1]},${tData[i + 2]}`;
      if (selectedColors && !selectedColors.has(tColor)) continue;

      const tileColor = `${tileDat[i]},${tileDat[i + 1]},${tileDat[i + 2]}`;

      if (tColor !== tileColor) {
        [
          [x, y - 1],
          [x, y + 1],
          [x - 1, y],
          [x + 1, y],
        ].forEach(([px, py]) => {
          if (px >= 0 && px < width && py >= 0 && py < templateData.height) {
            const j = (py * width + px) * 4;
            [tData[j], tData[j + 1], tData[j + 2], tData[j + 3]] = [
              255, 0, 0, 255,
            ];
          }
        });
      }
    }
  }
};
