import { TEMPLATE_CONSTANTS, TemplateCoords } from "./constants";
import { CanvasPool } from "./canvas-pool";

/** テンプレート処理結果の型定義 */
export interface TemplateProcessingResult {
  templateTiles: Record<string, ImageBitmap>;
}

/** Enhanced設定の型定義 */
interface EnhancedConfig {
  enabled: boolean; // enhanceするか否か
  color: [number, number, number]; // enhanceで表示する色(赤デフォ)
  selectedColors?: Set<string>; // この色をenhanceする
}

/** テンプレート入力パラメータの型定義 */
export interface TemplateProcessingInput {
  file: File;
  coords: TemplateCoords;
  tileSize: number;
  enhanced?: EnhancedConfig;
}

/**
 * タイル比較Enhanced適用
 * 用途: 描画時処理 - 選択色がタイルと「違う場合」に赤ドット(差分強調)
 * 呼び出し: TemplateManager.applyTileComparison() → 描画時比較
 */
export function applyTileComparisonEnhanced(
  templateData: ImageData,
  tileData: ImageData,
  selectedColors?: Set<string>
): void {
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
}

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
  enhanced?: EnhancedConfig
): ImageData => {
  const { data, width, height } = imageData;

  // 基本処理: #deface変換 + 中央ピクセル抽出
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // #deface色 → チェッカーボード
      if (data[i] === 222 && data[i + 1] === 250 && data[i + 2] === 206) {
        const isEven = (x + y) % 2 === 0;
        data[i] = data[i + 1] = data[i + 2] = isEven ? 0 : 255;
        data[i + 3] = 32;
      } else if (x % pixelScale !== 1 || y % pixelScale !== 1) {
        // 中央ピクセル以外透明化
        data[i + 3] = 0;
      }
    }
  }

  // Enhanced処理: 選択色周りに赤ドット(作成時)
  if (enhanced?.enabled) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x % pixelScale !== 1 || y % pixelScale !== 1) continue;

        const i = (y * width + x) * 4;
        if (data[i + 3] === 0) continue;

        const rgb = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        if (enhanced.selectedColors && !enhanced.selectedColors.has(rgb))
          continue;

        // 上下左右に赤ドット
        [
          [x, y - 1],
          [x, y + 1],
          [x - 1, y],
          [x + 1, y],
        ].forEach(([px, py]) => {
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const j = (py * width + px) * 4;
            [data[j], data[j + 1], data[j + 2], data[j + 3]] = [
              ...enhanced.color,
              255,
            ];
          }
        });
      }
    }
  }

  return imageData;
};

/** 単一タイル処理 */
const processTile = async (
  bitmap: ImageBitmap,
  coords: TemplateCoords,
  px: number,
  py: number,
  drawW: number,
  drawH: number,
  pixelScale: number,
  enhanced?: EnhancedConfig
) => {
  const canvas = CanvasPool.acquire(drawW * pixelScale, drawH * pixelScale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    CanvasPool.release(canvas);
    throw new Error("Failed to get 2D context");
  }

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
  ctx.putImageData(processPixels(imageData, pixelScale, enhanced), 0, 0);

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

/** メインのテンプレート処理関数 */
export const createTemplateTiles = async (
  input: TemplateProcessingInput
): Promise<TemplateProcessingResult> => {
  const { file, coords, tileSize, enhanced } = input;
  const pixelScale = TEMPLATE_CONSTANTS.PIXEL_SCALE;

  const bitmap = await createImageBitmap(file);
  const [w, h] = [bitmap.width, bitmap.height];

  // ピクセル分析削除（colorPalette不要のため）

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
        pixelScale,
        enhanced
      );

      templateTiles[result.tileName] = result.bitmap;

      px += drawW;
    }

    py += drawH;
  }

  return { templateTiles };
};
