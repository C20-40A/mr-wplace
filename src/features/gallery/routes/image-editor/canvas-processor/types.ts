export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface OutlinePreserveOptions {
  enabled: boolean;
  threshold: number;
  width: number;
  useFixedColor: boolean;
  fixedColor: string;
}

export type ColorFlattenMode = "none" | "light" | "medium";
export type PerceptualQuantizationMethod = "lab" | "oklab" | "lab-wplace";
export type QuantizationMethod =
  | "rgb-euclidean"
  | "weighted-rgb"
  | "lab"
  | "oklab"
  | "lab-wplace";
export type DitheringMethod = "ordered" | "floyd-steinberg";

export type RgbColor = [number, number, number];

export const DEFAULT_QUANTIZATION_METHOD: QuantizationMethod = "lab-wplace";
