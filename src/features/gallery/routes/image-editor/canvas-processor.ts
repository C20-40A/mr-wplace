export type {
  DitheringMethod,
  ImageAdjustments,
  OutlinePreserveOptions,
  QuantizationMethod,
} from "./canvas-processor/types";

export { createOutlinePreservedBitmap } from "./canvas-processor/outline";
export {
  applyTransparentColors,
  quantizeToColorPalette,
  quantizeWithDithering,
} from "./canvas-processor/quantization";
export {
  applyImageAdjustments,
  createProcessedCanvas,
  createProcessedCanvasFromBitmap,
} from "./canvas-processor/processing";
