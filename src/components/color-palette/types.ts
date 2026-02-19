import type { EnhancedMode } from "@/types/image";
import type { ComputeDevice } from "./storage";

export type SortOrder = "default" | "most-missing" | "least-remaining";

export interface ColorPaletteOptions {
  onChange?: (colorIds: number[]) => void;
  selectedColorIds?: number[];
  showCurrentlySelected?: boolean;
  showEnhancedSelect?: boolean;
  onEnhancedModeChange?: (mode: EnhancedMode) => void;
  enhancedMode?: EnhancedMode;
  enhancedColor?: [number, number, number];
  onEnhancedColorChange?: (color: [number, number, number]) => void;
  hasExtraColorsBitmap?: boolean;
  showColorStats?: boolean;
  colorStats?: Record<string, { matched: number; total: number }>;
  sortOrder?: SortOrder;
  onSortOrderChange?: (sort: SortOrder) => void;
  showComputeDeviceSelect?: boolean;
  onComputeDeviceChange?: (device: ComputeDevice) => void;
  computeDevice?: ComputeDevice;
  showOverlayModeSelect?: boolean;
  onOverlayModeChange?: (enabled: boolean) => void;
  overlayMode?: boolean;
  showUnplacedOnlyToggle?: boolean;
  onShowUnplacedOnlyChange?: (enabled: boolean) => void;
  showUnplacedOnly?: boolean;
  showUnplacedColor?: [number, number, number];
  onShowUnplacedColorChange?: (color: [number, number, number]) => void;
  showDisableUnusedButton?: boolean;
  controlSize?: "default" | "xs";
  /** trueの場合、進捗ゲージではなくtotalのみバッジ表示（image-editor用） */
  colorStatsTotalOnly?: boolean;
}

export interface ColorStats {
  matched: number;
  total: number;
}

export type SpeedTier = "fast" | "normal" | "slow";

export interface EnhancedModeOption {
  value: EnhancedMode;
  labelKey: string;
  speed?: SpeedTier;
  /** Max unplaced pixels for 2nd-pass rendering. undefined = no limit */
  maxPixels?: number;
}

export interface SortOrderOption {
  value: SortOrder;
  labelKey: string;
}
