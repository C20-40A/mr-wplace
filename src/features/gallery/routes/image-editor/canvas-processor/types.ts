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

export type QuantizationMethod =
  | "rgb-euclidean"
  | "weighted-rgb"
  | "lab"
  | "oklab";
export type DitheringMethod = "ordered" | "floyd-steinberg";

export type RgbColor = [number, number, number];
