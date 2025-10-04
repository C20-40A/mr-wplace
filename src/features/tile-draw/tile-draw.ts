import { TILE_DRAW_CONSTANTS, WplaceCoords } from "./constants";
import { CanvasPool } from "./canvas-pool";

/** Enhanced設定の型定義 */
export interface EnhancedConfig {
  mode:
    | "dot" // 1ドット
    | "cross" // 同色十字
    | "red-cross" // 赤十字
    | "cyan-cross" // シアン十字
    | "dark-cross" // 暗色十字
    | "complement-cross" // 補色十字
    | "fill" // 全塗り
    | "red-border"; // 赤枠
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
  enhanced: EnhancedConfig;
}): Promise<{ preparedOverlayImage: Record<string, ImageBitmap> }> => {
  const bitmap = await createImageBitmap(file);
  const [w, h] = [bitmap.width, bitmap.height];

  // カラーフィルターの値を取得
  const colorFilterRGBs = window.mrWplace?.colorFilterManager?.isFilterActive()
    ? window.mrWplace.colorFilterManager.selectedRGBs // publicに変更必要
    : undefined;

  // タイル処理
  const preparedOverlayImages: Record<string, ImageBitmap> = {};

  for (let py = coords[3]; py < h + coords[3]; ) {
    const drawH = Math.min(tileSize - (py % tileSize), h - (py - coords[3]));

    for (let px = coords[2]; px < w + coords[2]; ) {
      const drawW = Math.min(tileSize - (px % tileSize), w - (px - coords[2]));

      console.log(`🧑‍🎨: drawImageOnTiles at ${coords} size ${tileSize}`);
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

      preparedOverlayImages[result.tileName] = result.bitmap;

      px += drawW;
    }

    py += drawH;
  }

  return { preparedOverlayImage: preparedOverlayImages };
};

/** 単一タイル処理 */
const processTile = async (
  bitmap: ImageBitmap,
  coords: WplaceCoords,
  px: number,
  py: number,
  drawW: number,
  drawH: number,
  enhanced: EnhancedConfig,
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
 */
const processPixels = (
  imageData: ImageData,
  pixelScale: number,
  enhanced: EnhancedConfig,
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

  const enhancedMode = enhanced?.mode;

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

      // === 簡単パターン: タイル色比較不要 ===
      if (enhancedMode === "dot") {
        // 中央ピクセル以外透明化 (現在位置のXとYのどちらも1余る=中央)
        if (x % pixelScale !== 1 || y % pixelScale !== 1) {
          data[i + 3] = 0; // 0 = 透明
        }
      } else if (enhancedMode === "cross") {
        // ４隅なら透明(X列が中央ではない　かつ　Y列が中央ではない)
        if (!(x % pixelScale === 1 || y % pixelScale === 1)) {
          data[i + 3] = 0; // 0 = 透明
        }
      } else if (enhancedMode === "fill") {
        // 塗りつぶしは、そのまま何もしない（全ピクセル保持）
        continue;
      }
      // 補助色パターン（red-cross/cyan-cross/dark-cross/complement-cross/red-border）は
      // drawOverlayLayersOnTileで背景タイルとの比較処理を行う
    }
  }

  return imageData;
};
