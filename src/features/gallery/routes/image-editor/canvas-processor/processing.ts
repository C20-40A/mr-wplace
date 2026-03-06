import { colorpalette } from "@/constants/colors";
import { createResizedImageBitmap } from "@/utils/image-bitmap-compat";
import { gpuProcessImage } from "../gpu-image-processor";
import {
  applyTransparentColors,
  quantizeToColorPalette,
  quantizeWithDithering,
} from "./quantization";
import type {
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
  ditheringMethod: DitheringMethod
): boolean => useGpu && (!ditheringEnabled || ditheringMethod === "ordered");

const logProcessingMode = (
  useGpu: boolean,
  ditheringEnabled: boolean,
  ditheringMethod: DitheringMethod
): void => {
  if (useGpu && ditheringEnabled && ditheringMethod !== "ordered") {
    console.log("🧑‍🎨 : CPU processing selected for dithering method:", ditheringMethod);
    return;
  }
  console.log("🧑‍🎨 : CPU processing selected");
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
  transparentColors?: Set<string>
): HTMLCanvasElement => {
  console.log("🧑‍🎨 : Starting CPU processing via ImageBitmap");

  const imageData = createImageDataFromBitmap(sourceBitmap);
  applyImageAdjustments(imageData, adjustments);

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
  transparentColors?: Set<string>
): Promise<HTMLCanvasElement> => {
  if (canUseGpuProcessing(useGpu, ditheringEnabled, ditheringMethod)) {
    try {
      console.log(
        "🧑‍🎨 : Attempting GPU processing via ImageBitmap, dithering:",
        ditheringEnabled,
        "quantization:",
        quantizationMethod
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
    logProcessingMode(useGpu, ditheringEnabled, ditheringMethod);
  }

  return createCpuProcessedCanvas(
    resizedBitmap,
    adjustments,
    selectedColorIds,
    ditheringEnabled,
    ditheringThreshold,
    ditheringMethod,
    quantizationMethod,
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
  quantizationMethod: QuantizationMethod = "rgb-euclidean"
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
      quantizationMethod
    );
  } finally {
    resizedBitmap.close();
  }
};
