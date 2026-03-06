import type {
  ColorFlattenMode,
  DitheringMethod,
  ImageAdjustments,
  QuantizationMethod,
} from "@/features/gallery/routes/image-editor/canvas-processor";
import type { DrawPosition } from "@/states/galleryStorage";

// --- Types ---

export type AdjustToolProcessingParams = {
  adjustments: ImageAdjustments;
  selectedColorIds: number[];
  ditheringEnabled: boolean;
  ditheringThreshold: number;
  ditheringMethod: DitheringMethod;
  quantizationMethod: QuantizationMethod;
  colorFlattenMode: ColorFlattenMode;
  outlineEnabled: boolean;
  outlineThreshold: number;
  outlineWidth: number;
  outlineUseFixedColor: boolean;
  outlineFixedColor: string;
};

export type ConfirmResult = {
  widthPx: number;
  heightPx: number;
  drawPosition: DrawPosition | null;
  processingParams: AdjustToolProcessingParams;
};

// --- Image processing ---

export const applyProcessing = async (
  canvas: HTMLCanvasElement,
  params: AdjustToolProcessingParams,
  baseImage: HTMLImageElement | null,
): Promise<HTMLCanvasElement> => {
  const { createProcessedCanvasFromBitmap, createOutlinePreservedBitmap } =
    await import("@/features/gallery/routes/image-editor/canvas-processor");

  let sourceBitmap: ImageBitmap;

  if (params.outlineEnabled && baseImage) {
    const scale = canvas.width / baseImage.naturalWidth;
    sourceBitmap = await createOutlinePreservedBitmap(baseImage, scale, {
      enabled: true,
      threshold: params.outlineThreshold,
      width: params.outlineWidth,
      useFixedColor: params.outlineUseFixedColor,
      fixedColor: params.outlineFixedColor,
    });
  } else {
    sourceBitmap = await createImageBitmap(canvas);
  }

  try {
    return await createProcessedCanvasFromBitmap(
      sourceBitmap,
      params.adjustments,
      params.selectedColorIds,
      params.ditheringEnabled,
      params.ditheringThreshold,
      params.ditheringMethod,
      true,
      params.quantizationMethod,
      params.colorFlattenMode,
      new Set<string>(),
    );
  } finally {
    sourceBitmap.close();
  }
};

export const renderPreviewCanvas = async (
  sourceImage: HTMLImageElement,
  widthPx: number,
  heightPx: number,
): Promise<HTMLCanvasElement> => {
  if (!sourceImage.complete || sourceImage.naturalWidth < 1) {
    await new Promise<void>((resolve, reject) => {
      sourceImage.onload = () => resolve();
      sourceImage.onerror = () => reject(new Error("adjust tool preview source load failed"));
    });
  }

  const targetWidth = Math.max(1, Math.round(widthPx));
  const targetHeight = Math.max(1, Math.round(heightPx));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);
  return canvas;
};
