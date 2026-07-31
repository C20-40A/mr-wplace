export type {
  ColorFlattenMode,
  DitheringMethod,
  ImageAdjustments,
  OutlinePreserveOptions,
  QuantizationMethod,
} from "./canvas-processor/types";
export { DEFAULT_QUANTIZATION_METHOD } from "./canvas-processor/types";

export { createOutlinePreservedBitmap } from "./canvas-processor/outline";
export type { TargetSize } from "./canvas-processor/resize-size";
export {
  resolveSizeFromScale,
  resolveSizeFromWidth,
  resolveSizeFromHeight,
} from "./canvas-processor/resize-size";
export {
  applyTransparentColors,
  quantizeToColorPalette,
  quantizeWithDithering,
} from "./canvas-processor/quantization";
export {
  applyImageAdjustments,
  createProcessedCanvasFromBitmap,
} from "./canvas-processor/processing";
