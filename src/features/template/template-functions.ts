import { uint8ToBase64 } from "./utils";

/** テンプレート処理結果の型定義 */
export interface TemplateProcessingResult {
  templateTiles: Record<string, ImageBitmap>;
  templateTilesBuffers: Record<string, string>;
  colorPalette: Record<string, { count: number; enabled: boolean }>;
  affectedTiles: Set<string>;
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
  coords: number[];
  tileSize: number;
  allowedColorsSet: Set<string>;
  enhanced?: EnhancedConfig;
}

/** ピクセル分析 */
const analyzePixels = (data: Uint8ClampedArray, allowedColors: Set<string>) => {
  const palette = new Map<string, number>();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // 透明skip

    const rgb = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    const key = allowedColors.has(rgb) ? rgb : "other";
    palette.set(key, (palette.get(key) || 0) + 1);
  }

  return palette;
};

/** ImageDataピクセル処理 */
const processPixels = (
  imageData: ImageData,
  pixelScale: number,
  enhanced?: EnhancedConfig
): ImageData => {
  const { data, width, height } = imageData;

  // 1st pass: 基本処理
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

  // 2nd pass: enhanced処理（上下左右に赤ドット）
  if (enhanced?.enabled) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x % pixelScale !== 1 || y % pixelScale !== 1) continue;

        const i = (y * width + x) * 4;
        if (data[i + 3] === 0) continue;

        const rgb = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        if (enhanced.selectedColors && !enhanced.selectedColors.has(rgb))
          continue;

        // 上下左右
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
  coords: number[],
  px: number,
  py: number,
  drawW: number,
  drawH: number,
  pixelScale: number,
  enhanced?: EnhancedConfig
) => {
  const canvas = new OffscreenCanvas(drawW * pixelScale, drawH * pixelScale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Failed to get 2D context");

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

  const blob = await canvas.convertToBlob();
  const buffer = uint8ToBase64(new Uint8Array(await blob.arrayBuffer()));

  return {
    bitmap: await createImageBitmap(canvas),
    buffer,
    tileName,
  };
};

/** メインのテンプレート処理関数 */
export const createTemplateTiles = async (
  input: TemplateProcessingInput
): Promise<TemplateProcessingResult> => {
  const { file, coords, tileSize, allowedColorsSet, enhanced } = input;
  const pixelScale = 3;

  const bitmap = await createImageBitmap(file);
  const [w, h] = [bitmap.width, bitmap.height];

  // ピクセル分析
  let palette = new Map<string, number>();
  try {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, 0, 0);
      palette = analyzePixels(
        ctx.getImageData(0, 0, w, h).data,
        allowedColorsSet
      );
    }
  } catch {}

  // タイル処理
  const templateTiles: Record<string, ImageBitmap> = {};
  const templateTilesBuffers: Record<string, string> = {};
  const affectedTiles = new Set<string>();

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
      templateTilesBuffers[result.tileName] = result.buffer;
      affectedTiles.add(result.tileName.split(",").slice(0, 2).join(","));

      px += drawW;
    }

    py += drawH;
  }

  // カラーパレット構築
  const colorPalette: Record<string, { count: number; enabled: boolean }> = {};
  palette.forEach((count, key) => {
    colorPalette[key] = { count, enabled: true };
  });

  return { templateTiles, templateTilesBuffers, colorPalette, affectedTiles };
};
