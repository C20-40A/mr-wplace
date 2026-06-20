import { colorpalette } from "@/constants/colors";
import { createResizedImageBitmap } from "@/utils/image-bitmap-compat";
import { gpuProcessImage } from "../gpu-image-processor";
import {
  applyTransparentColors,
  quantizeToColorPalette,
  quantizeWithDithering,
} from "./quantization";
import type {
  ColorFlattenMode,
  DitheringMethod,
  ImageAdjustments,
  QuantizationMethod,
} from "./types";

const createCanvasFromImageData = (imageData: ImageData): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

const createImageDataFromBitmap = (bitmap: ImageBitmap): ImageData => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get temp context");

  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
};

const canUseGpuProcessing = (
  useGpu: boolean,
  ditheringEnabled: boolean,
  ditheringMethod: DitheringMethod,
  colorFlattenMode: ColorFlattenMode,
  quantizationMethod: QuantizationMethod
): boolean =>
  useGpu &&
  colorFlattenMode === "none" &&
  quantizationMethod !== "lab-wplace" &&
  (!ditheringEnabled || ditheringMethod === "ordered");

const logProcessingMode = (
  useGpu: boolean,
  ditheringEnabled: boolean,
  ditheringMethod: DitheringMethod,
  colorFlattenMode: ColorFlattenMode
): void => {
  if (useGpu && colorFlattenMode !== "none") {
    console.log("🧑‍🎨 : CPU processing selected for color flatten:", colorFlattenMode);
    return;
  }
  if (useGpu && ditheringEnabled && ditheringMethod !== "ordered") {
    console.log("🧑‍🎨 : CPU processing selected for dithering method:", ditheringMethod);
    return;
  }
  console.log("🧑‍🎨 : CPU processing selected");
};

const applyColorFlatten = (
  imageData: ImageData,
  mode: ColorFlattenMode
): void => {
  if (mode === "none") return;

  const config =
    mode === "medium"
      ? { passes: 2, mix: 0.58, colorSigma: 42, lumaSigma: 24 }
      : { passes: 1, mix: 0.38, colorSigma: 28, lumaSigma: 18 };

  const { width, height } = imageData;
  let source = new Uint8ClampedArray(imageData.data);
  let target = new Uint8ClampedArray(source.length);
  const spatialWeights = [
    [0.65, 1, 0.65],
    [1, 1.35, 1],
    [0.65, 1, 0.65],
  ];
  const colorSigma2 = config.colorSigma * config.colorSigma;
  const lumaSigma2 = config.lumaSigma * config.lumaSigma;

  for (let pass = 0; pass < config.passes; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = source[idx + 3];
        if (alpha < 128) {
          target[idx] = source[idx];
          target[idx + 1] = source[idx + 1];
          target[idx + 2] = source[idx + 2];
          target[idx + 3] = 0;
          continue;
        }

        const baseR = source[idx];
        const baseG = source[idx + 1];
        const baseB = source[idx + 2];
        const baseLuma = 0.299 * baseR + 0.587 * baseG + 0.114 * baseB;

        let weightSum = 1.35;
        let rSum = baseR * 1.35;
        let gSum = baseG * 1.35;
        let bSum = baseB * 1.35;

        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) continue;

          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            if (offsetX === 0 && offsetY === 0) continue;

            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) continue;

            const sampleIdx = (sampleY * width + sampleX) * 4;
            if (source[sampleIdx + 3] < 128) continue;

            const sampleR = source[sampleIdx];
            const sampleG = source[sampleIdx + 1];
            const sampleB = source[sampleIdx + 2];
            const dr = sampleR - baseR;
            const dg = sampleG - baseG;
            const db = sampleB - baseB;
            const colorDist2 = dr * dr + dg * dg + db * db;
            const sampleLuma = 0.299 * sampleR + 0.587 * sampleG + 0.114 * sampleB;
            const lumaDist2 = (sampleLuma - baseLuma) * (sampleLuma - baseLuma);
            const similarity = Math.exp(-colorDist2 / colorSigma2 - lumaDist2 / lumaSigma2);
            const weight = spatialWeights[offsetY + 1][offsetX + 1] * similarity;

            weightSum += weight;
            rSum += sampleR * weight;
            gSum += sampleG * weight;
            bSum += sampleB * weight;
          }
        }

        const smoothR = rSum / weightSum;
        const smoothG = gSum / weightSum;
        const smoothB = bSum / weightSum;

        target[idx] = baseR + (smoothR - baseR) * config.mix;
        target[idx + 1] = baseG + (smoothG - baseG) * config.mix;
        target[idx + 2] = baseB + (smoothB - baseB) * config.mix;
        target[idx + 3] = 255;
      }
    }

    [source, target] = [target, source];
  }

  imageData.data.set(source);
};

const createGpuProcessedCanvas = async (
  sourceBitmap: ImageBitmap,
  adjustments: ImageAdjustments,
  selectedColorIds: number[],
  ditheringEnabled: boolean,
  ditheringThreshold: number,
  quantizationMethod: QuantizationMethod,
  transparentColors?: Set<string>
): Promise<HTMLCanvasElement> => {
  const paletteRGB = colorpalette
    .filter((color) => selectedColorIds.includes(color.id))
    .map((color) => color.rgb);
  const bitmapClone = await createImageBitmap(sourceBitmap);
  const processedData = await gpuProcessImage(
    bitmapClone,
    adjustments,
    paletteRGB,
    ditheringEnabled,
    ditheringThreshold,
    quantizationMethod
  );

  const imageData = new ImageData(
    new Uint8ClampedArray(processedData),
    sourceBitmap.width,
    sourceBitmap.height
  );
  if (transparentColors?.size) applyTransparentColors(imageData, transparentColors);
  return createCanvasFromImageData(imageData);
};

const createCpuProcessedCanvas = (
  sourceBitmap: ImageBitmap,
  adjustments: ImageAdjustments,
  selectedColorIds: number[],
  ditheringEnabled: boolean,
  ditheringThreshold: number,
  ditheringMethod: DitheringMethod,
  quantizationMethod: QuantizationMethod,
  colorFlattenMode: ColorFlattenMode,
  transparentColors?: Set<string>
): HTMLCanvasElement => {
  console.log("🧑‍🎨 : Starting CPU processing via ImageBitmap");

  const imageData = createImageDataFromBitmap(sourceBitmap);
  applyImageAdjustments(imageData, adjustments);
  applyColorFlatten(imageData, colorFlattenMode);

  if (ditheringEnabled) {
    quantizeWithDithering(
      imageData,
      selectedColorIds,
      ditheringThreshold,
      quantizationMethod,
      ditheringMethod
    );
  } else {
    quantizeToColorPalette(imageData, selectedColorIds, quantizationMethod);
  }

  if (transparentColors?.size) applyTransparentColors(imageData, transparentColors);
  return createCanvasFromImageData(imageData);
};

export const applyImageAdjustments = (
  imageData: ImageData,
  adjustments: ImageAdjustments
): void => {
  const data = imageData.data;
  const { brightness, contrast, saturation } = adjustments;

  const hasBrightnessContrast = brightness !== 0 || contrast !== 0;
  const hasSaturation = saturation !== 0;
  if (!hasBrightnessContrast && !hasSaturation) {
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = data[i + 3] < 128 ? 0 : 255;
    }
    return;
  }

  const brightnessValue = brightness * 2.55;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satFactor = 1 + saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      data[i + 3] = 0;
      continue;
    }

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (hasBrightnessContrast) {
      r = contrastFactor * (r + brightnessValue - 128) + 128;
      g = contrastFactor * (g + brightnessValue - 128) + 128;
      b = contrastFactor * (b + brightnessValue - 128) + 128;
    }

    if (hasSaturation) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * satFactor;
      g = gray + (g - gray) * satFactor;
      b = gray + (b - gray) * satFactor;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
};

export const createProcessedCanvasFromBitmap = async (
  resizedBitmap: ImageBitmap,
  adjustments: ImageAdjustments,
  selectedColorIds: number[],
  ditheringEnabled = false,
  ditheringThreshold = 500,
  ditheringMethod: DitheringMethod = "ordered",
  useGpu = true,
  quantizationMethod: QuantizationMethod = "rgb-euclidean",
  colorFlattenMode: ColorFlattenMode = "none",
  transparentColors?: Set<string>
): Promise<HTMLCanvasElement> => {
  if (canUseGpuProcessing(useGpu, ditheringEnabled, ditheringMethod, colorFlattenMode, quantizationMethod)) {
    try {
      console.log(
        "🧑‍🎨 : Attempting GPU processing via ImageBitmap, dithering:",
        ditheringEnabled,
        "quantization:",
        quantizationMethod,
        "flatten:",
        colorFlattenMode
      );

      const canvas = await createGpuProcessedCanvas(
        resizedBitmap,
        adjustments,
        selectedColorIds,
        ditheringEnabled,
        ditheringThreshold,
        quantizationMethod,
        transparentColors
      );
      console.log("🧑‍🎨 : GPU processing succeeded");
      return canvas;
    } catch (error) {
      console.log("🧑‍🎨 : GPU processing failed, fallback to CPU:", error);
    }
  } else {
    logProcessingMode(useGpu, ditheringEnabled, ditheringMethod, colorFlattenMode);
  }

  return createCpuProcessedCanvas(
    resizedBitmap,
    adjustments,
    selectedColorIds,
    ditheringEnabled,
    ditheringThreshold,
    ditheringMethod,
    quantizationMethod,
    colorFlattenMode,
    transparentColors
  );
};

export const createProcessedCanvas = async (
  img: HTMLImageElement,
  scale: number,
  adjustments: ImageAdjustments,
  selectedColorIds: number[],
  ditheringEnabled = false,
  ditheringThreshold = 500,
  ditheringMethod: DitheringMethod = "ordered",
  useGpu = true,
  quantizationMethod: QuantizationMethod = "rgb-euclidean",
  colorFlattenMode: ColorFlattenMode = "none"
): Promise<HTMLCanvasElement> => {
  const resizedBitmap = await createResizedImageBitmap(img, {
    width: Math.floor(img.naturalWidth * scale),
    height: Math.floor(img.naturalHeight * scale),
    quality: "pixelated",
  });

  try {
    return await createProcessedCanvasFromBitmap(
      resizedBitmap,
      adjustments,
      selectedColorIds,
      ditheringEnabled,
      ditheringThreshold,
      ditheringMethod,
      useGpu,
      quantizationMethod,
      colorFlattenMode
    );
  } finally {
    resizedBitmap.close();
  }
};
