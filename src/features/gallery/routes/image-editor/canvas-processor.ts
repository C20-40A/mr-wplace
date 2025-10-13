import { colorpalette } from "../../../../constants/colors";

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
 * 画像処理統合：リサイズ→調整→パレット量子化
 * 完成したcanvasを返却
 */
export function createProcessedCanvas(
  img: HTMLImageElement,
  scale: number,
  adjustments: ImageAdjustments,
  selectedColorIds: number[]
): HTMLCanvasElement {
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;
  const newWidth = Math.floor(originalWidth * scale);
  const newHeight = Math.floor(originalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.imageSmoothingEnabled = false;

  // 1. リサイズ描画
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  // 2. 調整適用
  const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
  applyImageAdjustments(imageData, adjustments);

  // 3. パレット量子化
  quantizeToColorPalette(imageData, selectedColorIds);

  // 4. 書き戻し
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}
