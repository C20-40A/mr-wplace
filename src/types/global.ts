// mrWplace グローバル型定義

import { TileOverlay } from "../features/tile-overlay";
import { TileSnapshot } from "../features/time-travel/utils/tile-snapshot";
import { ChargeData } from "../features/user-status/services/timer-service";
import type { ColorFilterManager } from "../utils/color-filter-manager";
import type { AutoSpoit } from "../features/developer";

// Runtime拡張ChargeData型（startTime, timeToFull追加）
export interface RuntimeChargeData extends ChargeData {
  startTime: number;
  timeToFull: number;
}

interface mrWplace {
  colorFilterManager?: ColorFilterManager;
  tileOverlay: TileOverlay;
  wplaceChargeData?: RuntimeChargeData;
  tileSnapshot: TileSnapshot;
  autoSpoit?: AutoSpoit;
}

declare global {
  interface Window {
    mrWplace?: mrWplace;
  }
}

export {};
