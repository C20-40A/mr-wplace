import type { EnhancedMode } from "../../features/tile-draw/types";
import type { ComputeDevice } from "./storage";

export type SortOrder = "default" | "most-missing" | "least-remaining";

export interface ColorPaletteOptions {
  onChange?: (colorIds: number[]) => void;
  selectedColorIds?: number[];
  showCurrentlySelected?: boolean;
  showEnhancedSelect?: boolean;
  onEnhancedModeChange?: (mode: EnhancedMode) => void;
  enhancedMode?: EnhancedMode;
  hasExtraColorsBitmap?: boolean;
  showColorStats?: boolean;
  colorStats?: Record<string, { matched: number; total: number }>;
  sortOrder?: SortOrder;
  onSortOrderChange?: (sort: SortOrder) => void;
  showComputeDeviceSelect?: boolean;
  onComputeDeviceChange?: (device: ComputeDevice) => void;
  computeDevice?: ComputeDevice;
}

export interface ColorStats {
  matched: number;
  total: number;
}

export interface EnhancedModeOption {
  value: EnhancedMode;
  labelKey: string;
}

export interface SortOrderOption {
  value: SortOrder;
  labelKey: string;
}
