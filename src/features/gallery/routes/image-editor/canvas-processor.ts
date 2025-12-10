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
  sharpness: number; // 0 ~ 100
}

/**
 * 量子化方法
 */
export type QuantizationMethod = "rgb-euclidean" | "weighted-rgb" | "lab";

/**
 * RGB (0-255) → Lab 色空間変換
 * Lab色空間は人間の視覚に基づいた知覚均等な色空間
 */
const rgbToLab = (r: number, g: number, b: number): [number, number, number] => {
  // 1. RGB → sRGB (0-1 正規化)
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  // 2. sRGB → 線形RGB (ガンマ補正解除)
  const toLinear = (c: number): number => {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  rNorm = toLinear(rNorm);
  gNorm = toLinear(gNorm);
  bNorm = toLinear(bNorm);

  // 3. 線形RGB → XYZ (D65白色点)
  const x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
  const y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.072175;
  const z = rNorm * 0.0193339 + gNorm * 0.119192 + bNorm * 0.9503041;

  // 4. XYZ → Lab (D65白色点で正規化)
  const xn = 0.95047; // D65白色点
  const yn = 1.0;
  const zn = 1.08883;

  const fx = x / xn;
  const fy = y / yn;
  const fz = z / zn;

  const delta = 6 / 29;
  const t0 = delta * delta * delta;
  const m = (1 / 3) * delta * delta;

  const f = (t: number): number => {
    return t > t0 ? Math.pow(t, 1 / 3) : t / (3 * m) + 4 / 29;
  };

  const L = 116 * f(fy) - 16;
  const a = 500 * (f(fx) - f(fy));
  const bLab = 200 * (f(fy) - f(fz));

  return [L, a, bLab];
}

/**
 * RGB Euclidean 距離の2乗（デフォルト、高速）
 * 平方根の計算を省略し、最も単純な色の物理的距離を計算
 */
const colorDistRgbEuclidean2 = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number => {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/**
 * 重み付き RGB Euclidean 距離の2乗
 * 人間の目の感度（緑 > 赤 > 青）を考慮した重み付け
 * 視覚的品質が向上し、より自然な色合いになる
 */
const colorDistWeightedRgb2 = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number => {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;

  // 人間の目の感度に基づく重み (緑に最も敏感)
  const wr = 0.3; // 赤の重み
  const wg = 0.59; // 緑の重み (最大)
  const wb = 0.11; // 青の重み (最小)

  return wr * dr * dr + wg * dg * dg + wb * db * db;
}

/**
 * Lab色空間でのEuclidean距離
 * 最も正確に人間が感じる色差を表現
 * 最高品質の量子化結果が得られ、色の段差（バンディング）が目立ちにくい
 */
const colorDistLab = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number => {
  const [L1, a1, b1Lab] = rgbToLab(r1, g1, b1);
  const [L2, a2, b2Lab] = rgbToLab(r2, g2, b2);

  const dL = L1 - L2;
  const da = a1 - a2;
  const db = b1Lab - b2Lab;

  return dL * dL + da * da + db * db;
}

/**
 * 明るさ・コントラスト・彩度・シャープネス調整を適用
 * ImageDataを直接変更（破壊的）
 */
export const applyImageAdjustments = (
  imageData: ImageData,
  adjustments: ImageAdjustments
): void => {
  const data = imageData.data;
  const { brightness, contrast, saturation, sharpness } = adjustments;

  // 調整なしの場合は処理をスキップ（パフォーマンス最適化）
  const hasBrightnessContrast = brightness !== 0 || contrast !== 0;
  const hasSaturation = saturation !== 0;

  if (!hasBrightnessContrast && !hasSaturation) {
    // アルファ二値化のみ実行
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 128) {
        data[i + 3] = 0;
      } else {
        data[i + 3] = 255;
      }
    }
    // シャープネスのみ処理
    if (sharpness > 0) {
      applySharpness(imageData, sharpness);
    }
    return;
  }

  const brightnessValue = brightness * 2.55;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satFactor = 1 + saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];

    // アルファ二値化：128未満は完全透明として処理スキップ（パフォーマンス最適化）
    if (alpha < 128) {
      data[i + 3] = 0;
      continue;
    }

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 明るさ＋コントラスト
    if (hasBrightnessContrast) {
      r = contrastFactor * (r + brightnessValue - 128) + 128;
      g = contrastFactor * (g + brightnessValue - 128) + 128;
      b = contrastFactor * (b + brightnessValue - 128) + 128;
    }

    // 彩度
    if (hasSaturation) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * satFactor;
      g = gray + (g - gray) * satFactor;
      b = gray + (b - gray) * satFactor;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255; // 強制不透明化
  }

  // シャープネス処理（3x3畳み込みフィルター）
  if (sharpness > 0) {
    applySharpness(imageData, sharpness);
  }
}

/**
 * シャープネスフィルター適用（アンチエイリアス除去）
 * 8方向3x3畳み込みカーネルでエッジを強調し、中間色を除去
 */
const applySharpness = (imageData: ImageData, amount: number): void => {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // 元のデータをコピー（破壊を避けるため）
  const original = new Uint8ClampedArray(data);

  // シャープネス強度を0-1の範囲に正規化
  const strength = amount / 100;

  // 8方向シャープネスカーネル（正規化済み、合計=1）
  // -s  -s  -s
  // -s  1+8s -s
  // -s  -s  -s
  const centerWeight = 1 + 8 * strength;
  const edgeWeight = -strength;

  // 画像の各ピクセルに畳み込みフィルターを適用
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      // 透明ピクセルはスキップ
      if (original[idx + 3] < 128) {
        continue;
      }

      for (let c = 0; c < 3; c++) { // RGB（アルファは除く）
        const channelIdx = idx + c;

        // 8方向の畳み込み
        const sum =
          original[((y - 1) * width + (x - 1)) * 4 + c] * edgeWeight + // 左上
          original[((y - 1) * width + x) * 4 + c] * edgeWeight +       // 上
          original[((y - 1) * width + (x + 1)) * 4 + c] * edgeWeight + // 右上
          original[(y * width + (x - 1)) * 4 + c] * edgeWeight +       // 左
          original[channelIdx] * centerWeight +                         // 中心
          original[(y * width + (x + 1)) * 4 + c] * edgeWeight +       // 右
          original[((y + 1) * width + (x - 1)) * 4 + c] * edgeWeight + // 左下
          original[((y + 1) * width + x) * 4 + c] * edgeWeight +       // 下
          original[((y + 1) * width + (x + 1)) * 4 + c] * edgeWeight;  // 右下

        // クランプして代入
        data[channelIdx] = Math.max(0, Math.min(255, sum));
      }
    }
  }
}

/**
 * カラーパレット量子化
 * ImageDataを直接変更（破壊的）
 */
export const quantizeToColorPalette = (
  imageData: ImageData,
  selectedColorIds: number[],
  method: QuantizationMethod = "rgb-euclidean"
): void => {
  const data = imageData.data;

  // パレットキャッシュ
  const activeColors = colorpalette.filter((c) =>
    selectedColorIds.includes(c.id)
  );
  const rgbList = activeColors.map((c) => c.rgb);

  // Labモードの場合、パレット色のLab変換を事前計算
  const paletteLab =
    method === "lab" ? rgbList.map(([r, g, b]) => rgbToLab(r, g, b)) : [];

  // 量子化方法に応じた色距離計算関数を選択
  const colorDistFn =
    method === "weighted-rgb"
      ? colorDistWeightedRgb2
      : colorDistRgbEuclidean2;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];

    // アルファ二値化：128未満は完全透明として処理スキップ（パフォーマンス最適化）
    if (alpha < 128) {
      data[i + 3] = 0;
      continue;
    }

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 最近色探索
    let minDist = Infinity;
    let nearest: [number, number, number] = rgbList[0];

    if (method === "lab") {
      // Labモード: ピクセルのみLab変換、パレットは事前計算済みを使用
      const [L, a, bLab] = rgbToLab(r, g, b);
      for (let j = 0; j < rgbList.length; j++) {
        const [pL, pA, pB] = paletteLab[j];
        const dL = L - pL;
        const dA = a - pA;
        const dB = bLab - pB;
        const dist = dL * dL + dA * dA + dB * dB;
        if (dist < minDist) {
          minDist = dist;
          nearest = rgbList[j];
        }
      }
    } else {
      // RGB/Weighted RGBモード
      for (let j = 0; j < rgbList.length; j++) {
        const c = rgbList[j];
        const dist = colorDistFn(r, g, b, c[0], c[1], c[2]);
        if (dist < minDist) {
          minDist = dist;
          nearest = c;
        }
      }
    }

    data[i] = nearest[0];
    data[i + 1] = nearest[1];
    data[i + 2] = nearest[2];
    data[i + 3] = 255; // 強制不透明化
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
export const quantizeWithDithering = (
  imageData: ImageData,
  selectedColorIds: number[],
  ditheringThreshold: number,
  method: QuantizationMethod = "rgb-euclidean"
): void => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // パレットキャッシュ
  const activeColors = colorpalette.filter((c) =>
    selectedColorIds.includes(c.id)
  );
  const rgbList = activeColors.map((c) => c.rgb);

  // Labモードの場合、パレット色のLab変換を事前計算
  const paletteLab =
    method === "lab" ? rgbList.map(([r, g, b]) => rgbToLab(r, g, b)) : [];

  // 量子化方法に応じた色距離計算関数を選択
  const colorDistFn =
    method === "weighted-rgb"
      ? colorDistWeightedRgb2
      : colorDistRgbEuclidean2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];

      // アルファ二値化：128未満は完全透明として処理スキップ（パフォーマンス最適化）
      if (alpha < 128) {
        data[i + 3] = 0;
        continue;
      }

      // ベイヤー行列から誤差取得
      const bayerValue = BAYER_MATRIX_4x4[y % 4][x % 4];
      const ditherAmount = bayerValue * (ditheringThreshold / 10); // 誤差強度調整

      // ディザ誤差適用
      let r = Math.max(0, Math.min(255, data[i] + ditherAmount));
      let g = Math.max(0, Math.min(255, data[i + 1] + ditherAmount));
      let b = Math.max(0, Math.min(255, data[i + 2] + ditherAmount));

      // 最近色探索
      let minDist = Infinity;
      let nearest: [number, number, number] = rgbList[0];

      if (method === "lab") {
        // Labモード: ピクセルのみLab変換、パレットは事前計算済みを使用
        const [L, a, bLab] = rgbToLab(r, g, b);
        for (let j = 0; j < rgbList.length; j++) {
          const [pL, pA, pB] = paletteLab[j];
          const dL = L - pL;
          const dA = a - pA;
          const dB = bLab - pB;
          const dist = dL * dL + dA * dA + dB * dB;
          if (dist < minDist) {
            minDist = dist;
            nearest = rgbList[j];
          }
        }
      } else {
        // RGB/Weighted RGBモード
        for (let j = 0; j < rgbList.length; j++) {
          const c = rgbList[j];
          const dist = colorDistFn(r, g, b, c[0], c[1], c[2]);
          if (dist < minDist) {
            minDist = dist;
            nearest = c;
          }
        }
      }

      data[i] = nearest[0];
      data[i + 1] = nearest[1];
      data[i + 2] = nearest[2];
      data[i + 3] = 255; // 強制不透明化
    }
  }
}

/**
 * リサイズ済みImageBitmapから画像処理：調整→パレット量子化
 * 完成したcanvasを返却
 * GPU処理優先・失敗時CPUフォールバック
 */
export async function createProcessedCanvasFromBitmap(
  resizedBitmap: ImageBitmap,
  adjustments: ImageAdjustments,
  selectedColorIds: number[],
  ditheringEnabled = false,
  ditheringThreshold = 500,
  useGpu = true,
  quantizationMethod: QuantizationMethod = "rgb-euclidean"
): Promise<HTMLCanvasElement> {
  const newWidth = resizedBitmap.width;
  const newHeight = resizedBitmap.height;

  // GPU処理試行（useGpu=trueの場合のみ）
  if (useGpu) {
    try {
      console.log("🧑‍🎨 : Attempting GPU processing (cached bitmap), dithering:", ditheringEnabled, "quantization:", quantizationMethod);
      const paletteRGB = colorpalette
        .filter((c) => selectedColorIds.includes(c.id))
        .map((c) => c.rgb);

      // ImageBitmapはクローンして渡す（gpuProcessImageで閉じられるため）
      const bitmapClone = await createImageBitmap(resizedBitmap);
      const processedData = await gpuProcessImage(
        bitmapClone,
        adjustments,
        paletteRGB,
        ditheringEnabled,
        ditheringThreshold,
        quantizationMethod
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

  // CPU処理
  console.log("🧑‍🎨 : Starting CPU processing via cached ImageBitmap");

  // ImageBitmap → ImageData
  const tempCanvas = new OffscreenCanvas(newWidth, newHeight);
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) throw new Error("Failed to get temp context");

  tempCtx.drawImage(resizedBitmap, 0, 0);
  const imageData = tempCtx.getImageData(0, 0, newWidth, newHeight);

  // CPU処理適用
  applyImageAdjustments(imageData, adjustments);

  // ディザ処理切り替え
  if (ditheringEnabled) {
    quantizeWithDithering(imageData, selectedColorIds, ditheringThreshold, quantizationMethod);
  } else {
    quantizeToColorPalette(imageData, selectedColorIds, quantizationMethod);
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
  useGpu = true,
  quantizationMethod: QuantizationMethod = "rgb-euclidean"
): Promise<HTMLCanvasElement> {
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;
  const newWidth = Math.floor(originalWidth * scale);
  const newHeight = Math.floor(originalHeight * scale);

  // GPU処理試行（useGpu=trueの場合のみ）
  if (useGpu) {
    try {
      console.log("🧑‍🎨 : Attempting GPU processing, dithering:", ditheringEnabled, "quantization:", quantizationMethod);
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
        ditheringThreshold,
        quantizationMethod
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
    quantizeWithDithering(imageData, selectedColorIds, ditheringThreshold, quantizationMethod);
  } else {
    quantizeToColorPalette(imageData, selectedColorIds, quantizationMethod);
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
