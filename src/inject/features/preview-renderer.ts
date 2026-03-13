import {
  createOutlinePreservedBitmap,
  createProcessedCanvasFromBitmap,
  type ColorFlattenMode,
  type DitheringMethod,
  type ImageAdjustments,
  type QuantizationMethod,
} from "@/features/gallery/routes/image-editor/canvas-processor";

export type InjectAdjustPreviewParams = {
  sessionId: string;
  imageSrc: string;
  widthPx: number;
  heightPx: number;
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

export type InjectTransparencyPreviewParams = {
  imageSrc: string;
  mask: number[];
  width: number;
  height: number;
};

export type InjectAdjustPreviewResult = {
  dataUrl: string;
  colorStats: Record<string, { matched: number; total: number }>;
};

type AdjustSessionEntry = {
  imageSrc: string;
  imagePromise: Promise<HTMLImageElement>;
};

const adjustPreviewSessions = new Map<string, AdjustSessionEntry>();

const loadImage = async (src: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.decoding = "async";

  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("preview image load failed"));
    image.src = src;
  });
};

const getAdjustSessionImage = async (
  sessionId: string,
  imageSrc: string,
): Promise<HTMLImageElement> => {
  const current = adjustPreviewSessions.get(sessionId);
  if (current && current.imageSrc === imageSrc) return current.imagePromise;

  const imagePromise = loadImage(imageSrc).catch((error) => {
    const latest = adjustPreviewSessions.get(sessionId);
    if (latest?.imagePromise === imagePromise) {
      adjustPreviewSessions.delete(sessionId);
    }
    throw error;
  });

  adjustPreviewSessions.set(sessionId, { imageSrc, imagePromise });
  return imagePromise;
};

const collectColorStats = (
  canvas: HTMLCanvasElement,
): Record<string, { matched: number; total: number }> => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return {};

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const colorStats: Record<string, { matched: number; total: number }> = {};
  for (const [key, count] of counts.entries()) {
    colorStats[key] = { matched: 0, total: count };
  }
  return colorStats;
};

export const renderAdjustPreview = async (
  params: InjectAdjustPreviewParams,
): Promise<InjectAdjustPreviewResult> => {
  const sourceImage = await getAdjustSessionImage(params.sessionId, params.imageSrc);
  const targetWidth = Math.max(1, Math.round(params.widthPx));
  const targetHeight = Math.max(1, Math.round(params.heightPx));
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = targetWidth;
  previewCanvas.height = targetHeight;

  const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });
  if (!previewCtx) throw new Error("adjust preview canvas context unavailable");

  previewCtx.imageSmoothingEnabled = false;
  previewCtx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

  let sourceBitmap: ImageBitmap;
  if (params.outlineEnabled) {
    const scale = previewCanvas.width / sourceImage.naturalWidth;
    sourceBitmap = await createOutlinePreservedBitmap(sourceImage, scale, {
      enabled: true,
      threshold: params.outlineThreshold,
      width: params.outlineWidth,
      useFixedColor: params.outlineUseFixedColor,
      fixedColor: params.outlineFixedColor,
    });
  } else {
    sourceBitmap = await createImageBitmap(previewCanvas);
  }

  try {
    const processedCanvas = await createProcessedCanvasFromBitmap(
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
    return {
      dataUrl: processedCanvas.toDataURL("image/png"),
      colorStats: collectColorStats(processedCanvas),
    };
  } finally {
    sourceBitmap.close();
  }
};

export const releaseAdjustPreviewSession = (sessionId: string): void => {
  adjustPreviewSessions.delete(sessionId);
};

export const renderTransparencyPreview = async (
  params: InjectTransparencyPreviewParams,
): Promise<string> => {
  const sourceImage = await loadImage(params.imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = params.width;
  canvas.height = params.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("transparency preview canvas context unavailable");

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceImage, 0, 0, params.width, params.height);

  const imageData = ctx.getImageData(0, 0, params.width, params.height);
  const len = Math.min(params.mask.length, imageData.data.length / 4);
  for (let i = 0; i < len; i++) {
    if (params.mask[i]) imageData.data[i * 4 + 3] = 0;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};
