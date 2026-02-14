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

export interface OutlinePreserveOptions {
  enabled: boolean;
  threshold: number; // sensitivity 0 ~ 200
  width: number; // 1 ~ 4
  useFixedColor: boolean;
  fixedColor: string; // #RRGGBB
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
 * 明るさ・コントラスト・彩度調整を適用
 * ImageDataを直接変更（破壊的）
 */
export const applyImageAdjustments = (
  imageData: ImageData,
  adjustments: ImageAdjustments
): void => {
  const data = imageData.data;
  const { brightness, contrast, saturation } = adjustments;

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

}

const parseHexColor = (hex: string): [number, number, number] | null => {
  const normalized = hex.trim().toLowerCase();
  const match = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!match) return null;
  const value = match[1];
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const removeIsolatedMaskPixels = (
  sourceMask: Uint8Array,
  width: number,
  height: number,
  minNeighbors = 2
): Uint8Array => {
  const cleaned = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (!sourceMask[idx]) continue;

      let neighbors = 0;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          if (nx === x && ny === y) continue;
          if (sourceMask[ny * width + nx]) neighbors++;
        }
      }

      if (neighbors >= minNeighbors) cleaned[idx] = 1;
    }
  }
  return cleaned;
};

const filterSmallMaskComponents = (
  sourceMask: Uint8Array,
  width: number,
  height: number,
  minArea: number
): Uint8Array => {
  if (minArea <= 1) return sourceMask;
  const result = new Uint8Array(sourceMask);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);

  for (let i = 0; i < sourceMask.length; i++) {
    if (!sourceMask[i] || visited[i]) continue;

    let head = 0;
    let tail = 0;
    const members: number[] = [];
    queue[tail++] = i;
    visited[i] = 1;

    while (head < tail) {
      const idx = queue[head++];
      members.push(idx);
      const x = idx % width;
      const y = Math.floor(idx / width);

      if (x > 0) {
        const left = idx - 1;
        if (sourceMask[left] && !visited[left]) {
          visited[left] = 1;
          queue[tail++] = left;
        }
      }
      if (x + 1 < width) {
        const right = idx + 1;
        if (sourceMask[right] && !visited[right]) {
          visited[right] = 1;
          queue[tail++] = right;
        }
      }
      if (y > 0) {
        const up = idx - width;
        if (sourceMask[up] && !visited[up]) {
          visited[up] = 1;
          queue[tail++] = up;
        }
      }
      if (y + 1 < height) {
        const down = idx + width;
        if (sourceMask[down] && !visited[down]) {
          visited[down] = 1;
          queue[tail++] = down;
        }
      }
    }

    if (members.length < minArea) {
      for (let j = 0; j < members.length; j++) {
        result[members[j]] = 0;
      }
    }
  }

  return result;
};

/**
 * アニメ線画向け輪郭抽出:
 * 暗線 + 局所コントラスト + 勾配の複合判定で線候補を抽出
 */
const createInkLineMask = (
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  sensitivity: number
): Uint8Array => {
  const pixelCount = width * height;
  const luma = new Float32Array(pixelCount);
  const chroma = new Float32Array(pixelCount);
  const valid = new Uint8Array(pixelCount);
  const rawMask = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    if (sourceData[offset + 3] < 128) continue;
    const r = sourceData[offset];
    const g = sourceData[offset + 1];
    const b = sourceData[offset + 2];
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    chroma[i] = Math.max(r, g, b) - Math.min(r, g, b);
    valid[i] = 1;
  }

  const s = Math.max(0, Math.min(200, sensitivity)) / 100; // 0.0~2.0
  const darkLumaMax = Math.min(255, 72 + s * 120); // 72~255
  const gradientMin = Math.max(0, 70 - s * 62); // 70~0
  const contrastMin = Math.max(0, 36 - s * 30); // 36~0
  const localSlack = Math.max(0, 10 - s * 6); // 10~0
  const axisContrastMin = Math.max(3, contrastMin * 0.55);
  const chromaMax = Math.max(24, 72 - s * 18);
  const minComponentArea = s >= 1.4 ? 2 : 3;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (!valid[idx]) continue;

      const center = luma[idx];
      if (center > darkLumaMax) continue;
      if (center > 32 && chroma[idx] > chromaMax) continue;

      const leftIdx = x > 0 ? idx - 1 : idx;
      const rightIdx = x + 1 < width ? idx + 1 : idx;
      const upIdx = y > 0 ? idx - width : idx;
      const downIdx = y + 1 < height ? idx + width : idx;

      const left = valid[leftIdx] ? luma[leftIdx] : center;
      const right = valid[rightIdx] ? luma[rightIdx] : center;
      const up = valid[upIdx] ? luma[upIdx] : center;
      const down = valid[downIdx] ? luma[downIdx] : center;
      const gradient = Math.abs(right - left) + Math.abs(down - up);

      let neighborCount = 0;
      let neighborSum = 0;
      let minNeighbor = Infinity;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        const nyOffset = ny * width;
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          if (nx === x && ny === y) continue;
          const nIdx = nyOffset + nx;
          if (!valid[nIdx]) continue;
          const nLuma = luma[nIdx];
          neighborCount++;
          neighborSum += nLuma;
          if (nLuma < minNeighbor) minNeighbor = nLuma;
        }
      }

      if (neighborCount === 0) continue;
      const neighborMean = neighborSum / neighborCount;
      const hasContrast = neighborMean - center >= contrastMin;
      const isLocalMinimum = center <= minNeighbor + localSlack;
      const axisSupported =
        (left - center >= axisContrastMin && right - center >= axisContrastMin) ||
        (up - center >= axisContrastMin && down - center >= axisContrastMin);
      if (isLocalMinimum && (axisSupported || (hasContrast && gradient >= gradientMin))) {
        rawMask[idx] = 1;
      }
    }
  }

  const isolatedRemoved = removeIsolatedMaskPixels(rawMask, width, height);
  const componentFiltered = filterSmallMaskComponents(
    isolatedRemoved,
    width,
    height,
    minComponentArea
  );
  return removeIsolatedMaskPixels(componentFiltered, width, height, 1);
};

const dilateMask = (
  sourceMask: Uint8Array,
  width: number,
  height: number,
  iterations: number
): Uint8Array => {
  if (iterations <= 0) return sourceMask;
  let current = sourceMask;
  let next = new Uint8Array(width * height);

  for (let step = 0; step < iterations; step++) {
    next.fill(0);
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x;
        if (!current[idx]) continue;
        next[idx] = 1;
        if (x > 0) next[idx - 1] = 1;
        if (x + 1 < width) next[idx + 1] = 1;
        if (y > 0) next[idx - width] = 1;
        if (y + 1 < height) next[idx + width] = 1;
      }
    }
    const temp = current;
    current = next;
    next = temp;
  }

  return current;
};

export const createOutlinePreservedBitmap = async (
  source: HTMLImageElement,
  scale: number,
  options: OutlinePreserveOptions
): Promise<ImageBitmap> => {
  const sourceWidth = source.naturalWidth;
  const sourceHeight = source.naturalHeight;
  const targetWidth = Math.max(1, Math.floor(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.floor(sourceHeight * scale));

  const resizedBitmap = await createResizedImageBitmap(source, {
    width: targetWidth,
    height: targetHeight,
    quality: "pixelated",
  });

  if (
    !options.enabled ||
    scale >= 1 ||
    sourceWidth < 2 ||
    sourceHeight < 2
  ) {
    return resizedBitmap;
  }

  const sourceCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return resizedBitmap;
  sourceCtx.drawImage(source, 0, 0);
  const sourceImage = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  const sourcePixels = sourceImage.data;

  const sensitivity = Math.max(0, Math.min(200, options.threshold));
  const baseMask = createInkLineMask(
    sourcePixels,
    sourceWidth,
    sourceHeight,
    sensitivity
  );
  const dilatedMask = dilateMask(
    baseMask,
    sourceWidth,
    sourceHeight,
    Math.max(0, Math.round(options.width) - 1)
  );
  const fixedColor = options.useFixedColor ? parseHexColor(options.fixedColor) : null;

  const composedCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const composedCtx = composedCanvas.getContext("2d");
  if (!composedCtx) return resizedBitmap;
  composedCtx.drawImage(resizedBitmap, 0, 0);
  const targetImage = composedCtx.getImageData(0, 0, targetWidth, targetHeight);
  const targetPixels = targetImage.data;

  for (let y = 0; y < targetHeight; y++) {
    const sy = Math.min(
      sourceHeight - 1,
      Math.floor((y * sourceHeight) / targetHeight)
    );
    for (let x = 0; x < targetWidth; x++) {
      const sx = Math.min(
        sourceWidth - 1,
        Math.floor((x * sourceWidth) / targetWidth)
      );
      const sourceIdx = sy * sourceWidth + sx;
      if (!dilatedMask[sourceIdx]) continue;
      const sourceOffset = sourceIdx * 4;
      if (sourcePixels[sourceOffset + 3] < 128) continue;
      const targetOffset = (y * targetWidth + x) * 4;
      if (fixedColor) {
        targetPixels[targetOffset] = fixedColor[0];
        targetPixels[targetOffset + 1] = fixedColor[1];
        targetPixels[targetOffset + 2] = fixedColor[2];
      } else {
        targetPixels[targetOffset] = sourcePixels[sourceOffset];
        targetPixels[targetOffset + 1] = sourcePixels[sourceOffset + 1];
        targetPixels[targetOffset + 2] = sourcePixels[sourceOffset + 2];
      }
      targetPixels[targetOffset + 3] = 255;
    }
  }

  composedCtx.putImageData(targetImage, 0, 0);
  resizedBitmap.close();
  return await createImageBitmap(composedCanvas, { premultiplyAlpha: "none" });
};

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
 * 透過色適用
 * 指定されたRGB色のピクセルを完全透明(alpha=0)に変更
 * ImageDataを直接変更（破壊的）
 */
export const applyTransparentColors = (
  imageData: ImageData,
  transparentColors: Set<string>
): void => {
  if (transparentColors.size === 0) return;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    if (transparentColors.has(key)) data[i + 3] = 0;
  }
};

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
  quantizationMethod: QuantizationMethod = "rgb-euclidean",
  transparentColors?: Set<string>
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
      if (transparentColors?.size) applyTransparentColors(imageData, transparentColors);
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

  // 透過色適用
  if (transparentColors?.size) applyTransparentColors(imageData, transparentColors);

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
