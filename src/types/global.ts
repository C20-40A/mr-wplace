// mrWplace グローバル型定義

import { TileOverlay } from "../features/tile-overlay";
import { TileSnapshot } from "../features/time-travel/utils/tile-snapshot";
import { ChargeData } from "../features/user-status/services/timer-service";
import type { ColorFilterManager } from "../utils/color-filter-manager";
import type { DevInject } from "../features/developer";
import { WplaceMap } from "@/inject/types";

// Runtime拡張ChargeData型（startTime, timeToFull追加）
interface RuntimeChargeData extends ChargeData {
  startTime: number;
  timeToFull: number;
}

interface mrWplace {
  tileOverlay: TileOverlay;
  wplaceChargeData?: RuntimeChargeData;
  tileSnapshot: TileSnapshot;
  autoSpoit?: DevInject;
  // Content context only (not available in inject context)
  colorFilterManager?: ColorFilterManager;
  wplaceMap?: WplaceMap;
}

declare global {
  interface Window {
    mrWplace?: mrWplace;
  }
}

export {};
