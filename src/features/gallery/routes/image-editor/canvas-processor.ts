import { colorpalette } from "../../../../constants/colors";
import { gpuProcessImage } from "./gpu-image-processor";
import { createResizedImageBitmap } from "@/utils/image-bitmap-compat";

/**
 * 画像調整パラメータ
 */
export interface ImageAdjustments {
  brightness: number; // -100 ~ 100
  contrast: number; // -100 ~ 100
  saturation: number; // -100 ~ 100
}

/**
 * 明るさ・コントラスト・彩度調整を適用
 * ImageDataを直接変更（破壊的）
 */
export function applyImageAdjustments(
  imageData: ImageData,
  adjustments: ImageAdjustments
): void {
  const data = imageData.data;
  const { brightness, contrast, saturation } = adjustments;

  const brightnessValue = brightness * 2.55;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satFactor = 1 + saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 明るさ＋コントラスト
    r = contrastFactor * (r + brightnessValue - 128) + 128;
    g = contrastFactor * (g + brightnessValue - 128) + 128;
    b = contrastFactor * (b + brightnessValue - 128) + 128;

    // 彩度
    if (saturation !== 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * satFactor;
      g = gray + (g - gray) * satFactor;
      b = gray + (b - gray) * satFactor;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/**
 * カラーパレット量子化
 * ImageDataを直接変更（破壊的）
 */
export function quantizeToColorPalette(
  imageData: ImageData,
  selectedColorIds: number[]
): void {
  const data = imageData.data;

  // パレットキャッシュ
  const activeColors = colorpalette.filter((c) =>
    selectedColorIds.includes(c.id)
  );
  const rgbList = activeColors.map((c) => c.rgb);

  // √省略版距離計算
  function colorDist2(
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number
  ): number {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db;
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 最近色探索
    let minDist = Infinity;
    let nearest: [number, number, number] = rgbList[0];
    for (let j = 0; j < rgbList.length; j++) {
      const c = rgbList[j];
      const d2 = colorDist2(r, g, b, c[0], c[1], c[2]);
      if (d2 < minDist) {
        minDist = d2;
        nearest = c;
      }
    }

    data[i] = nearest[0];
    data[i + 1] = nearest[1];
    data[i + 2] = nearest[2];
  }
}

/**
 * 4x4ベイヤー行列
 * 正規化済み（-0.5 ~ 0.5）
 */
const BAYER_MATRIX_4x4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16 - 0.5));

/**
 * ベイヤーディザリング + カラーパレット量子化
 * ImageDataを直接変更（破壊的）
 */
export function quantizeWithDithering(
  imageData: ImageData,
  selectedColorIds: number[]
): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // パレットキャッシュ
  const activeColors = colorpalette.filter((c) =>
    selectedColorIds.includes(c.id)
  );
  const rgbList = activeColors.map((c) => c.rgb);

  // √省略版距離計算
  function colorDist2(
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number
  ): number {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // ベイヤー行列から誤差取得
      const bayerValue = BAYER_MATRIX_4x4[y % 4][x % 4];
      const ditherAmount = bayerValue * 64; // 誤差強度調整

      // ディザ誤差適用
      let r = Math.max(0, Math.min(255, data[i] + ditherAmount));
      let g = Math.max(0, Math.min(255, data[i + 1] + ditherAmount));
      let b = Math.max(0, Math.min(255, data[i + 2] + ditherAmount));

      // 最近色探索
      let minDist = Infinity;
      let nearest: [number, number, number] = rgbList[0];
      for (let j = 0; j < rgbList.length; j++) {
        const c = rgbList[j];
        const d2 = colorDist2(r, g, b, c[0], c[1], c[2]);
        if (d2 < minDist) {
          minDist = d2;
          nearest = c;
        }
      }

      data[i] = nearest[0];
      data[i + 1] = nearest[1];
      data[i + 2] = nearest[2];
    }
  }
}

/**
 * 画像処理統合：リサイズ→調整→パレット量子化
 * 完成したcanvasを返却
 * GPU処理優先・失敗時CPUフォールバック
 */
export async function createProcessedCanvas(
  img: HTMLImageElement,
  scale: number,
  adjustments: ImageAdjustments,
  selectedColorIds: number[],
  ditheringEnabled = false,
  ditheringThreshold = 500,
  useGpu = true
): Promise<HTMLCanvasElement> {
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;
  const newWidth = Math.floor(originalWidth * scale);
  const newHeight = Math.floor(originalHeight * scale);

  // GPU処理試行（useGpu=trueの場合のみ）
  if (useGpu) {
    try {
      console.log("🧑‍🎨 : Attempting GPU processing, dithering:", ditheringEnabled);
      // HTMLImageElementから直接ImageBitmap作成（canvas経由せずリサイズ）
      const imageBitmap = await createResizedImageBitmap(img, {
        width: newWidth,
        height: newHeight,
        quality: "pixelated"
      });
      const paletteRGB = colorpalette
        .filter((c) => selectedColorIds.includes(c.id))
        .map((c) => c.rgb);

      const processedData = await gpuProcessImage(
        imageBitmap,
        adjustments,
        paletteRGB,
        ditheringEnabled,
        ditheringThreshold
      );

      // 結果をcanvasに描画
      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");

      const imageData = new ImageData(
        new Uint8ClampedArray(processedData),
        newWidth,
        newHeight
      );
      ctx.putImageData(imageData, 0, 0);

      console.log("🧑‍🎨 : GPU processing succeeded");
      return canvas;
    } catch (error) {
      console.log("🧑‍🎨 : GPU processing failed, fallback to CPU:", error);
    }
  } else {
    console.log("🧑‍🎨 : CPU processing selected");
  }

  // CPU処理（ImageBitmap経由でcanvas汚染を回避）
  console.log("🧑‍🎨 : Starting CPU processing via ImageBitmap");
  
  // HTMLImageElement → ImageBitmap（リサイズ付き、canvas汚染回避）
  const imageBitmap = await createResizedImageBitmap(img, {
    width: newWidth,
    height: newHeight,
    quality: "pixelated"
  });
  
  // ImageBitmap → ImageData（clean）
  const tempCanvas = new OffscreenCanvas(newWidth, newHeight);
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) throw new Error("Failed to get temp context");
  
  tempCtx.drawImage(imageBitmap, 0, 0);
  const imageData = tempCtx.getImageData(0, 0, newWidth, newHeight);
  
  // ImageBitmap解放
  imageBitmap.close();
  
  // CPU処理適用
  applyImageAdjustments(imageData, adjustments);

  // ディザ処理切り替え
  if (ditheringEnabled) {
    quantizeWithDithering(imageData, selectedColorIds);
  } else {
    quantizeToColorPalette(imageData, selectedColorIds);
  }

  // 新しいclean canvasに描画
  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
